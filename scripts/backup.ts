import { backup } from 'node:sqlite';
import { existsSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from '../server/store';

if (process.env.ETALONOPS_AUTH_MODE !== 'local') throw new Error('This tool backs up only the local development database.');
process.umask(0o077);
const target = process.argv[2];
if (!target || existsSync(target)) throw new Error('Specify a new backup file; existing files will not be overwritten.');
const source = process.env.ETALONOPS_DB_PATH ?? '.runtime/etalonops.sqlite';
if (resolve(source) === resolve(target)) throw new Error('Backup must differ from the live database.');
const store = new Store(source);
try {
  await backup(store.db, target);
  chmodSync(target, 0o600);
  const check = new Store(target);
  try { if (check.db.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok') throw new Error('Backup integrity check failed.'); }
  finally { check.db.close(); }
  console.log('Consistent local database backup created and integrity-checked.');
} finally { store.db.close(); }
