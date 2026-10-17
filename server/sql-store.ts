import sql from 'mssql';
import { createHash, randomUUID } from 'node:crypto';
import { stringify } from 'csv-stringify/sync';
import { ApiError, csvColumns, type DraftBody, type ImportRow, type Principal } from './contracts';
import { parseCatalog, type Report } from './catalog';
import { normalize, score } from './search';
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
  async audit(p: Principal, action: string, target: string) {
    await this.q('INSERT dbo.audit_events(id,tenant,actor,action,target,at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5)', randomUUID(), p.tenant, p.oid, action, target, now());
  }
  async mapDraft(row: Row) {
    const result = await this.q('SELECT * FROM dbo.draft_lines WHERE draft_id=@p0 ORDER BY position', row.id);
    const lines = result.recordset.map(line => ({ id: String(line.id).toLowerCase(), quantity: String(line.quantity), requestedUnit: line.requested_uom, description: line.description,
      rawInput: JSON.parse(line.raw_input), candidate: line.candidate ? JSON.parse(line.candidate) : null, source: line.source,
      deliveryMode: line.delivery_mode, overrideDate: dateOnly(line.override_date) }));
    return { id: String(row.id).toLowerCase(), projectId: row.project, deliveryDate: String(dateOnly(row.delivery_date)), version: Number(row.version), savedAt: new Date(row.updated_at).toISOString(), lines };
  }
  async getDraft(p: Principal, id: string): Promise<Awaited<ReturnType<SqlStore['mapDraft']>>> {
    if (!this.session) return this.transaction(tx => tx.getDraft(p, id), sql.ISOLATION_LEVEL.READ_COMMITTED);
    if (!isGuid(id)) throw new ApiError(404, 'Draft not found.');
    const row = (await this.q('SELECT * FROM dbo.drafts WITH(UPDLOCK,HOLDLOCK) WHERE id=@p0 AND tenant=@p1 AND owner=@p2', id, p.tenant, p.oid)).recordset[0];
    if (!row) throw new ApiError(404, 'Draft not found.');
    await this.requireProject(p, row.project);
    return this.mapDraft(row);
  }
  async getProjectDraft(p: Principal, project: string): Promise<Awaited<ReturnType<SqlStore['mapDraft']>> | null> {
    if (!this.session) return this.transaction(tx => tx.getProjectDraft(p, project), sql.ISOLATION_LEVEL.READ_COMMITTED);
    await this.requireProject(p, project);
    const row = (await this.q('SELECT * FROM dbo.drafts WITH(UPDLOCK,HOLDLOCK) WHERE project=@p0 AND tenant=@p1 AND owner=@p2', project, p.tenant, p.oid)).recordset[0];
    return row ? this.mapDraft(row) : null;
  }
  async saveDraft(p: Principal, body: DraftBody, id?: string) {
    await this.requireProject(p, body.projectId);
    return this.transaction(async tx => {
      const existing = id ? await tx.getDraft(p, id) : await tx.getProjectDraft(p, body.projectId);
      if ((existing && existing.version !== body.version) || (!existing && body.version !== 0)) throw new ApiError(409, 'This draft changed elsewhere. Reload before saving; your on-screen items are preserved.');
      if (existing && existing.projectId !== body.projectId) throw new ApiError(409, 'A draft cannot be moved between projects.');
      const draftId = String(existing?.id ?? randomUUID());
      if (existing) await tx.q('UPDATE dbo.drafts SET delivery_date=@p0,version=version+1,updated_at=@p1 WHERE id=@p2 AND tenant=@p3 AND owner=@p4', body.deliveryDate, now(), draftId, p.tenant, p.oid);
      else await tx.q('INSERT dbo.drafts(id,tenant,owner,project,delivery_date,version,updated_at) VALUES(@p0,@p1,@p2,@p3,@p4,1,@p5)', draftId, p.tenant, p.oid, body.projectId, body.deliveryDate, now());
      const previous = new Map((await tx.q('SELECT id,material_id FROM dbo.draft_lines WHERE draft_id=@p0', draftId)).recordset.map(line => [String(line.id).toLowerCase(), String(line.material_id).toLowerCase()]));
      await tx.q('DELETE dbo.draft_lines WHERE draft_id=@p0', draftId);
      for (const [index, line] of body.lines.entries()) {
        let materialId: string | null = null;
        let snapshot: unknown = line.candidate;
        if (line.source === 'verified' || line.source === 'verified_fixture') {
          if (!isGuid(line.candidate!.id)) throw new ApiError(400, 'Invalid catalog candidate.');
          const material = (await tx.q('SELECT * FROM dbo.materials WHERE id=@p0 AND tenant=@p1', line.candidate!.id, p.tenant)).recordset[0];
          if (!material || (!material.active && previous.get(line.id.toLowerCase()) !== String(material.id).toLowerCase())) throw new ApiError(400, 'Catalog candidate no longer exists. Re-run matching.');
          const details = JSON.parse(material.details);
          if (line.source !== (material.dataset_kind === 'fixture' ? 'verified_fixture' : 'verified') || line.candidate!.description !== material.description || line.candidate!.productUnit !== material.product_uom
            || JSON.stringify(line.candidate!.specs) !== JSON.stringify(details.specs) || line.candidate!.category !== details.category) throw new ApiError(400, 'Catalog snapshot does not match its source record.');
          materialId = material.id;
          snapshot = { ...line.candidate, provenance: { sourceUrl: details.row.source_url, verificationBasis: details.row.verification_basis, datasetKind: material.dataset_kind } };
        }
        await tx.q('INSERT dbo.draft_lines(id,draft_id,position,material_id,quantity,requested_uom,description,raw_input,candidate,source,delivery_mode,override_date) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11)',
          line.id, draftId, index, materialId, line.quantity, line.requestedUnit, line.description, JSON.stringify(line.rawInput), snapshot ? JSON.stringify(snapshot) : null, line.source, line.deliveryMode, line.overrideDate);
      }
      await tx.audit(p, 'draft.saved', draftId);
      return tx.getDraft(p, draftId);
    }, sql.ISOLATION_LEVEL.READ_COMMITTED);
  }
  async search(p: Principal, query: string) {
    const materials = (await this.q('SELECT * FROM dbo.materials WHERE tenant=@p0 AND active=1', p.tenant)).recordset;
    const aliases = (await this.q('SELECT a.* FROM dbo.aliases a JOIN dbo.materials m ON m.id=a.material_id WHERE m.tenant=@p0 AND m.active=1', p.tenant)).recordset;
    return materials.map(material => {
      const rank = Math.max(...[material.description, ...aliases.filter(a => a.material_id === material.id).map(a => a.normalized)].map(phrase => score(query, phrase)));
      const details = JSON.parse(material.details);
      return { id: String(material.id).toLowerCase(), description: material.description, productUnit: material.product_uom, specs: details.specs, category: details.category,
        source: material.dataset_kind === 'fixture' ? 'verified_fixture' : 'verified', score: rank, reason: rank === 100 ? 'Exact normalized alias' : 'All requested terms matched',
        provenance: { sourceUrl: details.row.source_url, verificationBasis: details.row.verification_basis, datasetKind: material.dataset_kind } };
    }).filter(item => item.score >= 85).sort((a, b) => b.score - a.score || String(a.description).localeCompare(String(b.description))).slice(0, 10);
  }
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
      if (batch.state === 'rolled_back') return { state: 'rolled_back', unchanged: true };
      if (batch.state !== 'applied') throw new ApiError(409, 'Only applied batches can be rolled back.');
      await tx.q('UPDATE dbo.materials SET active=0 WHERE tenant=@p0 AND batch_id=@p1', p.tenant, id);
      await tx.q("UPDATE dbo.import_batches SET state='rolled_back' WHERE id=@p0", id);
      await tx.audit(p, 'import.rolled_back', id);
      return { state: 'rolled_back', historyPreserved: true };
    });
  }
  async listImports(p: Principal) {
    this.requireAdmin(p);
    const rows = (await this.q('SELECT TOP (50) id,state,report,reviewer,approved_at FROM dbo.import_batches WHERE tenant=@p0 ORDER BY approved_at DESC,id', p.tenant)).recordset;
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
