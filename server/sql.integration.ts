import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import sql from 'mssql';
import { SqlStore } from './sql-store';
import { localSqlConfig } from './sql-config';
import { createApp } from './app';
import { draftBody, type Principal } from './contracts';

let pool: sql.ConnectionPool;
let store: SqlStore;
const fixture = readFileSync(new URL('../db/fixtures/catalog.csv', import.meta.url), 'utf8');
function identities() {
  const tenant = `test-${randomUUID()}`;
  return { admin: { tenant, oid: 'admin', roles: ['Admin'] }, user: { tenant, oid: 'one', roles: ['Foreman'] }, other: { tenant, oid: 'two', roles: ['Foreman'] } };
}
async function seed(admin: Principal) {
  const preview = await store.previewImport(admin, fixture);
  assert.deepEqual(preview.report.errors, []);
  await store.applyImport(admin, preview.id, 'I reviewed this batch', true);
  return preview;
}
before(async () => { pool = await new sql.ConnectionPool(localSqlConfig(false, 'EtalonOpsSqlTests')).connect(); store = new SqlStore(pool); });
after(async () => { await pool?.close(); });

test('SQL Server uses verified TLS; the app login cannot run DDL or alter audit history', async () => {
  await store.health();
  const roles = await store.q("SELECT IS_SRVROLEMEMBER('sysadmin') AS sysadmin, IS_MEMBER('db_owner') AS dbowner");
  assert.equal(roles.recordset[0].sysadmin, 0);
  assert.equal(roles.recordset[0].dbowner, 0);
  await assert.rejects(() => store.q('CREATE TABLE dbo.etalonops_forbidden(id int)'), /permission|denied/i);
  await assert.rejects(() => store.q('DELETE dbo.audit_events WHERE 1=0'), /permission|denied/i);
  await assert.rejects(() => store.q('UPDATE dbo.catalog_revisions SET reason=reason WHERE 1=0'), /permission|denied/i);
  await assert.rejects(() => store.q('DELETE dbo.catalog_revisions WHERE 1=0'), /permission|denied/i);
  const untrusted = localSqlConfig(false, 'EtalonOpsSqlTests');
  untrusted.options = { ...untrusted.options, cryptoCredentialsDetails: {}, trustServerCertificate: false };
  const bad = new sql.ConnectionPool(untrusted);
  try { await assert.rejects(() => bad.connect(), /certificate|self.signed|issuer/i); }
  finally { await bad.close(); }
});

test('SQL import dry-run, repeated apply, conflicts, ranking, export and rollback work on the actual engine', async () => {
  const { admin, user } = identities();
  await assert.rejects(async () => store.previewImport(user, fixture), /Administrator/);
  await assert.rejects(async () => store.listImports(user), /Administrator/);
  assert.equal((await store.listImports(admin)).length, 0);
  const preview = await store.previewImport(admin, fixture);
  assert.equal((await store.listImports(admin))[0].state, 'preview');
  assert.equal((await store.listImports({ ...admin, tenant: 'foreign' })).length, 0);
  assert.equal((await store.search(user, '1" PVC')).length, 0);
  await assert.rejects(() => store.applyImport(admin, preview.id, 'I reviewed this batch', false), /fixtures/);
  await store.applyImport(admin, preview.id, 'I reviewed this batch', true);
  assert.equal((await store.applyImport(admin, preview.id, 'I reviewed this batch', true)).unchanged, true);
  const matches = await store.search(user, '1" PVC');
  assert.equal(matches.length, 3);
  assert.equal(matches[0].score, 100);
  assert.equal(matches[0].source, 'verified_fixture');
  assert.equal((await store.search(user, '2 inch PVC')).length, 0);
  assert.equal((await store.search(user, 'self tappers')).length, 0);
  assert.equal((await store.search({ ...user, tenant: 'foreign' }, 'PVC')).length, 0);
  assert.ok((await store.previewImport(admin, fixture.replace('fixture-pvc-40', 'different-key'))).report.errors.length);
  assert.ok((await store.previewImport(admin, fixture.replace('fixture-pvc-40', 'FIXTURE-PVC-40'))).report.errors.length);
  assert.match(await store.exportCsv(admin), /Fictional test fixture/);
  await store.rollbackImport(admin, preview.id);
  assert.equal((await store.search(user, 'PVC')).length, 0);
  assert.equal((await store.rollbackImport(admin, preview.id)).unchanged, true);
});

