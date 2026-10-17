import { readFileSync, writeFileSync } from 'node:fs';
import { Store } from '../server/store';

if (process.env.ETALONOPS_AUTH_MODE !== 'local') throw new Error('This CLI operates only on the local development database. Use authenticated Admin APIs for a deployment.');
process.umask(0o077);
const [command, argument, confirmation] = process.argv.slice(2);
const store = new Store(process.env.ETALONOPS_DB_PATH ?? '.runtime/etalonops.sqlite');
const admin = { tenant: 'local-development', oid: 'local-cli-admin', roles: ['Admin'] };
try {
  if (!argument) throw new Error('Usage: catalog preview file.csv | apply batch-id --reviewed | rollback batch-id --confirm-deactivate | export new-file.csv');
  if (command === 'preview') console.log(JSON.stringify(store.previewImport(admin, readFileSync(argument, 'utf8')), null, 2));
  else if (command === 'apply' && confirmation === '--reviewed') console.log(store.applyImport(admin, argument, 'I reviewed this batch', true));
  else if (command === 'rollback' && confirmation === '--confirm-deactivate') console.log(store.rollbackImport(admin, argument));
  else if (command === 'export') { writeFileSync(argument, store.exportCsv(admin), { flag: 'wx', mode: 0o600 }); console.log('Catalog exported; an existing file is never overwritten.'); }
  else throw new Error('Unknown command or missing review/deactivation confirmation.');
} finally { store.db.close(); }
