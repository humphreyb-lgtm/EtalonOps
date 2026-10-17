import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { createApp } from './app';
import { createAuth } from './auth';
import { Store } from './store';
import { normalize, score } from './search';

const fixture = readFileSync(new URL('../db/fixtures/catalog.csv', import.meta.url), 'utf8');
const admin = { tenant: 'local-development', oid: 'admin', roles: ['Admin'] };
const user = { ...admin, oid: 'foreman-one', roles: ['Foreman'] };

test('ranked matching preserves sizes and does not invent a self-tapper mapping', () => {
  assert.equal(normalize('1" PVC'), normalize('1 inch PVC'));
  assert.equal(normalize('1pvc'), normalize('1 inch PVC'));
  assert.equal(score('1" PVC', '1 inch PVC'), 100);
  assert.equal(score('2 inch pvc', '1 inch pvc'), 0);
  assert.equal(score('electrcal tape', 'electrical tape'), 85);
  assert.equal(score('self tappers', 'PVC conduit'), 0);
});

test('Entra configuration fails closed and production mode has no local session route', async () => {
  assert.throws(() => createAuth({ mode: 'entra', tenant: 'common', audience: 'api' }), /Explicit Entra tenant/);
  const store = new Store(':memory:');
  const server = createApp(store, { mode: 'entra', tenant: '11111111-1111-1111-1111-111111111111', audience: 'test-api' }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/dev/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: 'admin' }) });
    assert.equal(response.status, 401);
    assert.ok(!('token' in await response.json()));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); store.db.close(); }
});

test('real relational local database: review/import/idempotency/conflicts/export/rollback', () => {
  const store = new Store(':memory:');
  try {
    assert.throws(() => store.previewImport(user, fixture), /Administrator/);
    const preview = store.previewImport(admin, fixture);
    assert.deepEqual(preview.report.errors, []);
    assert.equal(store.search(user, '1" PVC').length, 0, 'dry run must not populate the catalog');
    assert.throws(() => store.applyImport(admin, String(preview.id), 'approved', true), /review confirmation/);
    assert.throws(() => store.applyImport(admin, String(preview.id), 'I reviewed this batch', false), /fixtures/);
    store.applyImport(admin, String(preview.id), 'I reviewed this batch', true);
    assert.equal(store.applyImport(admin, String(preview.id), 'I reviewed this batch', true).unchanged, true);
    assert.equal(store.search(user, '1" PVC').length, 3);
    assert.equal(store.search(user, '2 inch PVC').length, 0);
    assert.equal(store.search(user, 'self tappers').length, 0);
    assert.equal(store.search({ ...user, tenant: 'different-tenant' }, 'PVC').length, 0);
    const records = parse(store.exportCsv(admin), { columns: true }) as Record<string, string>[];
    assert.equal(records.length, 4);
    assert.equal(records[0].manufacturer_part_number, '');
    const conflicting = fixture.replace('fixture-pvc-40', 'changed-key');
    assert.ok(store.previewImport(admin, conflicting).report.errors.some(e => e.message.includes('conflict')));
    store.rollbackImport(admin, String(preview.id));
    assert.equal(store.search(user, '1 inch PVC').length, 0);
    assert.equal(store.db.prepare('SELECT count(*) n FROM materials').get()!.n, 4, 'history retained');
    assert.equal(store.rollbackImport(admin, String(preview.id)).unchanged, true);
  } finally { store.db.close(); }
});

test('CSV rejects duplicates, malformed units/JSON, guessed conversions and unsafe provenance; export escapes formulas reversibly', () => {
  const store = new Store(':memory:');
  try {
    const rows = parse(fixture, { columns: true }) as Record<string, string>[];
    const reportFor = (row: Record<string, string>) => store.parseImport(stringify([row], { header: true })).report;
    assert.ok(reportFor({ ...rows[0], product_uom: 'GUESSED' }).errors.length);
    assert.ok(reportFor({ ...rows[0], conversion_basis_json: '{"sticksToFeet":10}' }).errors.length);
    assert.ok(reportFor({ ...rows[0], aliases_json: '{}' }).errors.length);
    assert.ok(reportFor({ ...rows[0], dataset_kind: 'reviewed', source_url: '' }).errors.length);
    assert.ok(reportFor({ ...rows[0], source_url: 'javascript:alert(1)' }).errors.length);
    assert.ok(store.parseImport(stringify([rows[0], rows[0]], { header: true })).report.errors.some(e => e.message.includes('Duplicate')));
    const csv = stringify([{ ...rows[0], manufacturer: '=1+1' }], { header: true });
    const preview = store.previewImport(admin, csv);
    store.applyImport(admin, String(preview.id), 'I reviewed this batch', true);
    const exported = store.exportCsv(admin);
    assert.equal((parse(exported, { columns: true }) as Record<string, string>[])[0].manufacturer, "'=1+1");
    assert.equal(store.parseImport(exported).rows[0].manufacturer, '=1+1');
  } finally { store.db.close(); }
});