test('SQL transactions preserve owner isolation, exact quantity/UOM, inheritance, overrides and historical references', async () => {
  const { admin, user, other } = identities();
  await store.member(user, 'riverside'); await store.member(other, 'riverside');
  const preview = await seed(admin);
  const candidate = (await store.search(user, '1 inch pvc'))[0];
  const body = draftBody.parse({ projectId: 'riverside', deliveryDate: '2026-11-10', version: 0, lines: [
    { id: randomUUID(), quantity: '1000.000001', requestedUnit: 'FT', description: candidate.description, rawInput: { quantity: '1000.000001', description: '1" PVC', requestedUnit: 'FT' }, candidate, source: 'verified_fixture', deliveryMode: 'inherit', overrideDate: null },
    { id: randomUUID(), quantity: '2', requestedUnit: 'BOX', description: 'self tappers', rawInput: { quantity: '2', description: 'self tappers', requestedUnit: 'BOX' }, candidate: null, source: 'user_description', deliveryMode: 'override', overrideDate: '2026-11-15' },
  ] });
  const saved = await store.saveDraft(user, body);
  assert.equal(saved.lines[0].quantity, '1000.000001');
  assert.equal(saved.lines[0].requestedUnit, 'FT');
  assert.equal(saved.lines[0].candidate.productUnit, 'STICK');
  await assert.rejects(() => store.getDraft(other, saved.id), /Draft not found/);
  await assert.rejects(() => store.saveDraft(other, { ...body, version: 1 }, saved.id), /Draft not found/);
  await assert.rejects(() => store.saveDraft(user, body, saved.id), /changed elsewhere/);
  const changed = await store.saveDraft(user, { ...body, version: 1, deliveryDate: '2026-11-12' }, saved.id);
  assert.equal(changed.deliveryDate, '2026-11-12');
  assert.equal(changed.lines[0].overrideDate, null);
  assert.equal(changed.lines[1].overrideDate, '2026-11-15');
  const reconnected = await new sql.ConnectionPool(localSqlConfig(false, 'EtalonOpsSqlTests')).connect();
  try { assert.equal((await new SqlStore(reconnected).getDraft(user, saved.id)).lines[0].rawInput.description, '1" PVC'); }
  finally { await reconnected.close(); }
  await store.rollbackImport(admin, preview.id);
  const afterRollback = await store.saveDraft(user, { ...body, version: 2 }, saved.id);
  assert.equal(afterRollback.lines.length, 2);
  const count = await store.q('SELECT COUNT(*) AS count FROM dbo.materials WHERE tenant=@p0', user.tenant);
  assert.equal(count.recordset[0].count, 4);
});

