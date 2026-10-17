import sql from 'mssql';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { localSqlConfig } from '../server/sql-config';

const config = localSqlConfig(true, 'master');
const database = process.argv.includes('--tests') ? 'EtalonOpsSqlTests' : 'EtalonOps';
let master: sql.ConnectionPool | undefined;
for (let attempt = 0; attempt < 45; attempt++) {
  const candidate = new sql.ConnectionPool(config);
  try { master = await candidate.connect(); break; }
  catch (error) {
    await candidate.close();
    if (attempt === 44) throw new Error(`SQL Server not ready (${error && typeof error === 'object' && 'code' in error ? error.code : 'connection failed'}). Certificate verification remains enabled.`);
    await setTimeout(1000);
  }
}
if (!master) throw new Error('SQL Server unavailable.');
try {
  // Identifier is selected from two hardcoded local names, never request input.
  await master.request().query(`IF DB_ID('${database}') IS NULL CREATE DATABASE ${database}`);
  // The master connection can be ready while a retained database is recovering.
  for (let attempt = 0; ; attempt++) {
    const status = await master.request().input('name', sql.NVarChar(128), database).query('SELECT state_desc AS state FROM sys.databases WHERE name=@name');
    if (status.recordset[0]?.state === 'ONLINE') break;
    if (attempt >= 59) throw new Error('Retained database did not finish recovery; data was not reset.');
    await setTimeout(1000);
  }
  await master.request().input('password', sql.NVarChar(200), localSqlConfig().password).query("IF NOT EXISTS(SELECT 1 FROM sys.server_principals WHERE name='etalonops_local_app') BEGIN DECLARE @command nvarchar(max)=N'CREATE LOGIN etalonops_local_app WITH PASSWORD='+QUOTENAME(@password,CHAR(39))+N', CHECK_POLICY=ON'; EXEC sp_executesql @command; END");
} finally { await master.close(); }
const admin = await new sql.ConnectionPool(localSqlConfig(true, database)).connect();
try {
  const migration = readFileSync(new URL('../db/001-azure-sql.sql', import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(migration).digest('hex');
  const ledger = await admin.request().query("SELECT OBJECT_ID('dbo.migration_checksums') AS id");
  if (ledger.recordset[0].id) {
    const prior = await admin.request().query('SELECT checksum FROM dbo.migration_checksums WHERE version=1');
    if (prior.recordset[0] && prior.recordset[0].checksum !== checksum) throw new Error('Applied SQL migration checksum changed. Add a new migration rather than modifying history.');
  }
  await admin.request().batch(migration);
  await admin.request().query('IF OBJECT_ID(\'dbo.migration_checksums\') IS NULL CREATE TABLE dbo.migration_checksums(version int PRIMARY KEY,checksum char(64) NOT NULL)');
  await admin.request().input('checksum', sql.VarChar(64), checksum).query('IF NOT EXISTS(SELECT 1 FROM dbo.migration_checksums WHERE version=1) INSERT dbo.migration_checksums VALUES(1,@checksum)');
  await admin.request().query("IF USER_ID('etalonops_local_app') IS NULL CREATE USER etalonops_local_app FOR LOGIN etalonops_local_app");
  for (const table of ['memberships', 'import_batches', 'materials', 'aliases', 'drafts', 'draft_lines', 'image_associations']) await admin.request().query(`GRANT SELECT,INSERT,UPDATE,DELETE ON dbo.${table} TO etalonops_local_app`);
  await admin.request().query('GRANT SELECT,INSERT ON dbo.audit_events TO etalonops_local_app; GRANT SELECT ON dbo.schema_migrations TO etalonops_local_app;');
  const version = await admin.request().query("SELECT CAST(SERVERPROPERTY('ProductVersion') AS varchar(50)) AS version");
  console.log(`SQL Server ${version.recordset[0].version}: migration verified; separate restricted application login prepared.`);
} finally { await admin.close(); }
const runtime = await new sql.ConnectionPool(localSqlConfig(false, database)).connect();
try { await runtime.request().query('SELECT 1 AS ready'); console.log('Application connection ready with certificate verification enabled.'); }
finally { await runtime.close(); }
