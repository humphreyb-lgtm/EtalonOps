// Runs only inside the owner's authenticated Azure Cloud Shell. No token output.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sql from 'mssql';
const state = JSON.parse(readFileSync('.runtime/azure-deployment.json', 'utf8'));
const expected = JSON.parse(execFileSync('az', ['account', 'show', '--output', 'json'], { encoding: 'utf8' }));
if (expected.id !== state.subscription || expected.tenantId !== state.tenant) throw new Error('Azure account does not match deployment state.');
let token: string;
try { token = execFileSync('az', ['account', 'get-access-token', '--resource', 'https://database.windows.net/', '--query', 'accessToken', '--output', 'tsv'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
catch { throw new Error('Azure SQL access token unavailable. Reauthenticate only through the Azure portal/Cloud Shell.'); }
const pool = await new sql.ConnectionPool({ server: `${state.sqlName}.database.windows.net`, database: 'EtalonOps', authentication: { type: 'azure-active-directory-access-token', options: { token } }, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 30_000, requestTimeout: 60_000 }).connect();
try {
  const migration = readFileSync('db/001-azure-sql.sql', 'utf8'), checksum = createHash('sha256').update(migration).digest('hex');
  const ledger = await pool.request().query("SELECT OBJECT_ID('dbo.migration_checksums') AS id");
  if (ledger.recordset[0].id) {
    const prior = await pool.request().query('SELECT checksum FROM dbo.migration_checksums WHERE version=1');
    if (prior.recordset[0] && prior.recordset[0].checksum !== checksum) throw new Error('Applied migration changed. Refusing to overwrite history.');
  }
  await pool.request().batch(migration);
  await pool.request().query('IF OBJECT_ID(\'dbo.migration_checksums\') IS NULL CREATE TABLE dbo.migration_checksums(version int PRIMARY KEY,checksum char(64) NOT NULL)');
  await pool.request().input('checksum', sql.VarChar(64), checksum).query('IF NOT EXISTS(SELECT 1 FROM dbo.migration_checksums WHERE version=1) INSERT dbo.migration_checksums VALUES(1,@checksum)');
  if (!/^[a-f\d-]{36}$/i.test(state.runtimePrincipal)) throw new Error('Invalid managed identity ID.');
  // Azure SQL supports contained external users with an explicit object SID.
  // This avoids giving the SQL server identity directory-wide Graph read access.
  const hex = state.runtimePrincipal.replaceAll('-', '');
  const sid = hex.slice(6,8)+hex.slice(4,6)+hex.slice(2,4)+hex.slice(0,2)+hex.slice(10,12)+hex.slice(8,10)+hex.slice(14,16)+hex.slice(12,14)+hex.slice(16);
  await pool.request().query(`IF USER_ID('etalonops_runtime') IS NULL CREATE USER etalonops_runtime WITH SID=0x${sid}, TYPE=E`);
  for (const table of ['memberships', 'import_batches', 'materials', 'aliases', 'drafts', 'draft_lines', 'image_associations']) await pool.request().query(`GRANT SELECT,INSERT,UPDATE,DELETE ON dbo.${table} TO etalonops_runtime`);
  await pool.request().query('GRANT SELECT,INSERT ON dbo.audit_events TO etalonops_runtime; GRANT SELECT ON dbo.schema_migrations TO etalonops_runtime;');
  for (const project of ['riverside', 'northside']) await pool.request().input('tenant', state.tenant).input('owner', state.ownerId).input('project', project).query('IF NOT EXISTS(SELECT 1 FROM dbo.memberships WHERE tenant=@tenant AND owner=@owner AND project=@project) INSERT dbo.memberships VALUES(@tenant,@owner,@project)');
  console.log('Cloud schema checksum verified; restricted runtime identity and pilot owner memberships prepared. No fixture catalog imported.');
} finally { await pool.close(); }
