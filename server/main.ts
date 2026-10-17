import { chmodSync, readFileSync } from 'node:fs';
import { createApp } from './app';
import { Store } from './store';
import sql from 'mssql';
import { SqlStore } from './sql-store';
import { FileImageAssets } from './image-assets';
import { localSqlConfig } from './sql-config';

// Local persistence is opt-in. Never silently enable test sign-in in a deployment.
if (process.env.ETALONOPS_AUTH_MODE !== 'local') throw new Error('This local launcher requires ETALONOPS_AUTH_MODE=local. Azure/Entra deployment is not configured.');
process.umask(0o077);
const path = process.env.ETALONOPS_DB_PATH ?? '.runtime/etalonops.sqlite';
const engine = process.env.ETALONOPS_DB_ENGINE ?? 'sqlite';
if (!['sqlite', 'sqlserver'].includes(engine)) throw new Error('Unknown database engine.');
const pool = engine === 'sqlserver' ? await new sql.ConnectionPool(localSqlConfig()).connect() : null;
const store = pool ? new SqlStore(pool) : new Store(path);
if (!pool) chmodSync(path, 0o600);
const admin = { tenant: 'local-development', oid: 'admin', roles: ['Admin'] };
const fixture = readFileSync(new URL('../db/fixtures/catalog.csv', import.meta.url), 'utf8');
const preview = await store.previewImport(admin, fixture);
await store.applyImport(admin, String(preview.id), 'I reviewed this batch', true);
const port = Number(process.env.ETALONOPS_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local API port.');
const server = createApp(store, { mode: 'local' }, { images: new FileImageAssets(process.env.ETALONOPS_IMAGE_DIR ?? '.runtime/images') }).listen(port, '127.0.0.1', () => console.log(`EtalonOps ${store.engine} API ready on port ${port}. Fixture data; test sessions only.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { if (pool) await pool.close(); else if (store instanceof Store) store.db.close(); process.exit(0); }));
