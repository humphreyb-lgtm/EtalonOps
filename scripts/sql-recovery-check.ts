import sql from 'mssql';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { localSqlConfig } from '../server/sql-config';

// The drill touches only the isolated fixture database and a new temporary restore.
const pool = await new sql.ConnectionPool(localSqlConfig(true, 'master')).connect();
const suffix = randomBytes(8).toString('hex');
const restore = `EtalonOpsRestoreCheck_${suffix}`;
const file = `/var/opt/mssql/data/etalonops-test-${suffix}.bak`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
let restored = false;
try {
  const catalogTables=['catalog_profiles','manufacturers','manufacturer_products','translations','selection_events','job_restrictions','catalog_batches','image_references','catalog_revisions','application_users','user_access_changes','mrf_submissions'];
  const catalogCounts=(db:string)=>catalogTables.map(table=>`(SELECT COUNT(*) FROM [${db}].dbo.${table}) AS [${table}]`).join(',');
  const beforeCatalog=(await pool.request().query(`SELECT ${catalogCounts('EtalonOpsSqlTests')}`)).recordset[0];
  const before = await pool.request().query('SELECT (SELECT COUNT(*) FROM EtalonOpsSqlTests.dbo.materials) AS materials,(SELECT COUNT(*) FROM EtalonOpsSqlTests.dbo.drafts) AS drafts,(SELECT COUNT(*) FROM EtalonOpsSqlTests.dbo.draft_lines) AS lines,(SELECT COUNT(*) FROM EtalonOpsSqlTests.dbo.image_associations) AS images,(SELECT COUNT(*) FROM EtalonOpsSqlTests.dbo.audit_events) AS audits');
  assert.ok(before.recordset[0].materials > 0 && before.recordset[0].drafts > 0, 'Run the SQL integration suite first; an empty restore is not a recovery demonstration.');
  await pool.request().query(`BACKUP DATABASE EtalonOpsSqlTests TO DISK=${literal(file)} WITH COPY_ONLY,CHECKSUM`);
  await pool.request().query(`RESTORE VERIFYONLY FROM DISK=${literal(file)} WITH CHECKSUM`);
  const files = (await pool.request().query(`RESTORE FILELISTONLY FROM DISK=${literal(file)}`)).recordset;
  assert.equal(files.length, 2, 'This small POC drill expects one data and one log file.');
  const data = files.find(row => row.Type === 'D'), log = files.find(row => row.Type === 'L');
  assert.ok(data && log);
  await pool.request().query(`RESTORE DATABASE [${restore}] FROM DISK=${literal(file)} WITH MOVE ${literal(data.LogicalName)} TO ${literal(`/var/opt/mssql/data/${restore}.mdf`)}, MOVE ${literal(log.LogicalName)} TO ${literal(`/var/opt/mssql/data/${restore}.ldf`)}, CHECKSUM`);
  restored = true;
  const after = await pool.request().query(`SELECT (SELECT COUNT(*) FROM [${restore}].dbo.materials) AS materials,(SELECT COUNT(*) FROM [${restore}].dbo.drafts) AS drafts,(SELECT COUNT(*) FROM [${restore}].dbo.draft_lines) AS lines,(SELECT COUNT(*) FROM [${restore}].dbo.image_associations) AS images,(SELECT COUNT(*) FROM [${restore}].dbo.audit_events) AS audits`);
  assert.deepEqual(after.recordset[0], before.recordset[0]);
  assert.deepEqual((await pool.request().query(`SELECT ${catalogCounts(restore)}`)).recordset[0],beforeCatalog);
  await pool.request().query(`DBCC CHECKDB ([${restore}]) WITH NO_INFOMSGS`);
  console.log('SQL native backup checksum, restore, relational data counts and CHECKDB passed. Original databases retained.');
} finally {
  if (restored) await pool.request().query(`DROP DATABASE [${restore}]`);
  await pool.close();
}
