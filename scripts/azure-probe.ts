import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import sql from 'mssql';
const s = JSON.parse(readFileSync('.runtime/azure-deployment.json', 'utf8'));
let token: string;
try { token = execFileSync('az', ['account','get-access-token','--resource','https://database.windows.net/','--query','accessToken','-o','tsv'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim(); }
catch { throw new Error('Azure SQL access token unavailable. Reauthenticate only through the Azure portal/Cloud Shell.'); }
const pool = new sql.ConnectionPool({ server: `${s.sqlName}.database.windows.net`, database: 'EtalonOps', authentication: { type: 'azure-active-directory-access-token', options: { token } }, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 30000 });
try { await pool.connect(); console.log('already-allowed'); }
catch (error) {
  const message = error instanceof Error ? error.message : '';
  const match = message.match(/Client with IP address '([\d.]+)'/i);
  if (!match) throw new Error('Azure SQL did not report the Cloud Shell source address. Firewall access was not broadened.');
  console.log(match[1]);
} finally { await pool.close(); }