test('HTTP API enforces ownership/RBAC, validates snapshots, preserves dates, and survives process/store restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'etalonops-api-'));
  const path = join(directory, 'test.sqlite');
  let store = new Store(path);
  const preview = store.previewImport(admin, fixture);
  store.applyImport(admin, String(preview.id), 'I reviewed this batch', true);
  const server = createApp(store, { mode: 'local' }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(path: string, method = 'GET', token?: string, data?: unknown, extraHeaders = {}) {
    const response = await fetch(base + path, { method, headers: { ...extraHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const body = response.status === 204 ? null : await response.json();
    return { response, body };
  }
  try {
    const alice = (await call('/api/dev/session', 'POST', undefined, { identity: 'foreman-one' })).body.token;
    const bob = (await call('/api/dev/session', 'POST', undefined, { identity: 'foreman-two' })).body.token;
    assert.equal((await call('/api/materials?q=PVC')).response.status, 401);
    const parts = alice.split('.');
    parts[1] = Buffer.from(JSON.stringify({ tid: 'evil', oid: 'admin', roles: ['Admin'] })).toString('base64url');
    assert.equal((await call('/api/materials?q=PVC', 'GET', parts.join('.'))).response.status, 401);
    assert.equal((await call('/api/admin/imports/preview', 'POST', alice, { csv: fixture })).response.status, 403);
    assert.equal((await call('/api/admin/imports/x/rollback', 'POST', alice)).response.status, 403);
    assert.equal((await call('/api/admin/memberships', 'POST', alice, { objectId: 'someone', projectId: 'riverside' })).response.status, 403);
    assert.equal((await call('/api/dev/session', 'POST', undefined, { identity: 'foreman-one' }, { Origin: 'https://evil.example' })).response.status, 403);
    const candidate = (await call('/api/materials?q=1%22%20PVC', 'GET', alice)).body.matches[0];
    const item = { id: randomUUID(), quantity: '1000', requestedUnit: 'FT', description: candidate.description, rawInput: { quantity: '1000', description: '1" PVC', requestedUnit: 'FT' }, candidate, source: 'verified_fixture', deliveryMode: 'inherit', overrideDate: null };
    const body = { projectId: 'riverside', deliveryDate: '2026-11-10', version: 0, lines: [item, { ...item, id: randomUUID(), deliveryMode: 'override', overrideDate: '2026-11-15' }] };
    assert.equal((await call('/api/drafts', 'POST', alice, { ...body, ownerId: 'foreman-two' })).response.status, 400);
    assert.equal((await call('/api/drafts', 'POST', alice, { ...body, lines: [{ ...item, candidate: { ...candidate, description: 'forged product' } }] })).response.status, 400);
    const saved = await call('/api/drafts', 'POST', alice, body);
    assert.equal(saved.response.status, 201);
    const draft = saved.body.draft;
    assert.equal((await call(`/api/drafts/${draft.id}`, 'GET', bob)).response.status, 404);
    assert.equal((await call(`/api/drafts/${draft.id}`, 'PUT', bob, { ...body, version: 1 })).response.status, 404);
    assert.equal((await call('/api/projects/riverside/draft', 'GET', bob)).body.draft, null);
    assert.equal((await call('/api/projects/secret/draft', 'GET', alice)).response.status, 404);
    assert.equal((await call(`/api/drafts/${draft.id}`, 'PUT', alice, body)).response.status, 409);
    const changed = await call(`/api/drafts/${draft.id}`, 'PUT', alice, { ...body, version: 1, deliveryDate: '2026-11-12' });
    assert.equal(changed.body.draft.lines[0].overrideDate, null);
    assert.equal(changed.body.draft.lines[1].overrideDate, '2026-11-15');
    assert.equal(changed.body.draft.lines[0].quantity, '1000');
    assert.equal(changed.body.draft.lines[0].requestedUnit, 'FT');
    assert.equal(changed.body.draft.lines[0].candidate.productUnit, 'STICK');
    const fallback = { ...item, id: randomUUID(), description: 'my original self tappers', candidate: null, source: 'user_description' };
    const withFallback = await call(`/api/drafts/${draft.id}`, 'PUT', alice, { ...body, lines: [fallback], version: 2 });
    assert.equal(withFallback.response.status, 200);
    assert.equal(store.db.prepare('SELECT count(*) n FROM materials').get()!.n, 4);
    assert.ok(store.db.prepare("SELECT count(*) n FROM audit_events WHERE action='draft.saved'").get()!.n);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    store.db.close();
    store = new Store(path);
    const restored = store.getProjectDraft(user, 'riverside');
    assert.equal(restored!.lines[0].description, 'my original self tappers');
    assert.equal(restored!.version, 3);
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    store.db.close(); rmSync(directory, { recursive: true, force: true });
  }
});

test('rollback preserves referenced catalog lines and permits later draft saves', () => {
  const store = new Store(':memory:');
  try {
    store.member(user, 'riverside');
    const preview = store.previewImport(admin, fixture);
    store.applyImport(admin, String(preview.id), 'I reviewed this batch', true);
    const candidate = store.search(user, '1 inch pvc')[0];
    const line = { id: randomUUID(), quantity: '12', requestedUnit: 'FT', description: String(candidate.description), rawInput: { quantity: '12', description: '1 inch pvc', requestedUnit: 'FT' }, candidate, source: 'verified_fixture', deliveryMode: 'inherit', overrideDate: null };
    // Use the same boundary schema as HTTP clients.
    return import('./contracts').then(({ draftBody }) => {
      const body = draftBody.parse({ projectId: 'riverside', deliveryDate: '2026-11-10', version: 0, lines: [line] });
      const saved = store.saveDraft(user, body);
      store.rollbackImport(admin, String(preview.id));
      assert.equal(store.getDraft(user, String(saved.id)).lines.length, 1);
      store.saveDraft(user, { ...body, version: 1, deliveryDate: '2026-11-12' }, String(saved.id));
      assert.equal(store.search(user, '1 inch pvc').length, 0);
    }).finally(() => store.db.close());
  } catch (error) { store.db.close(); throw error; }
});
