import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score,normalize } from './search';
test('construction shorthand ranks catalog phrases without changing persistent alias normalization',()=>{
  assert.ok(score('1" PVC sch80','1 in. PVC conduit Schedule 80')>=85);
  assert.equal(score('1" PVC sch80','1 in. PVC conduit Schedule 40'),0);
  assert.ok(score('1/2 EMT','1/2 inch electrical metallic tubing')>=85);
  assert.ok(score('blk galv screws','black galvanized screws')>=85);
  assert.ok(score('I need some self tappers please','self tapping screws')>=85);
  assert.ok(score('½ EMT','1/2 inch electrical metallic tubing')>=85);
  assert.equal(normalize('blk galv'),'blk galv');
});
test('numeric SKUs, fractions, thread gauges and conduit types are never fuzzy-converted',()=>{
  for(const [query,product] of [['AB123 screw','AB124 screw'],['AB-123 screw','AC-123 screw'],['#8 screws','8 inch screws'],['#12 screws','#123 screws'],['1-1/4 conduit','1-1/2 conduit'],['1/2 EMT','1/2 inch flexible metal conduit'],['6-32 screw','8-32 screw']])assert.equal(score(query,product),0,`${query} / ${product}`);
  assert.equal(score('#8 screws','#8 screws'),100);
  assert.ok(score('electrcal tape','electrical tape')>=85);
});
