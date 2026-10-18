import { admitUser,userAccess } from './user-access';
import type { Store } from './store';
import { historicalSnapshot } from './catalog-history';
import { catalogAction, searchCatalog, validatePurchase, productForMaterial, type Operation } from './catalog-v2';
import sql from 'mssql';
import { createHash, randomUUID } from 'node:crypto';
import { stringify } from 'csv-stringify/sync';
import { ApiError, csvColumns, type DraftBody, type ImportRow, type Principal } from './contracts';
import { parseCatalog, type Report } from './catalog';
import { normalize } from './search';
import { checkAIReservation, aiUsage, aiPeriod, type AIReservation } from './ai-policy';
import { imageLimits, type ImageRecord, type ImageEvidence } from './image-contracts';
import type { Repository } from './repository';

type Row = Record<string, any>; // Driver records are validated at request/import boundaries.
const now = () => new Date().toISOString();
const isGuid = (value: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
const dateOnly = (value: Date | string | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value;
export class SqlStore implements Repository {
  engine = 'SQL Server local development';
  constructor(readonly pool: sql.ConnectionPool, private session?: sql.Transaction) {}
  async q(text: string, ...values: unknown[]) {
    const request = this.session ? new sql.Request(this.session) : this.pool.request();
    values.forEach((value, index) => {
      if (typeof value === 'number') request.input(`p${index}`, sql.Int, value);
      else request.input(`p${index}`, sql.NVarChar(sql.MAX), value === null || value === undefined ? null : String(value));
    });
    return request.query<Row>(text);
  }
  async transaction<T>(work: (tx: SqlStore) => Promise<T>, isolation = sql.ISOLATION_LEVEL.SERIALIZABLE): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const tx = this.pool.transaction();
      await tx.begin(isolation);
      try { const result = await work(new SqlStore(this.pool, tx)); await tx.commit(); return result; }
      catch (error) {
        try { await tx.rollback(); } catch { /* The deadlock victim may already be rolled back. */ }
        // SQL Server guarantees that a 1205 victim was rolled back. Never retry
        // connection failures or uncertain commit outcomes. Callbacks perform SQL only.
        if (attempt >= 2 || !(error instanceof sql.RequestError) || error.number !== 1205) throw error;
        await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  }
  async health() { await this.q('SELECT 1 AS ready'); }
  requireAdmin(p: Principal) { if (!p.roles.includes('Admin')) throw new ApiError(403, 'Administrator role required.'); }
  async member(p: Principal, project: string) {
    if (!this.session) { await this.transaction(tx => tx.member(p, project)); return; }
    await this.q('IF NOT EXISTS(SELECT 1 FROM dbo.memberships WITH(UPDLOCK,HOLDLOCK) WHERE tenant=@p0 AND owner=@p1 AND project=@p2) INSERT dbo.memberships VALUES(@p0,@p1,@p2)', p.tenant, p.oid, project);
  }
  async requireProject(p: Principal, project: string) {
    if (!(await this.q('SELECT 1 FROM dbo.memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2', p.tenant, p.oid, project)).recordset.length) throw new ApiError(404, 'Project not found.');
  }
  async audit(p: Principal, action: string, target: string, at = now()) {
    await this.q('INSERT dbo.audit_events(id,tenant,actor,action,target,at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5)', randomUUID(), p.tenant, p.oid, action, target, at);
  }
  async mapDraft(row: Row) {
    const result = await this.q('SELECT * FROM dbo.draft_lines WHERE draft_id=@p0 ORDER BY position', row.id);
    const lines = result.recordset.map(line => ({ id: String(line.id).toLowerCase(), quantity: String(line.quantity), requestedUnit: line.requested_uom, description: line.description,
      rawInput: JSON.parse(line.raw_input), candidate: line.candidate ? JSON.parse(line.candidate) : null, source: line.source, purchasing:line.purchasing?JSON.parse(line.purchasing):undefined,
      deliveryMode: line.delivery_mode, overrideDate: dateOnly(line.override_date) }));
    return { id: String(row.id).toLowerCase(), projectId: row.project, name: row.name, deliveryDate: String(dateOnly(row.delivery_date)), version: Number(row.version), savedAt: new Date(row.updated_at).toISOString(), lines };
  }
  async getDraft(p: Principal, id: string): Promise<Awaited<ReturnType<SqlStore['mapDraft']>>> {
    if (!this.session) return this.transaction(tx => tx.getDraft(p, id), sql.ISOLATION_LEVEL.READ_COMMITTED);
    if (!isGuid(id)) throw new ApiError(404, 'Draft not found.');
    const row = (await this.q('SELECT * FROM dbo.drafts WITH(UPDLOCK,HOLDLOCK) WHERE id=@p0 AND tenant=@p1 AND owner=@p2', id, p.tenant, p.oid)).recordset[0];
    if (!row) throw new ApiError(404, 'Draft not found.');
    await this.requireProject(p, row.project);
    return this.mapDraft(row);
  }
  async listDrafts(p:Principal,project:string,page=1):Promise<ReturnType<Store['listDrafts']>>{
    if(!this.session)return this.transaction(tx=>tx.listDrafts(p,project,page),sql.ISOLATION_LEVEL.READ_COMMITTED);
    await this.requireProject(p,project);const total=Number((await this.q('SELECT COUNT(*) AS total FROM dbo.drafts WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,project)).recordset[0].total);
    const pages=Math.max(1,Math.ceil(total/25));page=Math.min(page,pages);
    const rows=(await this.q('SELECT d.id,d.name,d.project,d.delivery_date,d.updated_at,d.version,(SELECT COUNT(*) FROM dbo.draft_lines l WHERE l.draft_id=d.id) AS item_count FROM dbo.drafts d WHERE d.tenant=@p0 AND d.owner=@p1 AND d.project=@p2 ORDER BY d.updated_at DESC,d.id DESC OFFSET @p3 ROWS FETCH NEXT 25 ROWS ONLY',p.tenant,p.oid,project,(page-1)*25)).recordset;
    return {records:rows.map(r=>({id:String(r.id).toLowerCase(),name:r.name,projectId:r.project,deliveryDate:dateOnly(r.delivery_date),savedAt:r.updated_at instanceof Date?r.updated_at.toISOString():r.updated_at,itemCount:Number(r.item_count),version:Number(r.version)})),total,page,pages};
  }
  async getProjectDraft(p: Principal, project: string): Promise<Awaited<ReturnType<SqlStore['mapDraft']>> | null> {
    if (!this.session) return this.transaction(tx => tx.getProjectDraft(p, project), sql.ISOLATION_LEVEL.READ_COMMITTED);
    await this.requireProject(p, project);
    const row = (await this.q('SELECT TOP(1) * FROM dbo.drafts WITH(UPDLOCK,HOLDLOCK) WHERE project=@p0 AND tenant=@p1 AND owner=@p2 ORDER BY updated_at DESC,id DESC', project, p.tenant, p.oid)).recordset[0];
    return row ? this.mapDraft(row) : null;
  }
  async saveDraft(p: Principal, body: DraftBody, id?: string) {
    await this.requireProject(p, body.projectId);
    return this.transaction(async tx => {
      const existing = id ? await tx.getDraft(p, id) : null;
      if ((existing && existing.version !== body.version) || (!existing && body.version !== 0)) throw new ApiError(409, 'This draft changed elsewhere. Reload before saving; your on-screen items are preserved.');
      if (existing && existing.projectId !== body.projectId) throw new ApiError(409, 'A draft cannot be moved between projects.');
      const draftId = String(existing?.id ?? randomUUID());
      if (existing) await tx.q('UPDATE dbo.drafts SET delivery_date=@p0,version=version+1,updated_at=@p1,name=@p5 WHERE id=@p2 AND tenant=@p3 AND owner=@p4', body.deliveryDate, now(), draftId, p.tenant, p.oid, body.name??existing?.name??'Untitled MRF');
      else await tx.q('INSERT dbo.drafts(id,tenant,owner,project,delivery_date,version,updated_at,name) VALUES(@p0,@p1,@p2,@p3,@p4,1,@p5,@p6)', draftId, p.tenant, p.oid, body.projectId, body.deliveryDate, now(), body.name??'Untitled MRF');
      const previous = new Map((await tx.q('SELECT id,material_id,purchasing,candidate,source FROM dbo.draft_lines WHERE draft_id=@p0', draftId)).recordset.map(line => [String(line.id).toLowerCase(), {materialId:String(line.material_id).toLowerCase(),purchasing:line.purchasing,candidate:line.candidate,source:line.source}]));
      await tx.q('DELETE dbo.draft_lines WHERE draft_id=@p0', draftId);
      for (const [index, line] of body.lines.entries()) {
        let materialId: string | null = null;
        let snapshot: unknown = line.candidate;
        const historical = historicalSnapshot(previous.get(line.id.toLowerCase()), line);
        if (line.source === 'verified' || line.source === 'verified_fixture') {
          if (!isGuid(line.candidate!.id)) throw new ApiError(400, 'Invalid catalog candidate.');
          const material = (await tx.q('SELECT * FROM dbo.materials WHERE id=@p0 AND tenant=@p1', line.candidate!.id, p.tenant)).recordset[0];
          if (!material || (!material.active && previous.get(line.id.toLowerCase())?.materialId !== String(material.id).toLowerCase())) throw new ApiError(400, 'Catalog candidate no longer exists. Re-run matching.');
          const details = JSON.parse(material.details);
          if (!historical && (line.source !== (material.dataset_kind === 'fixture' ? 'verified_fixture' : 'verified') || line.candidate!.description !== material.description || line.candidate!.productUnit !== material.product_uom
            || JSON.stringify(line.candidate!.specs) !== JSON.stringify(details.specs) || line.candidate!.category !== details.category)) throw new ApiError(400, 'Catalog snapshot does not match its source record.');
          materialId = material.id;
          const profile=(await tx.q('SELECT verification FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,materialId)).recordset[0];
          snapshot = historical ?? { ...line.candidate,verification:profile?.verification??'reviewed', provenance: { sourceUrl: details.row.source_url, verificationBasis: details.row.verification_basis, datasetKind: material.dataset_kind } };
        }
        await tx.catalogRun(validatePurchase(p,body.projectId,materialId?String(materialId).toLowerCase():null,line.purchasing,false,previous.get(line.id.toLowerCase())?.materialId===String(materialId).toLowerCase()&&previous.get(line.id.toLowerCase())?.purchasing===JSON.stringify(line.purchasing)));
        await tx.q('INSERT dbo.draft_lines(id,draft_id,position,material_id,quantity,requested_uom,description,raw_input,candidate,source,delivery_mode,override_date,purchasing) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12)',
          line.id, draftId, index, materialId, line.quantity, line.requestedUnit, line.description, JSON.stringify(line.rawInput), snapshot ? JSON.stringify(snapshot) : null, line.source, line.deliveryMode, line.overrideDate,line.purchasing?JSON.stringify(line.purchasing):null);
      }
      await tx.audit(p, 'draft.saved', draftId);
      return tx.getDraft(p, draftId);
    }, sql.ISOLATION_LEVEL.READ_COMMITTED);
  }
  async catalogRun<T>(operation:Operation<T>):Promise<T>{
    let step=operation.next();
    while(!step.done){const rows=(await this.q(step.value.text,...step.value.values)).recordset;step=operation.next(rows);}
    return step.value;
  }
  async admit(p:Principal,localBootstrap=false){return this.transaction(tx=>tx.catalogRun(admitUser(p,localBootstrap)));}
  async users(p:Principal,action:string,data:unknown){return this.transaction(tx=>tx.catalogRun(userAccess(p,action,data)));}
  async catalogCommand(p:Principal,action:string,data:unknown){return this.transaction(tx=>tx.catalogRun(catalogAction(p,action,data)));}
  async search(p:Principal,query:string,projectId?:string){return this.catalogRun(searchCatalog(p,query,projectId));}
  async conflicts(p: Principal, rows: ImportRow[]) {
    const errors: Report['errors'] = [];
    for (const [index, row] of rows.entries()) {
      if ((await this.q('SELECT 1 FROM dbo.materials WHERE tenant=@p0 AND external_key=@p1', p.tenant, row.external_key)).recordset.length) errors.push({ row: index + 2, message: 'Existing external key: updates require a separate reviewed correction.' });
      for (const alias of JSON.parse(row.aliases_json)) if ((await this.q('SELECT 1 FROM dbo.aliases a JOIN dbo.materials m ON a.material_id=m.id WHERE m.tenant=@p0 AND a.normalized=@p1 AND a.requested_uom=@p2 AND m.active=1', p.tenant, normalize(alias), row.requested_uom)).recordset.length) errors.push({ row: index + 2, message: 'Alias conflicts with an active material.' });
    }
    return errors;
  }
  async previewImport(p: Principal, file: string) {
    this.requireAdmin(p);
    return this.transaction(async tx => {
      const hash = createHash('sha256').update(file).digest('hex');
      const prior = (await tx.q('SELECT * FROM dbo.import_batches WITH(UPDLOCK,HOLDLOCK) WHERE tenant=@p0 AND hash=@p1', p.tenant, hash)).recordset[0];
      if (prior) return { id: String(prior.id).toLowerCase(), state: String(prior.state), report: JSON.parse(prior.report) as Report };
      const { rows, report } = parseCatalog(file);
      report.errors.push(...await tx.conflicts(p, rows));
      const id = randomUUID();
      await tx.q("INSERT dbo.import_batches(id,tenant,hash,state,[file],report) VALUES(@p0,@p1,@p2,'preview',@p3,@p4)", id, p.tenant, hash, file, JSON.stringify(report));
      await tx.audit(p, 'import.previewed', id);
      return { id, state: 'preview', report };
    });
  }
  async applyImport(p: Principal, id: string, approval: string, allowFixtures: boolean) {
    this.requireAdmin(p);
    if (!isGuid(id)) throw new ApiError(404, 'Import batch not found.');
    return this.transaction(async tx => {
      const batch = (await tx.q('SELECT * FROM dbo.import_batches WITH(UPDLOCK,HOLDLOCK) WHERE id=@p0 AND tenant=@p1', id, p.tenant)).recordset[0];
      if (!batch) throw new ApiError(404, 'Import batch not found.');
      if (batch.state === 'applied') return { id, state: 'applied', unchanged: true };
      if (batch.state !== 'preview') throw new ApiError(409, 'Rolled-back batches cannot be reapplied.');
      const { rows, report } = parseCatalog(batch.file);
      report.errors.push(...await tx.conflicts(p, rows));
      if (report.errors.length) throw new ApiError(409, 'Import has validation/conflict errors. Preview the report.');
      if (approval !== 'I reviewed this batch' || (report.kind === 'fixture' && !allowFixtures)) throw new ApiError(400, 'Explicit review confirmation required; fixtures cannot enter the production catalog.');
      for (const row of rows) {
        const id = randomUUID(), specs = JSON.parse(row.specifications_json);
        await tx.q('INSERT dbo.materials(id,tenant,external_key,description,product_uom,details,dataset_kind,batch_id) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)', id, p.tenant, row.external_key, row.description, row.product_uom,
          JSON.stringify({ row, specs, category: /pvc|conduit/i.test(row.description) ? 'conduit' : /tape/i.test(row.description) ? 'tape' : 'general' }), row.dataset_kind, batch.id);
        for (const alias of new Set<string>((JSON.parse(row.aliases_json) as string[]).map(normalize))) await tx.q('INSERT dbo.aliases VALUES(@p0,@p1,@p2)', id, alias, row.requested_uom);
      }
      await tx.q("UPDATE dbo.import_batches SET state='applied',reviewer=@p0,approved_at=@p1 WHERE id=@p2", p.oid, now(), id);
      await tx.audit(p, 'import.approved', id);
      return { id, state: 'applied', inserted: rows.length };
    });
  }
  async rollbackImport(p: Principal, id: string) {
    this.requireAdmin(p);
    if (!isGuid(id)) throw new ApiError(404, 'Import batch not found.');
    return this.transaction(async tx => {
      const batch = (await tx.q('SELECT * FROM dbo.import_batches WITH(UPDLOCK,HOLDLOCK) WHERE id=@p0 AND tenant=@p1', id, p.tenant)).recordset[0];
      if (!batch) throw new ApiError(404, 'Import batch not found.');
      if (batch.hash === createHash('sha256').update('catalog-v2-materials').digest('hex')) throw new ApiError(409,'Use structured import history for catalog relationship rollback.');
      if (batch.state === 'rolled_back') return { state: 'rolled_back', unchanged: true };
      if (batch.state !== 'applied') throw new ApiError(409, 'Only applied batches can be rolled back.');
      await tx.q('UPDATE dbo.materials SET active=0 WHERE tenant=@p0 AND batch_id=@p1', p.tenant, id);
      await tx.q("UPDATE dbo.import_batches SET state='rolled_back' WHERE id=@p0", id);
      await tx.audit(p, 'import.rolled_back', id);
      return { state: 'rolled_back', historyPreserved: true };
    });
  }
  async aiReservations(p: Principal, period = aiPeriod()): Promise<AIReservation[]> {
    return (await this.q("SELECT actor,target,at FROM dbo.audit_events WITH(UPDLOCK,HOLDLOCK) WHERE tenant=@p0 AND action='ai.reserved' AND target LIKE @p1",p.tenant,`${period}/%`)).recordset.map(row=>({actor:row.actor,target:row.target,at:new Date(row.at).toISOString()}));
  }
  async reserveAI(p: Principal,project: string,session: string,turn: string) {
    return this.transaction(async tx=>{await tx.requireProject(p,project);const date=new Date();const target=checkAIReservation(await tx.aiReservations(p,aiPeriod(date)),p,session,turn,date);await tx.audit(p,'ai.reserved',target,date.toISOString());return target;});
  }
  async aiUsage(p: Principal){this.requireAdmin(p);const date=new Date();return aiUsage(await this.aiReservations(p,aiPeriod(date)),date);}
  async imageMaterial(p: Principal,id: string,activeOnly=false) {
    if (!isGuid(id)) throw new ApiError(404,'Material not found.');
    const row=(await this.q('SELECT id,active FROM dbo.materials WHERE tenant=@p0 AND id=@p1',p.tenant,id)).recordset[0];
    if (!row || (activeOnly && !row.active)) throw new ApiError(404,'Material not found.');
  }
  private mapImage(row: Row): ImageRecord { return {id:String(row.id).toLowerCase(),materialId:String(row.material_id).toLowerCase(),productId:row.product_id?String(row.product_id).toLowerCase():null,contentHash:row.content_hash,sourceUrl:row.source_url,rightsBasis:row.rights_basis,status:row.status,reviewer:row.reviewer ?? null,reviewedAt:row.reviewed_at ? new Date(row.reviewed_at).toISOString():null}; }
  async listImages(p: Principal,id: string) {
    this.requireAdmin(p);await this.imageMaterial(p,id);
    return (await this.q('SELECT * FROM dbo.image_associations WHERE tenant=@p0 AND material_id=@p1 ORDER BY reviewed_at DESC,id',p.tenant,id)).recordset.map(row=>this.mapImage(row));
  }
  async approvedImage(p: Principal,id: string,productId:string|null=null): Promise<ImageRecord|null> {
    await this.imageMaterial(p,id);
    const row=(await this.q("SELECT * FROM dbo.image_associations WHERE tenant=@p0 AND material_id=@p1 AND status='approved' AND ((product_id IS NULL AND @p2 IS NULL) OR product_id=@p2)",p.tenant,id,productId)).recordset[0];
    return row ? this.mapImage(row):null;
  }
  async submitImage(p: Principal,id: string,hash: string,evidence: ImageEvidence,productId:string|null=null) {
    this.requireAdmin(p);
    return this.transaction(async tx=>{
      await tx.imageMaterial(p,id,true);
      if(productId)await tx.catalogRun(productForMaterial(p,id,productId));
      const prior=(await tx.q('SELECT * FROM dbo.image_associations WITH(UPDLOCK,HOLDLOCK) WHERE tenant=@p0 AND material_id=@p1 AND content_hash=@p2',p.tenant,id,hash)).recordset[0];
      if (prior) { if((prior.product_id?String(prior.product_id).toLowerCase():null)!==productId)throw new ApiError(409,'These bytes already belong to another image scope; select a different photo.'); if (prior.status==='rejected') throw new ApiError(409,'This image was rejected for this product; choose a different image.'); return tx.mapImage(prior); }
      const count=(await tx.q('SELECT COUNT(*) AS count FROM dbo.image_associations WITH(UPDLOCK,HOLDLOCK) WHERE tenant=@p0',p.tenant)).recordset[0];
      if(Number(count.count)>=imageLimits.maxAssociations) throw new ApiError(429,'The pilot limit of 500 retained image associations has been reached.');
      const imageId=randomUUID();
      await tx.q("INSERT dbo.image_associations(id,tenant,material_id,content_hash,source_url,rights_basis,status,product_id) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,'pending',@p6)",imageId,p.tenant,id,hash,evidence.sourceUrl,evidence.rightsBasis,productId);
      await tx.audit(p,'image.uploaded',imageId);
      return (await tx.listImages(p,id)).find(image=>image.id===imageId)!;
    });
  }
  async reviewImage(p: Principal,id: string,imageId: string,status: 'approved'|'rejected') {
    this.requireAdmin(p);
    if (!isGuid(imageId)) throw new ApiError(404,'Image association not found.');
    return this.transaction(async tx=>{
      await tx.imageMaterial(p,id);
      // Lock the parent so concurrent approvals cannot leave two active pictures.
      await tx.q('SELECT id FROM dbo.materials WITH(UPDLOCK,HOLDLOCK) WHERE id=@p0 AND tenant=@p1',id,p.tenant);
      const row=(await tx.q('SELECT * FROM dbo.image_associations WHERE tenant=@p0 AND material_id=@p1 AND id=@p2',p.tenant,id,imageId)).recordset[0];
      if (!row) throw new ApiError(404,'Image association not found.');
      if (row.status===status) return tx.mapImage(row);
      if (row.status==='rejected' && status==='approved') throw new ApiError(409,'Rejected associations cannot be silently reapproved. Upload a different reviewed image.');
      if (status==='approved') {
        await tx.imageMaterial(p,id,true);
        const replaced=(await tx.q("SELECT id FROM dbo.image_associations WHERE tenant=@p0 AND material_id=@p1 AND status='approved' AND ((product_id IS NULL AND @p2 IS NULL) OR product_id=@p2)",p.tenant,id,row.product_id)).recordset;
        await tx.q("UPDATE dbo.image_associations SET status='rejected',reviewer=@p0,reviewed_at=@p1 WHERE tenant=@p2 AND material_id=@p3 AND status='approved' AND ((product_id IS NULL AND @p4 IS NULL) OR product_id=@p4)",p.oid,now(),p.tenant,id,row.product_id);
        for (const old of replaced) await tx.audit(p,'image.replaced',String(old.id));
      }
      await tx.q('UPDATE dbo.image_associations SET status=@p0,reviewer=@p1,reviewed_at=@p2 WHERE tenant=@p3 AND material_id=@p4 AND id=@p5',status,p.oid,now(),p.tenant,id,imageId);
      await tx.audit(p,`image.${status}`,imageId);
      return (await tx.listImages(p,id)).find(image=>image.id===imageId)!;
    });
  }
  async listImports(p: Principal) {
    this.requireAdmin(p);
    const rows = (await this.q('SELECT TOP (50) id,state,report,reviewer,approved_at FROM dbo.import_batches WHERE tenant=@p0 AND hash<>@p1 ORDER BY approved_at DESC,id', p.tenant,createHash('sha256').update('catalog-v2-materials').digest('hex'))).recordset;
    return rows.map(row => ({ id: String(row.id).toLowerCase(), state: String(row.state), report: JSON.parse(row.report) as Report, reviewer: row.reviewer ? String(row.reviewer) : null, approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null }));
  }
  async exportCsv(p: Principal) {
    this.requireAdmin(p);
    const records = (await this.q('SELECT details FROM dbo.materials WHERE tenant=@p0 AND active=1 ORDER BY external_key', p.tenant)).recordset;
    return stringify(records.map(record => { const row = JSON.parse(record.details).row as ImportRow; return Object.fromEntries(csvColumns.map(column => {
      const value = row[column as keyof ImportRow]; return [column, /^[\t\r\n =+@\-']/.test(value) ? `'${value}` : value];
    })); }), { header: true, columns: csvColumns });
  }
}
