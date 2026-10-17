import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { ApiError, csvColumns, importRow, type DraftBody, type ImportRow, type Principal } from './contracts';
import { normalize, score } from './search';

type Row = Record<string, SQLInputValue>;
type Report = { rows: number; errors: { row: number; message: string }[]; kind: string };
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
  }
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(p: Principal, action: string, target: string) {
    this.db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').run(randomUUID(), p.tenant, p.oid, action, target, now());
  }
  requireAdmin(p: Principal) { if (!p.roles.includes('Admin')) throw new ApiError(403, 'Administrator role required.'); }
  requireProject(p: Principal, project: string) {
    if (!this.db.prepare('SELECT 1 FROM memberships WHERE tenant=? AND owner=? AND project=?').get(p.tenant, p.oid, project)) throw new ApiError(404, 'Project not found.');
  }
  member(p: Principal, project: string) { this.db.prepare('INSERT OR IGNORE INTO memberships VALUES(?,?,?)').run(p.tenant, p.oid, project); }
  getDraft(p: Principal, id: string) {
    const row = this.db.prepare('SELECT * FROM drafts WHERE id=? AND tenant=? AND owner=?').get(id, p.tenant, p.oid);
    if (!row) throw new ApiError(404, 'Draft not found.');
    this.requireProject(p, String(row.project));
    return this.mapDraft(row);
  }
  getProjectDraft(p: Principal, project: string) {
    this.requireProject(p, project);
    const row = this.db.prepare('SELECT * FROM drafts WHERE project=? AND tenant=? AND owner=?').get(project, p.tenant, p.oid);
    return row ? this.mapDraft(row) : null;
  }
  mapDraft(row: Row) {
    const lines = this.db.prepare('SELECT * FROM draft_lines WHERE draft_id=? ORDER BY position').all(row.id).map(line => ({
      id: line.id, quantity: line.quantity, requestedUnit: line.requested_uom, description: line.description,
      rawInput: JSON.parse(String(line.raw_input)), candidate: line.candidate ? JSON.parse(String(line.candidate)) : null,
      source: line.source, deliveryMode: line.delivery_mode, overrideDate: line.override_date,
    }));
    return { id: row.id, projectId: row.project, deliveryDate: row.delivery_date, version: row.version, savedAt: row.updated_at, lines };
  }
  saveDraft(p: Principal, body: DraftBody, id?: string) {
    this.requireProject(p, body.projectId);
    return this.transaction(() => {
      const existing = id ? this.getDraft(p, id) : this.getProjectDraft(p, body.projectId);
      if ((existing && existing.version !== body.version) || (!existing && body.version !== 0)) throw new ApiError(409, 'This draft changed elsewhere. Reload before saving; your on-screen items are preserved.');
      if (existing && existing.projectId !== body.projectId) throw new ApiError(409, 'A draft cannot be moved between projects.');
      const draftId = String(existing?.id ?? randomUUID());
      if (existing) this.db.prepare('UPDATE drafts SET delivery_date=?,version=version+1,updated_at=? WHERE id=? AND tenant=? AND owner=?').run(body.deliveryDate, now(), draftId, p.tenant, p.oid);
      else this.db.prepare('INSERT INTO drafts VALUES(?,?,?,?,?,1,?)').run(draftId, p.tenant, p.oid, body.projectId, body.deliveryDate, now());
      const priorMaterials = new Map(this.db.prepare('SELECT id,material_id FROM draft_lines WHERE draft_id=?').all(draftId).map(line => [String(line.id), line.material_id]));
      this.db.prepare('DELETE FROM draft_lines WHERE draft_id=?').run(draftId);
      body.lines.forEach((line, index) => {
        let materialId: string | null = null;
        if (line.source === 'verified' || line.source === 'verified_fixture') {
          const material = this.db.prepare('SELECT * FROM materials WHERE id=? AND tenant=?').get(line.candidate!.id, p.tenant);
          if (!material || (!material.active && priorMaterials.get(line.id) !== material.id)) throw new ApiError(400, 'Catalog candidate no longer exists. Re-run matching.');
          const details = JSON.parse(String(material.details));
          const expectedSource = material.dataset_kind === 'fixture' ? 'verified_fixture' : 'verified';
          if (line.source !== expectedSource || line.candidate!.description !== material.description || line.candidate!.productUnit !== material.product_uom
            || JSON.stringify(line.candidate!.specs) !== JSON.stringify(details.specs) || line.candidate!.category !== details.category) throw new ApiError(400, 'Catalog snapshot does not match its source record.');
          materialId = String(material.id);
        }
        const snapshot = materialId ? (() => {
          const material = this.db.prepare('SELECT * FROM materials WHERE id=?').get(materialId)!;
          const details = JSON.parse(String(material.details));
          return { ...line.candidate, provenance: { sourceUrl: details.row.source_url, verificationBasis: details.row.verification_basis, datasetKind: material.dataset_kind } };
        })() : line.candidate;
        this.db.prepare('INSERT INTO draft_lines VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(line.id, draftId, index, materialId, line.quantity, line.requestedUnit, line.description, JSON.stringify(line.rawInput), snapshot ? JSON.stringify(snapshot) : null, line.source, line.deliveryMode, line.overrideDate);
      });
      this.audit(p, 'draft.saved', draftId);
      return this.getDraft(p, draftId);
    });
  }
  search(p: Principal, query: string) {
    const materials = this.db.prepare('SELECT * FROM materials WHERE tenant=? AND active=1').all(p.tenant);
    const aliases = this.db.prepare('SELECT a.* FROM aliases a JOIN materials m ON m.id=a.material_id WHERE m.tenant=? AND m.active=1').all(p.tenant);
    return materials.map(material => {
      const phrases = [String(material.description), ...aliases.filter(a => a.material_id === material.id).map(a => String(a.normalized))];
      const rank = Math.max(...phrases.map(phrase => score(query, phrase)));
      const details = JSON.parse(String(material.details));
      return { id: material.id, description: material.description, productUnit: material.product_uom, specs: details.specs, category: details.category,
        source: material.dataset_kind === 'fixture' ? 'verified_fixture' : 'verified', score: rank, reason: rank === 100 ? 'Exact normalized alias' : 'All requested terms matched',
        provenance: { sourceUrl: details.row.source_url, verificationBasis: details.row.verification_basis, datasetKind: material.dataset_kind } };
    }).filter(item => item.score >= 85).sort((a, b) => b.score - a.score || String(a.description).localeCompare(String(b.description))).slice(0, 10);
  }
  parseImport(file: string) {
    const rows: ImportRow[] = [], errors: Report['errors'] = [];
    let records: Record<string, string>[];
    try {
      records = parse(file, { bom: true, columns: header => {
        if (header.length !== csvColumns.length || new Set(header).size !== header.length || csvColumns.some(name => !header.includes(name))) throw new Error('CSV headers must exactly match the v1 contract.');
        return header;
      }, skip_empty_lines: true, max_record_size: 25000 });
    } catch { return { rows, report: { rows: 0, kind: '', errors: [{ row: 1, message: 'Malformed CSV or invalid header.' }] } }; }
    if (!records.length || records.length > 1000) errors.push({ row: 1, message: 'Import must contain 1–1000 records.' });
    const keys = new Set<string>(), aliasOwners = new Map<string, string>();
    records.forEach((record, i) => {
      try {
        // Reversible spreadsheet escaping on export; accept only our convention.
        for (const key of Object.keys(record)) if (/^'[\t\r\n =+@\-']/.test(record[key])) record[key] = record[key].slice(1);
        const row = importRow.parse(record);
        if (keys.has(row.external_key)) throw new Error('Duplicate external_key.');
        keys.add(row.external_key);
        const list = JSON.parse(row.aliases_json), specs = JSON.parse(row.specifications_json), conversion = JSON.parse(row.conversion_basis_json);
        if (!Array.isArray(list) || !list.length || list.length > 50 || !list.every(a => typeof a === 'string' && a.trim() && a.length <= 200)) throw new Error('Aliases must be a nonempty JSON string array.');
        if (!Array.isArray(specs) || specs.length > 30 || !specs.every(s => typeof s === 'string' && s.length <= 500)) throw new Error('Specifications must be a JSON string array.');
        // Conversions require a future reviewed structured contract. Never infer them.
        if (conversion !== null) throw new Error('CSV v1 supports null conversion basis only; no conversions are inferred.');
        if (row.dataset_kind === 'reviewed' && !/^https:\/\//.test(row.source_url)) throw new Error('Reviewed records require an HTTPS evidence URL.');
        if (row.source_url && new URL(row.source_url).protocol !== 'https:') throw new Error('Source URL must be HTTPS.');
        for (const alias of list) {
          if (!normalize(alias)) throw new Error('Aliases must contain searchable text.');
          const key = `${normalize(alias)}|${row.requested_uom}`;
          if (aliasOwners.has(key) && aliasOwners.get(key) !== row.external_key) throw new Error('Ambiguous alias within this file.');
          aliasOwners.set(key, row.external_key);
        }
        rows.push(row);
      } catch (error) { errors.push({ row: i + 2, message: error instanceof Error && !('issues' in error) ? error.message : 'Invalid fields or unit.' }); }
    });
    const kinds = new Set(rows.map(row => row.dataset_kind));
    if (kinds.size > 1) errors.push({ row: 1, message: 'Do not mix fixtures and reviewed records in one batch.' });
    return { rows, report: { rows: records.length, errors, kind: rows[0]?.dataset_kind ?? '' } };
  }
  conflicts(p: Principal, rows: ImportRow[]) {
    const errors: Report['errors'] = [];
    rows.forEach((row, i) => {
      if (this.db.prepare('SELECT 1 FROM materials WHERE tenant=? AND external_key=?').get(p.tenant, row.external_key)) errors.push({ row: i + 2, message: 'Existing external key: updates require a separate reviewed correction.' });
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
      if (batch.state === 'rolled_back') return { state: 'rolled_back', unchanged: true };
      if (batch.state !== 'applied') throw new ApiError(409, 'Only applied batches can be rolled back.');
      this.db.prepare('UPDATE materials SET active=0 WHERE tenant=? AND batch_id=?').run(p.tenant, id);
      this.db.prepare("UPDATE import_batches SET state='rolled_back' WHERE id=?").run(id);
      this.audit(p, 'import.rolled_back', id);
      return { state: 'rolled_back', historyPreserved: true };
    });
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
