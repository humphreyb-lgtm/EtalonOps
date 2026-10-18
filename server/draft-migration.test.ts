import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash,randomUUID } from 'node:crypto';
import { Store } from './store';
test('named-draft migration preserves populated legacy drafts, item snapshots, IDs and foreign keys',()=>{
 const dir=mkdtempSync(join(tmpdir(),'etalonops-legacy-drafts-')),path=join(dir,'legacy.sqlite');
 try{
  const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');
  for(const [version,file] of [[1,'001-local.sql'],[2,'002-catalog.sql'],[3,'003-translation-evidence.sql'],[4,'004-catalog-revisions.sql']] as const){const script=readFileSync(new URL(`../db/migrations/${file}`,import.meta.url),'utf8');db.exec(script);db.prepare('INSERT INTO schema_migrations(version,checksum) VALUES(?,?)').run(version,createHash('sha256').update(script).digest('hex'));}
  const id=randomUUID(),line=randomUUID(),p={tenant:'legacy-tenant',oid:'owner',roles:['Foreman']};db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(p.tenant,p.oid,'riverside');
  db.prepare('INSERT INTO drafts VALUES(?,?,?,?,?,?,?)').run(id,p.tenant,p.oid,'riverside','2026-11-10',3,'2026-10-17T12:00:00Z');
  db.prepare('INSERT INTO draft_lines(id,draft_id,position,material_id,quantity,requested_uom,description,raw_input,candidate,source,delivery_mode,override_date,purchasing) VALUES(?,?,0,NULL,?,?,?,?,NULL,?,?,NULL,NULL)').run(line,id,'2.5','EA','Original user part','{"quantity":"2.5","requestedUnit":"EA","description":"Original user part"}','user_description','inherit');db.close();
  const store=new Store(path);const restored=store.getDraft(p,id);assert.equal(restored.name,'Saved MRF - riverside - 2026-11-10');assert.equal(restored.version,3);assert.equal(restored.lines[0].id,line);assert.equal(restored.lines[0].quantity,'2.5');assert.equal(store.db.prepare('PRAGMA foreign_keys').get()!.foreign_keys,1);assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);store.db.close();
  const reopened=new Store(path);assert.equal(reopened.listDrafts(p,'riverside').total,1);assert.equal(reopened.getDraft(p,id).lines.length,1);reopened.db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
