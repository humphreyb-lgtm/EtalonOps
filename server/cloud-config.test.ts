import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudConfig } from './cloud-config';

const valid = { ETALONOPS_STORAGE_ACCOUNT: 'etalonopstest', ETALONOPS_AUTH_MODE: 'entra', ETALONOPS_TENANT_ID: '11111111-1111-4111-8111-111111111111', ETALONOPS_CLIENT_ID: '22222222-2222-4222-8222-222222222222', ETALONOPS_SQL_HOST: 'etalonops-example.database.windows.net', ETALONOPS_AI_ENABLED: 'false' };
test('cloud runtime fails closed without explicit Entra, Azure SQL and disabled-AI configuration', () => {
  for (const name of Object.keys(valid)) {
    const env: NodeJS.ProcessEnv = { ...valid }; delete env[name];
    assert.throws(() => cloudConfig(env));
  }
  assert.throws(() => cloudConfig({ ...valid, ETALONOPS_AUTH_MODE: 'local' }));
  assert.throws(() => cloudConfig({ ...valid, ETALONOPS_SQL_HOST: 'localhost' }));
  assert.throws(() => cloudConfig({ ...valid, ETALONOPS_AI_ENABLED: 'true' }));
  const config = cloudConfig(valid);
  assert.equal(config.sql.options.encrypt, true);
  assert.equal(config.sql.options.trustServerCertificate, false);
  assert.equal(config.sql.authentication.type, 'azure-active-directory-default');
  assert.ok(!('password' in config.sql));
});

test('cloud host serves a dedicated sign-in bridge, rejects spoofed identities and has no local session', async () => {
  const { createCloudApp } = await import('./cloud-app');
  const { Store } = await import('./store');
  const store = new Store(':memory:');
  const config = cloudConfig(valid);
  const server = createCloudApp(store, config, 'etalonops-example.azurewebsites.net').listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as import('node:net').AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const index = await fetch(base);
    assert.match(await index.text(), /runtime-config\.js/);
    assert.match(index.headers.get('content-security-policy')!, /script-src 'self'/);
    assert.equal(index.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    const configResponse = await fetch(base + '/runtime-config.js');
    assert.equal(configResponse.headers.get('cache-control'), 'no-store');
    assert.match(await configResponse.text(), new RegExp(config.clientId));
    assert.equal((await fetch(base + '/auth-callback.html')).status, 200);
    for (const path of ['/api/me', '/api/projects/riverside/draft', '/api/admin/catalog.csv']) {
      assert.equal((await fetch(base + path, { headers: { 'x-ms-client-principal': Buffer.from(JSON.stringify({ roles: ['Admin'] })).toString('base64') } })).status, 401);
      assert.equal((await fetch(base + path, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    }
    assert.equal((await fetch(base + '/api/dev/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"identity":"admin"}' })).status, 401);
    assert.equal((await fetch(base + '/api/drafts', { method: 'POST', headers: { Origin: 'https://foreign.example' } })).status, 403);
    assert.equal((await fetch(base + '/.env')).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); store.db.close(); }
});
