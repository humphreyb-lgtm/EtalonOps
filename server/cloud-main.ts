import sql from 'mssql';
import { createCloudApp } from './cloud-app';
import { SqlStore } from './sql-store';
import { cloudConfig } from './cloud-config';

const config = cloudConfig();
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port.');
const pool = await new sql.ConnectionPool(config.sql).connect();
const store = new SqlStore(pool); store.engine = 'Azure SQL';
const app = createCloudApp(store, config, process.env.WEBSITE_HOSTNAME ?? '');
const server = app.listen(port, '0.0.0.0', () => console.log('EtalonOps cloud runtime ready; Entra required; AI disabled.'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await pool.close(); process.exit(0); }));
