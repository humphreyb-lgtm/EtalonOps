import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stringify} from 'csv-stringify/sync';
import {parseExtendedCsv} from './catalog-v2';
const csv=(records:Record<string,unknown>[],columns?:string[])=>stringify(records,{header:true,bom:true,columns});
const material={kind:'material',externalKey:'00001',category:'conduit',productUnit:'STICK',verification:'provisional',origin:'ai_import',sourceUrl:'https://example.invalid/pvc',verificationBasis:'Synthetic source used for import testing only.',diameterIn:'1',material:'PVC',type:'conduit',schedule:'40',lengthIn:'120',endConnection:'plain'};
test('Excel-friendly columns preserve identifiers and quoted phrases and use the existing domain validation',()=>{
 const report=parseExtendedCsv(csv([material]));assert.deepEqual(report.errors,[]);const data=report.records[0].data as any;assert.equal(data.externalKey,'00001');assert.equal(data.attributes.diameterIn,1);assert.equal(data.attributes.lengthIn,120);assert.equal(data.attributes.schedule,'40');assert.equal(data.origin,'ai_import');
 const product=parseExtendedCsv(csv([{kind:'product',materialKey:'00001',manufacturer:'Test Maker',partNumber:'001E02',title:'Synthetic product',sourceUrl:'https://example.invalid/product',verification:'provisional',origin:'ai_import'}]));assert.deepEqual(product.errors,[]);assert.equal((product.records[0].data as any).partNumber,'001E02');
 const phrase='1" PVC, schedule 40\n10 foot stick';const translations=parseExtendedCsv(csv([{kind:'translation',materialKey:'00001',phrase,origin:'ai_generated',sourceUrl:'https://example.invalid/product'}]));assert.deepEqual(translations.errors,[]);assert.equal((translations.records[0].data as any).phrase,phrase);
});
test('spreadsheet blanks are ignored without changing record row locations or limits',()=>{
 const file=csv([material,{}, {...material,externalKey:'00002',lengthIn:'10 feet'}],Object.keys(material));const report=parseExtendedCsv(file);assert.equal(report.rowCount,2);assert.equal(report.records.length,1);assert.equal(report.errors[0].row,4);assert.match(report.errors[0].message,/decimal inches/);
 assert.equal(parseExtendedCsv(csv([material,...Array(2100).fill({})],Object.keys(material))).rowCount,1);
});
test('spreadsheet imports reject misspelled columns, duplicate headers, formulas in dimensions and missing provenance',()=>{
 for(const row of [{...material,diameterIn:'=1/2'},{...material,origin:''},{...material,brand:'Some Brand'},{...material,lengthIn:'1e2'}])assert.ok(parseExtendedCsv(csv([row])).errors.length);
 assert.match(parseExtendedCsv('kind,kind\nmaterial,material\n').errors[0].message,/unique/);
 assert.ok(parseExtendedCsv(csv([{...material,verification:'reviewed'}])).records.length); // AI/review conflicts are checked by the real preview/apply layer, not claimed verified by parsing.
});
test('column duplicates still trigger canonical identity checks and legacy JSON remains supported',()=>{
 const result=parseExtendedCsv(csv([material,{...material,externalKey:'different-key'}]));assert.equal(result.errors.length,1);assert.match(result.errors[0].message,/identity/);
 const legacy=parseExtendedCsv(csv([{kind:'translation',data_json:JSON.stringify({materialKey:'00001',phrase:'PVC stick',origin:'admin_reviewed'})}]));assert.deepEqual(legacy.errors,[]);assert.equal((legacy.records[0].data as any).phrase,'PVC stick');
 const custom=parseExtendedCsv(csv([{...material,'attribute.color':'gray'}]));assert.deepEqual(custom.errors,[]);assert.equal((custom.records[0].data as any).attributes.color,'gray');
});