test('SQL simultaneous stale saves have one winner and one conflict, not a lost update', async () => {
  const { user } = identities(); await store.member(user, 'riverside');
  const body = draftBody.parse({ projectId: 'riverside', deliveryDate: '2026-11-10', version: 0, lines: [] });
  const saved = await store.saveDraft(user, body);
  const results = await Promise.allSettled([
    store.saveDraft(user, { ...body, version: 1, deliveryDate: '2026-11-11' }, saved.id),
    store.saveDraft(user, { ...body, version: 1, deliveryDate: '2026-11-12' }, saved.id),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failure = results.find(result => result.status === 'rejected');
  assert.equal(failure?.status === 'rejected' && failure.reason.status, 409);
  assert.equal((await store.getDraft(user, saved.id)).version, 2);
});

test('SQL simultaneous saves for different owners preserve both independent drafts', async () => {
  const { user, other } = identities();
  await store.member(user, 'riverside'); await store.member(other, 'riverside');
  const line = { id: randomUUID(), quantity: '1', requestedUnit: 'EA', description: 'Independent draft regression', rawInput: { quantity: '1', description: 'Independent draft regression', requestedUnit: 'EA' }, candidate: null, source: 'user_description', deliveryMode: 'inherit', overrideDate: null };
  const body = draftBody.parse({ projectId: 'riverside', deliveryDate: '2026-11-10', version: 0, lines: [line] });
  const one = await store.saveDraft(user, body), two = await store.saveDraft(other, body);
  for (let version = 1; version <= 50; version++) {
    await Promise.all([
      store.saveDraft(user, { ...body, version, lines: version % 2 ? [] : body.lines }, one.id),
      store.saveDraft(other, { ...body, version, lines: version % 2 ? [] : body.lines }, two.id),
    ]);
  }
  assert.equal((await store.getDraft(user, one.id)).version, 51);
  assert.equal((await store.getDraft(other, two.id)).version, 51);
});

test('SQL-backed HTTP API denies forged owners and non-admin imports and permits draft save/resume', async () => {
  const admin = { tenant: 'local-development', oid: 'admin', roles: ['Admin'] };
  await seed(admin);
  const server = createApp(store, { mode: 'local' }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const session = async (identity: string) => (await (await fetch(base + '/api/dev/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity }) })).json()).token;
  try {
    const token = await session('foreman-one'), other = await session('foreman-two');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const prior = await store.getProjectDraft({ ...admin, oid: 'foreman-one', roles: ['Foreman'] }, 'northside');
    const body = { projectId: 'northside', deliveryDate: '2026-11-10', version: prior?.version ?? 0, lines: [] };
    const forged = await fetch(base + '/api/drafts', { method: 'POST', headers, body: JSON.stringify({ ...body, ownerId: 'foreman-two' }) });
    assert.equal(forged.status, 400);
    const response = await fetch(base + '/api/drafts', { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    const { draft } = await response.json();
    assert.equal((await fetch(`${base}/api/drafts/${draft.id}`, { headers: { Authorization: `Bearer ${other}` } })).status, 404);
    assert.equal((await fetch(base + '/api/admin/imports/preview', { method: 'POST', headers, body: JSON.stringify({ csv: fixture }) })).status, 403);
    assert.equal((await fetch(`${base}/api/drafts/${draft.id}`, { headers })).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('SQL image review enforces tenant/admin boundaries and serializes replacement approvals',async()=>{
  const {admin,user}=identities();await seed(admin);const material=(await store.search(user,'1 inch pvc'))[0];
  const evidence={sourceUrl:'https://manufacturer.example/test',rightsBasis:'Fictional internal security-test fixture only.'};
  await assert.rejects(()=>store.submitImage(user,material.id,'a'.repeat(64),evidence),/Administrator/);
  const one=await store.submitImage(admin,material.id,'a'.repeat(64),evidence),two=await store.submitImage(admin,material.id,'b'.repeat(64),evidence);
  assert.equal(await store.approvedImage(user,material.id),null);
  const results=await Promise.allSettled([store.reviewImage(admin,material.id,one.id,'approved'),store.reviewImage(admin,material.id,two.id,'approved')]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,2);
  const records=await store.listImages(admin,material.id);assert.equal(records.filter(image=>image.status==='approved').length,1);
  const rejected=records.find(image=>image.status==='rejected')!;
  await assert.rejects(()=>store.submitImage(admin,material.id,rejected.contentHash,evidence),/rejected/);
  await assert.rejects(()=>store.approvedImage({...user,tenant:'foreign'},material.id),/not found/);
});

test('SQL persistent AI reservations are atomic, tenant scoped and not reset by a new connection',async()=>{
  const {admin,user,other}=identities();await store.member(user,'riverside');await store.member(other,'riverside');
  const session=randomUUID();
  const results=await Promise.allSettled(Array.from({length:4},()=>store.reserveAI(user,'riverside',session,randomUUID())));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,2);
  assert.equal((await store.aiUsage(admin)).requests,2);
  await assert.rejects(()=>store.reserveAI(other,'riverside',session,randomUUID()),/not found/);
  await assert.rejects(async()=>store.aiUsage(user),/Administrator/);
  assert.equal((await store.aiUsage({...admin,tenant:'foreign'})).requests,0);
  const reconnected=await new sql.ConnectionPool(localSqlConfig(false,'EtalonOpsSqlTests')).connect();
  try{assert.equal((await new SqlStore(reconnected).aiUsage(admin)).requests,2);}finally{await reconnected.close();}
});

// The same domain scenarios execute against the real restricted SQL connection.
const { catalogScenarios } = await import('./catalog-scenarios');
for(const scenario of catalogScenarios)test(`SQL catalog: ${scenario.name}`,async()=>scenario.run(store));

test('SQL runtime client-ID SID encoding matches SQL Server native GUID conversion',async()=>{
  const {sqlSid}=await import('./sql-principal');
  const client='10213243-5465-7687-98a9-bacbdcedfe0f';
  const row=(await store.q('SELECT CONVERT(varchar(34),CONVERT(varbinary(16),CONVERT(uniqueidentifier,@p0)),1) AS sid',client)).recordset[0];
  assert.equal(String(row.sid).toLowerCase(),sqlSid(client));
});
