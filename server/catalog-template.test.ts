import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Store } from './store';
test('starter example CSVs use the real import contract and retain provisional AI provenance',()=>{
 const store=new Store(':memory:'),p={tenant:'template-check',oid:'admin',roles:['Admin']};
 try{
  for(const kind of ['material','product','translation','image']){
   const csv=readFileSync(new URL(`../docs/catalog-starter/${kind}-FICTIONAL-EXAMPLE.csv`,import.meta.url),'utf8');const preview=store.catalogCommand(p,'preview',{csv});assert.deepEqual(preview.report.errors,[]);store.catalogCommand(p,'apply',{id:preview.id,approval:'I reviewed this batch'});
  }
  const rows=store.catalogCommand(p,'page',{section:'materials'});assert.equal(rows.total,1);const details=store.catalogCommand(p,'details',{id:rows.records[0].id});assert.equal(details.verification,'provisional');assert.equal(details.attributes.recordOrigin,'ai_import');assert.equal(details.products[0].verification,'provisional');
  const images=store.catalogCommand(p,'page',{section:'images'});assert.equal(images.records[0].status,'pending');
 }finally{store.db.close();}
});
