import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Store} from './store';
import {score} from './search';
import {searchConstraints} from './search-constraints';
import {searchGuidance} from '../src/search-guidance';
import {reconcilePackage,packageSchema} from '../scripts/publication-import/core';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/strut-search-coverage.json',import.meta.url),'utf8'));
test('reviewed strut coverage: all 666 queries and exclusions across 297 real material identities',()=>{
 const s=new Store(':memory:'),p={tenant:'strut-coverage-test',oid:'review',roles:['Admin']};
 try{
 const refs=new Map<string,string>();
 for(const record of fixture.records){const m=s.catalogCommand(p,'material',record.material);refs.set(m.id,record.ref);for(const phrase of record.phrases)s.catalogCommand(p,'translation',{materialKey:record.material.externalKey,phrase,origin:'admin_reviewed'});}
 for(const test of fixture.queries){const matches=s.search(p,test.q),actual=matches.map((m:any)=>refs.get(m.id));
  if(test.behavior==='return_match'||test.behavior==='return_multiple'){
   for(const ref of test.expected)assert.ok(actual.includes(ref),`${test.q}: missing ${ref}`);
   for(const ref of test.excluded)assert.ok(!actual.includes(ref),`${test.q}: conflicting ${ref}`);
  }else if(test.behavior==='no_match')assert.equal(actual.length,0,test.q);
  else {assert.ok(searchGuidance(test.q),`Clarification advice missing: ${test.q}`);if(/brand only|B825|P1377/i.test(test.q))assert.equal(actual.length,0,test.q);}
 }
 const snapshot=s.catalogCommand(p,'export-snapshot',{}),before=JSON.stringify(snapshot.tables.materials);
 const data=packageSchema.parse({format:'etalonops-publication-import-v1',source:'test',mode:'translations-only',expectedTenantHash:'0'.repeat(64),held:0,records:fixture.records.map((r:any)=>({ref:r.ref,originalKey:'',row:{description:'MUST NOT OVERWRITE'},material:r.material,phrases:r.phrases.slice(0,90)}))});
 const prepared=reconcilePackage(data,snapshot);assert.equal(prepared.matches.length,297);assert.ok(prepared.prepared.every(r=>r.key&&!r.description&&!r.image));assert.equal(JSON.stringify(snapshot.tables.materials),before);
 assert.throws(()=>reconcilePackage(data,{...snapshot,tables:{...snapshot.tables,materials:snapshot.tables.materials.slice(1)}}),/Finish the original material import/);
 }finally{s.db.close();}
});
test('dimension equivalence and explicit requirements apply beyond installed aliases',()=>{
 for(const [q,p]of [['1-5/8 strut','1.625 inch strut'],['1⅝ strut','1 5/8 strut'],['1/2-13 spring nuts','0.5-13 spring nut'],['1.625 by 0.875 inches channel','1-5/8 x 7/8 in. channel'],['strut 10 feet','strut 10 ft.']])assert.ok(score(q,p)>=85,`${q} / ${p}`);
 for(const [q,p]of [['13/16 cap','7/8 cap'],['1/2-20 nut','1/2-13 nut'],['strut PG','strut HG'],['AB-123','AB-124']])assert.equal(score(q,p),0);
 assert.ok(searchConstraints('1/2-20 spring nut',{threadSize:'1/2',threadPitch:'13'}).conflicts.length);
 assert.ok(searchConstraints('1 inch EMT strut clamp',{type:'strut conduit clamp',conduitSystem:'rigid'}).conflicts.length);
});
