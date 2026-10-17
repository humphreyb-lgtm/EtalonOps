import { readFileSync } from 'node:fs';
import type sql from 'mssql';
export function localSqlConfig(admin = false, database = process.env.ETALONOPS_SQL_DATABASE ?? 'EtalonOps'): sql.config {
  if (!['EtalonOps', 'EtalonOpsSqlTests'].includes(database) && !(admin && database === 'master')) throw new Error('Only isolated local EtalonOps databases are allowed by this configuration.');
  const root = new URL('../.runtime/sqlserver/', import.meta.url);
  const secrets = JSON.parse(readFileSync(new URL('control.json', root), 'utf8'));
  return {
    server: 'localhost', port: 1433, database,
    user: admin ? 'sa' : 'etalonops_local_app', password: admin ? secrets.saPassword : secrets.appPassword,
    connectionTimeout: 3000, requestTimeout: 15000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 1000 },
    options: { encrypt: true, trustServerCertificate: false, cryptoCredentialsDetails: { ca: readFileSync(new URL('ca.crt', root), 'utf8') } },
  };
}
