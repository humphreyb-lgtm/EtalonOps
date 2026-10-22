import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareSpecifications as compare} from './specification-search';
test('schedule shorthand separates missing, confirmed and conflicting specifications',()=>{
 for(const q of ['1" PVC 40 coupling','1 inch PVC SCH 40 coupling','1 in. PVC Schedule 40 coupling']){
  const r=compare(q,{diameterIn:1,material:'PVC',type:'coupling'},'1 in. PVC coupling, center stop');assert.deepEqual(r.missing,['Schedule 40 not recorded']);assert.deepEqual(r.conflicts,[]);assert.match(r.retrieval,/coupling/);assert.doesNotMatch(r.retrieval,/40/);
  assert.equal(compare(q,{diameterIn:1,material:'PVC',schedule:'80'}).conflicts.length,1);
  assert.equal(compare(q,{diameterIn:1,material:'PVC',schedule:'40'}).missing.length,0);
 }
});
test('physical dimensions, radius and finish never turn a known conflict into a match',()=>{
 assert.equal(compare('3/4" PVC coupling',{diameterIn:1,material:'PVC'}).conflicts.length,1);
 assert.equal(compare('PVC 90° sweep 18 in radius',{material:'PVC',angleDeg:90,radiusIn:12}).conflicts.length,1);
 assert.equal(compare('PVC 90° sweep 18 in radius',{material:'PVC'}).missing.length,2);
 assert.equal(compare('galv spring nut',{finish:'zinc plated'}).conflicts.length,1);
 assert.equal(compare('10 ft PVC conduit',{lengthIn:120,material:'PVC'}).conflicts.length,0);
 assert.equal(compare('20 ft PVC conduit',{lengthIn:120,material:'PVC'}).conflicts.length,1);
 assert.equal(compare('1/2-13 short spring nut',{springType:'long spring'}).conflicts.length,1);
 assert.match(compare('1/2-13 spring nut',{}).retrieval,/1\/2-13/);
});
