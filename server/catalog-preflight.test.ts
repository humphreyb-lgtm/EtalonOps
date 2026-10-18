import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stringify} from 'csv-stringify/sync';
import {preflightCatalog} from './catalog-preflight';
const kinds=['material','product','translation','image'];
const examples=()=>kinds.map(kind=>({name:kind+'.csv',csv:readFileSync(new URL(`../docs/catalog-starter/${kind}-FICTIONAL-EXAMPLE.csv`,import.meta.url),'utf8')}));
const csv=(kind:string,data:unknown)=>stringify([{kind,data_json:JSON.stringify(data)}],{header:true});
const material={externalKey:'SUPPORT-1',category:'bracket',attributes:{minSpanIn:15.75,maxSpanIn:25,mounting:'stud',material:'steel'},productUnit:'EA',verification:'provisional',origin:'ai_import',sourceUrl:'https://manufacturer.test/bracket',verificationBasis:'Manufacturer specification supports these dimensions.'};
test('complete ordered delivery rehearses relationships and reports placeholder evidence without touching a persistent database',()=>{
 const files=examples(),report=preflightCatalog([...files,files[3]]);
 assert.equal(report.valid,true);assert.deepEqual(report.totals,{materials:1,manufacturers:1,products:1,translations:1,imageReferences:1});assert.equal(report.batches[4].unchanged,1);assert.equal(report.warnings.length,5);assert.deepEqual(report.coverage,[{materialKey:'EXAMPLE-SUPPORT-001',products:1,translations:1}]);
 assert.deepEqual(preflightCatalog(files).totals,report.totals);
});
test('delivery catches unresolved references, malformed rows and incorrect ordering with file locations',()=>{
 const files=examples();const report=preflightCatalog([files[1],files[0],{name:'bad.csv',csv:'kind,data_json\ntranslation,invalid\n'}]);
 assert.equal(report.valid,false);assert.equal(report.totals.materials,0);assert.ok(report.errors.some(e=>e.file==='product.csv'&&e.row===2));assert.ok(report.errors.some(e=>e.file==='material.csv'&&e.message.includes('order')));assert.ok(report.errors.some(e=>e.file==='bad.csv'&&e.row===2));
});
test('cross-file canonical duplicates and manufacturer part conflicts are rejected rather than silently linked',()=>{
 const product={materialKey:'SUPPORT-1',manufacturer:'Maker',partNumber:'PART-1',title:'Support',sourceUrl:'https://manufacturer.test/bracket',verification:'provisional',origin:'ai_import'};
 const report=preflightCatalog([
 {name:'one.csv',csv:csv('material',material)},
 {name:'duplicate.csv',csv:csv('material',{...material,externalKey:'OTHER-KEY'})},
 {name:'different.csv',csv:csv('material',{...material,externalKey:'SUPPORT-2',attributes:{...material.attributes,maxSpanIn:30}})},
 {name:'product.csv',csv:csv('product',product)},
 {name:'conflict.csv',csv:csv('product',{...product,materialKey:'SUPPORT-2'})}]);
 assert.equal(report.valid,false);assert.equal(report.totals.materials,2);assert.equal(report.totals.products,1);assert.ok(report.errors.some(e=>e.file==='duplicate.csv'));assert.ok(report.errors.some(e=>e.file==='conflict.csv'));
});
test('preflight bounds delivery and file sizes',()=>{
 assert.throws(()=>preflightCatalog([]),/1–50/);assert.throws(()=>preflightCatalog(Array(51).fill({name:'x',csv:''})),/1–50/);
 const report=preflightCatalog([{name:'oversize.csv',csv:'x'.repeat(800001)}]);assert.equal(report.valid,false);assert.equal(report.errors[0].file,'oversize.csv');
});
