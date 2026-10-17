import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Store } from './store';
import { createApp } from './app';

test('catalog history and record previews are admin-only, tenant-isolated and preserve import state', async () => {
  const store = new Store(':memory:');
  const owner = { tenant: 'other-tenant', oid: 'admin', roles: ['Admin'] };
  const csv = readFileSync(new URL('../db/fixtures/catalog.csv', import.meta.url), 'utf8');
  store.previewImport(owner, csv);
  const server = createApp(store, { mode: 'local' }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  async function session(identity: string) { return (await (await fetch(base+'/api/dev/session', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity}) })).json()).token; }
  try {
    const foreman = await session('foreman-one'), admin = await session('admin');
    for (const token of [null,foreman]) assert.equal((await fetch(base+'/api/admin/imports', { headers: token ? {Authorization:`Bearer ${token}`} : {} })).status,token ? 403 : 401);
    const headers = { Authorization:`Bearer ${admin}`, 'Content-Type':'application/json' };
    const history = () => fetch(base+'/api/admin/imports', {headers}).then(r=>r.json());
    assert.deepEqual((await history()).batches,[]);
    const previewResponse = await fetch(base+'/api/admin/imports/preview', {method:'POST',headers,body:JSON.stringify({csv})});
    assert.equal(previewResponse.status,200);
    const preview = await previewResponse.json();
    assert.equal(preview.records.length,4);
    assert.equal(preview.report.kind,'fixture');
    assert.equal((await history()).batches[0].state,'preview');
    const apply = await fetch(`${base}/api/admin/imports/${preview.id}/apply`, {method:'POST',headers,body:JSON.stringify({approval:'I reviewed this batch'})});
    assert.equal(apply.status,200);
    assert.equal((await history()).batches[0].state,'applied');
    assert.equal((await history()).batches[0].reviewer,'admin');
    const foreignId = store.listImports(owner)[0].id;
    assert.equal((await fetch(`${base}/api/admin/imports/${foreignId}/rollback`, {method:'POST',headers})).status,404);
    await fetch(`${base}/api/admin/imports/${preview.id}/rollback`, {method:'POST',headers});
    assert.equal((await history()).batches[0].state,'rolled_back');
    assert.equal(store.listImports(owner)[0].state,'preview');
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); store.db.close(); }
});
