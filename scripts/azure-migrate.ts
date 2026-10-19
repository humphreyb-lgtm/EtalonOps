import { principalRepair } from '../server/sql-principal';
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
  for(const [version,file] of [[2,'002-catalog.sql'],[3,'003-translation-evidence.sql'],[4,'004-catalog-revisions.sql'],[5,'005-named-drafts.sql'],[6,'006-user-access.sql'],[7,'007-mrf-submissions.sql'],[8,'008-product-details.sql'],[9,'009-material-categories.sql'],[10,'010-mrf-foreman.sql'],[11,'011-line-task-code.sql']] as const){
    const migration=readFileSync(`db/${file}`,'utf8'), checksum=createHash('sha256').update(migration).digest('hex');
    const prior=(await pool.request().input('version',sql.Int,version).query('SELECT checksum FROM dbo.migration_checksums WHERE version=@version')).recordset[0];
    if(prior&&prior.checksum!==checksum)throw new Error('Applied catalog migration checksum changed.');
    await pool.request().batch(migration);
    await pool.request().input('version',sql.Int,version).input('checksum',sql.VarChar(64),checksum).query('IF NOT EXISTS(SELECT 1 FROM dbo.migration_checksums WHERE version=@version) INSERT dbo.migration_checksums VALUES(@version,@checksum)');
  }
  // Azure RBAC uses the principal OBJECT ID; SQL external SID requires its CLIENT ID.
  const liveObject=execFileSync('az',['webapp','identity','show','-g',state.resourceGroup,'-n',state.appName,'--query','principalId','-o','tsv'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  if(liveObject.toLowerCase()!==String(state.runtimePrincipal).toLowerCase())throw new Error('Runtime managed identity changed; stopped before changing SQL permissions.');
  const identity=JSON.parse(execFileSync('az',['ad','sp','show','--id',liveObject,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  if(String(identity.id).toLowerCase()!==liveObject.toLowerCase())throw new Error('Managed identity lookup did not match the pilot.');
  const tables=['memberships','import_batches','materials','aliases','drafts','draft_lines','image_associations','catalog_profiles','manufacturers','manufacturer_products','translations','selection_events','job_restrictions','catalog_batches','image_references','material_categories'];
  const transaction=pool.transaction();await transaction.begin();
  try{
    const request=()=>new sql.Request(transaction);
    await request().query("DECLARE @result int; EXEC @result=sp_getapplock @Resource='EtalonOpsRuntimePrincipal',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; IF @result<0 THROW 51000,'Runtime principal repair lock unavailable.',1;");
    const existing=(await request().query("SELECT type,CONVERT(varchar(34),sid,1) AS sid FROM sys.database_principals WHERE name='etalonops_runtime'")).recordset[0];
    const legacy=(await request().query("SELECT principal_id FROM sys.database_principals WHERE name='etalonops_runtime_legacy_oid'")).recordset[0];
    const repair=principalRepair(existing,liveObject,identity.appId,Boolean(legacy));
    if(repair.replaceLegacy){
      const owned=(await request().query("SELECT name FROM sys.schemas WHERE principal_id=USER_ID('etalonops_runtime') UNION ALL SELECT name FROM sys.objects WHERE principal_id=USER_ID('etalonops_runtime') UNION ALL SELECT 'role membership' FROM sys.database_role_members WHERE member_principal_id=USER_ID('etalonops_runtime')")).recordset;
      if(owned.length)throw new Error('Runtime principal has unexpected ownership or roles; stopped without changing it.');
      // DROP USER removes only the verified, non-owning security principal.
      // Recreate and restore restricted grants in this same transaction.
      await request().query('DROP USER etalonops_runtime');
    }
    if(repair.create)await request().query(`CREATE USER etalonops_runtime WITH SID=${repair.sid}, TYPE=E`);
    for(const table of tables)await request().query(`GRANT SELECT,INSERT,UPDATE,DELETE ON dbo.${table} TO etalonops_runtime`);
    await request().query('GRANT SELECT,INSERT ON dbo.audit_events TO etalonops_runtime; GRANT SELECT ON dbo.schema_migrations TO etalonops_runtime;');
    await request().query('GRANT SELECT,INSERT ON dbo.catalog_revisions TO etalonops_runtime; GRANT SELECT,INSERT ON dbo.mrf_submissions TO etalonops_runtime; GRANT SELECT,INSERT ON dbo.user_access_changes TO etalonops_runtime; GRANT SELECT,INSERT,UPDATE ON dbo.application_users TO etalonops_runtime; REVOKE DELETE ON dbo.application_users FROM etalonops_runtime');
    await transaction.commit();
    console.log('SQL runtime identity verified against the managed identity client ID; restricted grants preserved.');
  }catch(error){try{await transaction.rollback();}catch{}throw error;}
  for (const project of ['riverside', 'northside']) await pool.request().input('tenant', state.tenant).input('owner', state.ownerId).input('project', project).query('IF NOT EXISTS(SELECT 1 FROM dbo.application_users WHERE tenant=@tenant AND oid=@owner) AND NOT EXISTS(SELECT 1 FROM dbo.memberships WHERE tenant=@tenant AND owner=@owner AND project=@project) INSERT dbo.memberships VALUES(@tenant,@owner,@project)');
  console.log('Cloud schema checksum verified; restricted runtime identity and pilot owner memberships prepared. No fixture catalog imported.');
} finally { await pool.close(); }
