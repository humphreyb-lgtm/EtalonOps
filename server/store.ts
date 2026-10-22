import {reportManual} from './manual-review';
import {selectImage} from '../src/image-selection';
import {accountAction} from './site-accounts';
import {resolveForeman} from './mrf-foreman';
import {selectResearchedProduct} from './research-selection';
import {researchLedger} from './research-ledger';
import { listSavedDrafts } from './draft-list';
import type { DraftFilters } from '../src/draft-filters';
import { submissions,submissionLabel } from './submissions';
import { admitUser,userAccess } from './user-access';
import { historicalSnapshot } from './catalog-history';
import { catalogAction, searchCatalog, validatePurchase, productForMaterial, type Operation } from './catalog-v2';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { stringify } from 'csv-stringify/sync';
import { ApiError, csvColumns, type DraftBody, type ImportRow, type Principal } from './contracts';
import { checkAIReservation, aiUsage, aiPeriod, type AIReservation } from './ai-policy';
import { imageLimits, type ImageRecord, type ImageEvidence } from './image-contracts';
import { normalize } from './search';

type Row = Record<string, SQLInputValue>;
import { parseCatalog, type Report } from './catalog';
const hash = (data: string) => createHash('sha256').update(data).digest('hex');
const now = () => new Date().toISOString();
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
    const migration = readFileSync(new URL('../db/migrations/001-local.sql', import.meta.url), 'utf8');
    const exists = this.db.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get();
    if (!exists) this.transaction(() => { this.db.exec(migration); this.db.prepare('INSERT INTO schema_migrations(version,checksum) VALUES(1,?)').run(hash(migration)); });
    const applied = this.db.prepare('SELECT checksum FROM schema_migrations WHERE version=1').get();
    if (applied?.checksum !== hash(migration)) throw new Error('Applied migration checksum changed. Create a new migration instead.');
    for(const [version,file] of [[2,'002-catalog.sql'],[3,'003-translation-evidence.sql'],[4,'004-catalog-revisions.sql'],[5,'005-named-drafts.sql'],[6,'006-user-access.sql'],[7,'007-mrf-submissions.sql'],[8,'008-product-details.sql'],[9,'009-material-categories.sql'],[10,'010-mrf-foreman.sql'],[11,'011-line-task-code.sql'],[12,'012-workforce-accounts.sql'],[13,'013-mrf-export.sql'],[14,'014-document-designer.sql'],[15,'015-admin-review-design.sql'],[16,'016-manual-line-identity.sql'],[17,'017-appearance-studio.sql']] as const){
      const next=readFileSync(new URL(`../db/migrations/${file}`,import.meta.url),'utf8');
      const prior=this.db.prepare('SELECT checksum FROM schema_migrations WHERE version=?').get(version);
      if(prior&&prior.checksum!==hash(next))throw new Error('Applied catalog migration checksum changed.');
      if(!prior){
        if(version===5)this.db.exec('PRAGMA foreign_keys=OFF');
        try{this.transaction(()=>{this.db.exec(next);if(this.db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Draft migration would break saved references.');this.db.prepare('INSERT INTO schema_migrations(version,checksum) VALUES(?,?)').run(version,hash(next));});}
        finally{if(version===5)this.db.exec('PRAGMA foreign_keys=ON');}
      }
    }
  }
  engine = 'SQLite local development';
  health() { this.db.prepare('SELECT 1').get(); }
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(p: Principal, action: string, target: string, at = now()) {
    this.db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').run(randomUUID(), p.tenant, p.oid, action, target, at);
  }
  requireAdmin(p: Principal) { if (!p.roles.includes('Admin')) throw new ApiError(403, 'Administrator role required.'); }
  requireProject(p: Principal, project: string) {
    if (!this.db.prepare('SELECT 1 FROM memberships WHERE tenant=? AND owner=? AND project=?').get(p.tenant, p.oid, project)) throw new ApiError(404, 'Project not found.');
  }
  member(p: Principal, project: string) { this.db.prepare('INSERT OR IGNORE INTO memberships(tenant,owner,project) VALUES(?,?,?)').run(p.tenant, p.oid, project); }
  getDraft(p: Principal, id: string) {
    const row = this.db.prepare('SELECT * FROM drafts WHERE id=? AND tenant=? AND owner=?').get(id, p.tenant, p.oid);
    if (!row) throw new ApiError(404, 'Draft not found.');
    this.requireProject(p, String(row.project));
    return this.mapDraft(row);
  }
  listDrafts(p:Principal,project:string,page=1,filters:DraftFilters={}){return this.transaction(()=>this.catalogRun(listSavedDrafts(p,project,page,filters)));}
  getProjectDraft(p: Principal, project: string) {
    this.requireProject(p, project);
    const row = this.db.prepare('SELECT * FROM drafts WHERE project=? AND tenant=? AND owner=? AND NOT EXISTS(SELECT 1 FROM mrf_submissions s WHERE s.draft_id=drafts.id) ORDER BY updated_at DESC,id DESC LIMIT 1').get(project, p.tenant, p.oid);
    return row ? this.mapDraft(row) : null;
  }
  mapDraft(row: Row) {
    const submission=this.db.prepare('SELECT id,mrf_number,revision,submitted_at FROM mrf_submissions WHERE draft_id=? AND tenant=? AND owner=?').get(row.id,row.tenant,row.owner);
    const lines = this.db.prepare('SELECT * FROM draft_lines WHERE draft_id=? ORDER BY position').all(row.id).map(line => ({
      id: line.id, quantity: line.quantity, requestedUnit: line.requested_uom, taskCode:String(line.task_code??''), description: line.description,
      rawInput: JSON.parse(String(line.raw_input)), candidate: line.candidate ? JSON.parse(String(line.candidate)) : null,
      purchasing: line.purchasing ? JSON.parse(String(line.purchasing)) : undefined, source: line.source, deliveryMode: line.delivery_mode, overrideDate: line.override_date,
    }));
    return { form:JSON.parse(String(row.form_json??'{}')), ...(submission?{submitted:{id:String(submission.id),number:submissionLabel(Number(submission.mrf_number),Number(submission.revision)),revision:Number(submission.revision),submittedAt:String(submission.submitted_at)}}:{}),foreman:{id:String(row.foreman_oid??row.owner).toLowerCase(),name:String(row.foreman_name??row.owner)},revisionOf:row.revision_of??null,id: row.id, projectId: row.project, name: row.name, deliveryDate: row.delivery_date, version: row.version, savedAt: row.updated_at, lines };
  }
  saveDraft(p: Principal, body: DraftBody, id?: string) {
    this.requireProject(p, body.projectId);
    return this.transaction(() => {
      const existing = id ? this.getDraft(p, id) : null;
      if ((existing && existing.version !== body.version) || (!existing && body.version !== 0)) throw new ApiError(409, 'This draft changed elsewhere. Reload before saving; your on-screen items are preserved.');
      if(existing?.submitted)throw new ApiError(409,'Submitted MRFs cannot be changed. Create a revision from the submitted record.');
      if (existing && existing.projectId !== body.projectId) throw new ApiError(409, 'A draft cannot be moved between projects.');
      const job=this.db.prepare('SELECT status FROM jobs WHERE tenant=? AND id=?').get(p.tenant,body.projectId);if(job&&job.status!=='active')throw new ApiError(409,'This job is archived. Its MRF history is retained.');
      const foreman=this.catalogRun(resolveForeman(p,body.projectId,body.foremanId===undefined?(existing?.foreman?.id??p.oid):(body.foremanId??p.oid)));
      const draftId = String(existing?.id ?? randomUUID());
      if (existing) this.db.prepare('UPDATE drafts SET delivery_date=?,version=version+1,updated_at=?,name=? WHERE id=? AND tenant=? AND owner=?').run(body.deliveryDate, now(), body.name??existing?.name??'Untitled MRF', draftId, p.tenant, p.oid);
      else this.db.prepare('INSERT INTO drafts(id,tenant,owner,project,delivery_date,version,updated_at,name) VALUES(?,?,?,?,?,1,?,?)').run(draftId, p.tenant, p.oid, body.projectId, body.deliveryDate, now(), body.name??'Untitled MRF');
      this.db.prepare('UPDATE drafts SET foreman_oid=?,foreman_name=? WHERE id=? AND tenant=? AND owner=?').run(foreman.id,foreman.name,draftId,p.tenant,p.oid);
      this.db.prepare('UPDATE drafts SET form_json=? WHERE id=? AND tenant=? AND owner=?').run(JSON.stringify(body.form??existing?.form??{}),draftId,p.tenant,p.oid);
      const priorMaterials = new Map(this.db.prepare('SELECT id,material_id,purchasing,candidate,source FROM draft_lines WHERE draft_id=?').all(draftId).map(line => [String(line.id), {materialId:line.material_id,purchasing:line.purchasing,candidate:line.candidate,source:line.source}]));
      this.db.prepare('DELETE FROM draft_lines WHERE draft_id=?').run(draftId);
      body.lines.forEach((line, index) => {
        let materialId: string | null = null;
        const historical = historicalSnapshot(priorMaterials.get(line.id), line);
        if (line.source === 'verified' || line.source === 'verified_fixture') {
          const material = this.db.prepare('SELECT * FROM materials WHERE id=? AND tenant=?').get(line.candidate!.id, p.tenant);
          if (!material || (!material.active && priorMaterials.get(line.id)?.materialId !== material.id)) throw new ApiError(400, 'Catalog candidate no longer exists. Re-run matching.');
          const details = JSON.parse(String(material.details));
          const expectedSource = material.dataset_kind === 'fixture' ? 'verified_fixture' : 'verified';
          if (!historical && (line.source !== expectedSource || line.candidate!.description !== material.description || line.candidate!.productUnit !== material.product_uom
            || JSON.stringify(line.candidate!.specs) !== JSON.stringify(details.specs) || line.candidate!.category !== details.category)) throw new ApiError(400, 'Catalog snapshot does not match its source record.');
          materialId = String(material.id);
        }
        this.catalogRun(validatePurchase(p,body.projectId,materialId,line.purchasing,false,Boolean(priorMaterials.get(line.id)?.materialId===materialId&&priorMaterials.get(line.id)?.purchasing===JSON.stringify(line.purchasing))));
        const snapshot = historical ?? (materialId ? (() => {
          const material = this.db.prepare('SELECT * FROM materials WHERE id=?').get(materialId)!;
          const details = JSON.parse(String(material.details));
          const profile=this.db.prepare('SELECT verification FROM catalog_profiles WHERE tenant=? AND material_id=?').get(p.tenant,materialId);
          return { ...line.candidate,verification:profile?.verification??'reviewed', provenance: { sourceUrl: details.row.source_url, verificationBasis: details.row.verification_basis, datasetKind: material.dataset_kind } };
        })() : line.candidate);
        this.db.prepare('INSERT INTO draft_lines(id,draft_id,position,material_id,quantity,requested_uom,description,raw_input,candidate,source,delivery_mode,override_date,purchasing) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(line.id, draftId, index, materialId, line.quantity, line.requestedUnit, line.description, JSON.stringify(line.rawInput), snapshot ? JSON.stringify(snapshot) : null, line.source, line.deliveryMode, line.overrideDate, line.purchasing ? JSON.stringify(line.purchasing) : null);
        this.db.prepare('UPDATE draft_lines SET task_code=? WHERE id=? AND draft_id=?').run(line.taskCode??'',line.id,draftId);
      });
      for(const line of body.lines)if(line.source==='user_description')this.catalogRun(reportManual(p,{id:line.id,projectId:body.projectId,draftId,searchPhrase:line.rawInput.description,description:line.description,quantity:line.quantity,unit:line.requestedUnit}));
      this.audit(p, 'draft.saved', draftId);
      return this.getDraft(p, draftId);
    });
  }
  catalogRun<T>(operation: Operation<T>): T {
    let step=operation.next();
    while(!step.done){
      const {text,values}=step.value;const bound: SQLInputValue[]=[];
      const statement=text.replace(/@p(\d+)/g,(_match,index)=>{const value=values[Number(index)];bound.push(value==null?null:typeof value==='number'?value:String(value));return '?';});
      const rows=this.db.prepare(statement).all(...bound);step=operation.next(rows);
    }
    return step.value;
  }
  submissions(p:Principal,action:string,data:unknown){return this.transaction(()=>this.catalogRun(submissions(p,action,data)));}
  admit(p:Principal,localBootstrap=false){return this.transaction(()=>this.catalogRun(admitUser(p,localBootstrap)));}
  account(tenant:string,action:string,data:unknown,p?:Principal){return this.transaction(()=>this.catalogRun(accountAction(tenant,action,data,p)));}
  users(p:Principal,action:string,data:unknown){return this.transaction(()=>this.catalogRun(userAccess(p,action,data)));}
  selectResearch(p:Principal,data:unknown){return this.transaction(()=>this.catalogRun(selectResearchedProduct(p,data)));}
  paidResearch(p:Principal,action:string,data:unknown){return this.transaction(()=>this.catalogRun(researchLedger(p,action,data)));}
  catalogCommand(p:Principal,action:string,data:unknown){return this.transaction(()=>this.catalogRun(catalogAction(p,action,data)));}
  search(p:Principal,query:string,projectId?:string){return this.catalogRun(searchCatalog(p,query,projectId));}
  parseImport(file: string) { return parseCatalog(file); }

  conflicts(p: Principal, rows: ImportRow[]) {
    const errors: Report['errors'] = [];
    rows.forEach((row, i) => {
      if (this.db.prepare('SELECT 1 FROM materials WHERE tenant=? AND external_key=? COLLATE NOCASE').get(p.tenant, row.external_key)) errors.push({ row: i + 2, message: 'Existing external key: updates require a separate reviewed correction.' });
      for (const alias of JSON.parse(row.aliases_json)) if (this.db.prepare('SELECT 1 FROM aliases a JOIN materials m ON a.material_id=m.id WHERE m.tenant=? AND a.normalized=? AND a.requested_uom=? AND m.active=1').get(p.tenant, normalize(alias), row.requested_uom)) errors.push({ row: i + 2, message: 'Alias conflicts with an active material.' });
    });
    return errors;
  }
  previewImport(p: Principal, file: string): { id: string; state: string; report: Report } {
    this.requireAdmin(p);
    const digest = hash(file), prior = this.db.prepare('SELECT * FROM import_batches WHERE tenant=? AND hash=?').get(p.tenant, digest);
    if (prior) return { id: String(prior.id), state: String(prior.state), report: JSON.parse(String(prior.report)) };
    const { rows, report } = this.parseImport(file);
    report.errors.push(...this.conflicts(p, rows));
    const id = randomUUID();
    this.db.prepare('INSERT INTO import_batches(id,tenant,hash,state,file,report) VALUES(?,?,?,\'preview\',?,?)').run(id, p.tenant, digest, file, JSON.stringify(report));
    this.audit(p, 'import.previewed', id);
    return { id, state: 'preview', report };
  }
  applyImport(p: Principal, id: string, approval: string, allowFixtures: boolean) {
    this.requireAdmin(p);
    return this.transaction(() => {
      const batch = this.db.prepare('SELECT * FROM import_batches WHERE id=? AND tenant=?').get(id, p.tenant);
      if (!batch) throw new ApiError(404, 'Import batch not found.');
      if (batch.state === 'applied') return { id, state: 'applied', unchanged: true };
      if (batch.state !== 'preview') throw new ApiError(409, 'Rolled-back batches cannot be reapplied.');
      const { rows, report } = this.parseImport(String(batch.file));
      report.errors.push(...this.conflicts(p, rows));
      if (report.errors.length) throw new ApiError(409, 'Import has validation/conflict errors. Preview the report.');
      if (approval !== 'I reviewed this batch' || (report.kind === 'fixture' && !allowFixtures)) throw new ApiError(400, 'Explicit review confirmation required; fixtures cannot enter the production catalog.');
      for (const row of rows) {
        const materialId = randomUUID();
        const specs = JSON.parse(row.specifications_json);
        this.db.prepare('INSERT INTO materials(id,tenant,external_key,description,product_uom,details,dataset_kind,batch_id) VALUES(?,?,?,?,?,?,?,?)').run(materialId, p.tenant, row.external_key, row.description, row.product_uom, JSON.stringify({ row, specs, category: /pvc|conduit/i.test(row.description) ? 'conduit' : /tape/i.test(row.description) ? 'tape' : 'general' }), row.dataset_kind, id);
        for (const alias of new Set<string>(JSON.parse(row.aliases_json))) this.db.prepare('INSERT OR IGNORE INTO aliases VALUES(?,?,?)').run(materialId, normalize(alias), row.requested_uom);
      }
      this.db.prepare("UPDATE import_batches SET state='applied',reviewer=?,approved_at=? WHERE id=?").run(p.oid, now(), id);
      this.audit(p, 'import.approved', id);
      return { id, state: 'applied', inserted: rows.length };
    });
  }
  rollbackImport(p: Principal, id: string) {
    this.requireAdmin(p);
    return this.transaction(() => {
      const batch = this.db.prepare('SELECT * FROM import_batches WHERE id=? AND tenant=?').get(id, p.tenant);
      if (!batch) throw new ApiError(404, 'Import batch not found.');
      if (batch.hash === hash('catalog-v2-materials')) throw new ApiError(409,'Use structured import history for catalog relationship rollback.');
      if (batch.state === 'rolled_back') return { state: 'rolled_back', unchanged: true };
      if (batch.state !== 'applied') throw new ApiError(409, 'Only applied batches can be rolled back.');
      this.db.prepare('UPDATE materials SET active=0 WHERE tenant=? AND batch_id=?').run(p.tenant, id);
      this.db.prepare("UPDATE import_batches SET state='rolled_back' WHERE id=?").run(id);
      this.audit(p, 'import.rolled_back', id);
      return { state: 'rolled_back', historyPreserved: true };
    });
  }
  aiReservations(p: Principal, period = aiPeriod()): AIReservation[] {
    return this.db.prepare("SELECT actor,target,at FROM audit_events WHERE tenant=? AND action='ai.reserved' AND target LIKE ?").all(p.tenant,`${period}/%`).map(row=>({actor:String(row.actor),target:String(row.target),at:String(row.at)}));
  }
  reserveAI(p: Principal,project: string,session: string,turn: string) {
    return this.transaction(()=>{this.requireProject(p,project);const date=new Date();const target=checkAIReservation(this.aiReservations(p,aiPeriod(date)),p,session,turn,date);this.audit(p,'ai.reserved',target,date.toISOString());return target;});
  }
  aiUsage(p: Principal){this.requireAdmin(p);const date=new Date();return aiUsage(this.aiReservations(p,aiPeriod(date)),date);}
  imageMaterial(p: Principal, id: string, activeOnly = false) {
    const row = this.db.prepare('SELECT id,active FROM materials WHERE tenant=? AND id=?').get(p.tenant,id);
    if (!row || (activeOnly && !row.active)) throw new ApiError(404,'Material not found.');
  }
  private mapImage(row: Row): ImageRecord { return { id:String(row.id),materialId:String(row.material_id),productId:row.product_id?String(row.product_id).toLowerCase():null,contentHash:String(row.content_hash),sourceUrl:String(row.source_url),rightsBasis:String(row.rights_basis),status:String(row.status) as ImageRecord['status'],reviewer:row.reviewer ? String(row.reviewer):null,reviewedAt:row.reviewed_at ? String(row.reviewed_at):null }; }
  listImages(p: Principal, id: string) {
    this.requireAdmin(p);this.imageMaterial(p,id);
    return this.db.prepare('SELECT * FROM image_associations WHERE tenant=? AND material_id=? ORDER BY reviewed_at DESC,id').all(p.tenant,id).map(row=>this.mapImage(row));
  }
  approvedImage(p: Principal, id: string, productId: string|null = null): ImageRecord | null {
    this.imageMaterial(p,id);
    const rows=this.db.prepare("SELECT i.* FROM image_associations i LEFT JOIN manufacturer_products p ON p.id=i.product_id AND p.tenant=i.tenant AND p.material_id=i.material_id WHERE i.tenant=? AND i.material_id=? AND i.status='approved' AND (i.product_id IS NULL OR p.active=1)").all(p.tenant,id);const row=selectImage(rows,productId);
    return row ? this.mapImage(row):null;
  }
  submitImage(p: Principal,id: string,hash: string,evidence: ImageEvidence,productId:string|null=null) {
    this.requireAdmin(p);
    return this.transaction(()=>{
      this.imageMaterial(p,id,true);
      if(productId)this.catalogRun(productForMaterial(p,id,productId));
      const prior=this.db.prepare('SELECT * FROM image_associations WHERE tenant=? AND material_id=? AND content_hash=?').get(p.tenant,id,hash);
      if (prior) { if((prior.product_id?String(prior.product_id).toLowerCase():null)!==productId)throw new ApiError(409,'These bytes already belong to another image scope; select a different photo.'); if (prior.status==='rejected') throw new ApiError(409,'This image was rejected for this product; choose a different image.'); return this.mapImage(prior); }
      const count=this.db.prepare('SELECT COUNT(*) AS count FROM image_associations WHERE tenant=?').get(p.tenant)!;
      if(Number(count.count)>=imageLimits.maxAssociations) throw new ApiError(429,'The pilot limit of 500 retained image associations has been reached.');
      const imageId=randomUUID();
      this.db.prepare("INSERT INTO image_associations(id,tenant,material_id,content_hash,source_url,rights_basis,status,product_id) VALUES(?,?,?,?,?,?,'pending',?)").run(imageId,p.tenant,id,hash,evidence.sourceUrl,evidence.rightsBasis,productId);
      this.audit(p,'image.uploaded',imageId);
      return this.listImages(p,id).find(image=>image.id===imageId)!;
    });
  }
  reviewImage(p: Principal,id: string,imageId: string,status: 'approved'|'rejected') {
    this.requireAdmin(p);
    return this.transaction(()=>{
      this.imageMaterial(p,id);
      const row=this.db.prepare('SELECT * FROM image_associations WHERE tenant=? AND material_id=? AND id=?').get(p.tenant,id,imageId);
      if (!row) throw new ApiError(404,'Image association not found.');
      if (row.status===status) return this.mapImage(row);
      if (row.status==='rejected' && status==='approved') throw new ApiError(409,'Rejected associations cannot be silently reapproved. Upload a different reviewed image.');
      if (status==='approved') {
        this.imageMaterial(p,id,true);
        const replaced=this.db.prepare("SELECT id FROM image_associations WHERE tenant=? AND material_id=? AND status='approved' AND ((product_id IS NULL AND ? IS NULL) OR product_id=?)").all(p.tenant,id,row.product_id,row.product_id);
        this.db.prepare("UPDATE image_associations SET status='rejected',reviewer=?,reviewed_at=? WHERE tenant=? AND material_id=? AND status='approved' AND ((product_id IS NULL AND ? IS NULL) OR product_id=?)").run(p.oid,now(),p.tenant,id,row.product_id,row.product_id);
        for (const old of replaced) this.audit(p,'image.replaced',String(old.id));
      }
      this.db.prepare('UPDATE image_associations SET status=?,reviewer=?,reviewed_at=? WHERE tenant=? AND material_id=? AND id=?').run(status,p.oid,now(),p.tenant,id,imageId);
      this.audit(p,`image.${status}`,imageId);
      return this.listImages(p,id).find(image=>image.id===imageId)!;
    });
  }
  listImports(p: Principal) {
    this.requireAdmin(p);
    return this.db.prepare('SELECT id,state,report,reviewer,approved_at FROM import_batches WHERE tenant=? AND hash<>? ORDER BY rowid DESC LIMIT 50').all(p.tenant,hash('catalog-v2-materials')).map(row => ({ id: String(row.id), state: String(row.state), report: JSON.parse(String(row.report)) as Report, reviewer: row.reviewer ? String(row.reviewer) : null, approvedAt: row.approved_at ? String(row.approved_at) : null }));
  }
  exportCsv(p: Principal) {
    this.requireAdmin(p);
    const rows = this.db.prepare('SELECT details FROM materials WHERE tenant=? AND active=1 ORDER BY external_key').all(p.tenant).map(row => {
      const original = JSON.parse(String(row.details)).row as ImportRow;
      return Object.fromEntries(csvColumns.map(key => { const value = original[key as keyof ImportRow]; return [key, /^[\t\r\n =+@\-']/.test(value) ? `'${value}` : value]; }));
    });
    return stringify(rows, { header: true, columns: csvColumns });
  }
}
