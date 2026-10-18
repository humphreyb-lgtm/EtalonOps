import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stringify } from 'csv-stringify/sync';
import type { Repository } from './repository';
import { draftBody,type Principal } from './contracts';

const material=(externalKey='pvc',schedule='40')=>({externalKey,category:'conduit',attributes:{diameterIn:1,material:'PVC',type:'conduit',schedule,lengthIn:120,endConnection:'plain'},productUnit:'STICK',verification:'provisional',sourceUrl:'https://example.invalid/fictional-specification',verificationBasis:'Synthetic test data, not real manufacturer evidence.'});
const bracket=(externalKey='bracket')=>({externalKey,category:'bracket',attributes:{minSpanIn:15.75,maxSpanIn:25,mounting:'stud',material:'steel'},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/fixture',verificationBasis:'Synthetic test data only; no product claim.'});
const product=(materialKey:string,manufacturer='Fixture Alpha',partNumber='TEST-1624')=>({materialKey,manufacturer,partNumber,title:'Telescoping bracket',sourceUrl:'https://example.invalid/fixture',verification:'provisional'});
function people(){const tenant=`catalog-${randomUUID()}`;return {admin:{tenant,oid:'admin',roles:['Admin']} as Principal,user:{tenant,oid:'user',roles:['Foreman']} as Principal,foreign:{tenant:`other-${randomUUID()}`,oid:'user',roles:['Admin']} as Principal};}
const csv=(kind:string,rows:unknown[])=>stringify(rows.map(data=>({kind,data_json:JSON.stringify(data)})),{header:true});
export const catalogScenarios:{name:string;run:(store:Repository)=>Promise<void>}[]=[
{name:'many-material searches preserve frequency priority, ambiguous phrases and exact brand parts',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const ids:string[]=[];
 for(let i=0;i<40;i++)ids.push((await store.catalogCommand(admin,'material',{externalKey:`group-${i}`,category:'general',attributes:{type:`Fictional grouping item ${i}`,specification:`Synthetic attributes ${i}`},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/spec',verificationBasis:'Synthetic test data, not real specifications.'})).id);
 const phrases=csv('translation',ids.flatMap((_,i)=>[{materialKey:`group-${i}`,phrase:'common stock phrase',origin:'admin_reviewed'},{materialKey:`group-${i}`,phrase:`grouping search ${i}`,origin:'admin_reviewed'}]));
 const batch=await store.catalogCommand(admin,'preview',{csv:phrases});await store.catalogCommand(admin,'apply',{id:batch.id,approval:'I reviewed this batch'});
 await store.catalogCommand(admin,'priority',{materialId:ids[39],highUse:true,preferredProductId:null});
 for(let i=0;i<12;i++)await store.catalogCommand(user,'selection',{eventId:randomUUID(),projectId:'riverside',materialId:ids[7],productId:null,phrase:'common stock phrase'});
 const results=await store.search(user,'common stock phrase','riverside');assert.equal(results.length,20);assert.equal(results[0].id,ids[7]);assert.equal(results[0].useCount,12);assert.equal(results[1].id,ids[39]);assert.ok(results.every(row=>row.score===100));
 const prod=await store.catalogCommand(admin,'product',product('group-37','Fixture A','SCALE-37'));
 const exact=await store.search(user,'Fixture A SCALE-37','riverside');assert.equal(exact.length,1);assert.equal(exact[0].id,ids[37]);assert.equal(exact[0].products[0].id,prod.id);
 assert.equal((await store.search(user,'grouping search 18','riverside'))[0].id,ids[18]);
}},
{name:'export cursor pages preserve composite aliases and SQL GUID ordering without overlap',run:async store=>{
 const {admin,user,foreign}=people();
 const fixture=readFileSync(new URL('../db/fixtures/catalog.csv',import.meta.url),'utf8');const batch=await store.previewImport(admin,fixture);await store.applyImport(admin,batch.id,'I reviewed this batch',true);
 await store.catalogCommand(admin,'material',material('canonical'));await store.catalogCommand(admin,'material',bracket());
 for(const table of ['materials','aliases','catalog_profiles']){
  let cursor:unknown=undefined;const rows:any[]=[];
  do{const page=await store.catalogCommand(admin,'export-page',{table,pageSize:2,...(cursor?{cursor}:{})});assert.ok(page.records.length<=2);rows.push(...page.records);cursor=page.nextCursor;}while(cursor);
  const snapshot=(await store.catalogCommand(admin,'export-snapshot',{})).tables[table];assert.equal(rows.length,snapshot.length);
  const identities=rows.map(row=>table==='aliases'?row.material_id.toLowerCase()+'|'+row.normalized:(row.id??row.material_id).toLowerCase());assert.equal(new Set(identities).size,rows.length);
  assert.ok(rows.every(row=>row.tenant===admin.tenant));assert.equal((await store.catalogCommand(foreign,'export-page',{table})).records.length,0);
 }
 await assert.rejects(async()=>store.catalogCommand(user,'export-page',{table:'materials'}),/Administrator/);
 await assert.rejects(async()=>store.catalogCommand(admin,'export-page',{table:'memberships'}));
 await assert.rejects(async()=>store.catalogCommand(admin,'export-page',{table:'aliases',cursor:{id:randomUUID()}}),/cursor/);
 await assert.rejects(async()=>store.catalogCommand(admin,'export-page',{table:'materials',pageSize:501}));
}},
{name:'job-wide and category manufacturer rules preserve scope and default inactive',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');
 const pvc=await store.catalogCommand(admin,'material',material()),support=await store.catalogCommand(admin,'material',bracket());
 const a=await store.catalogCommand(admin,'product',product('pvc')),b=await store.catalogCommand(admin,'product',product('pvc','Fixture Beta','TEST-B'));
 const bracketB=await store.catalogCommand(admin,'product',product('bracket','Fixture Beta','TEST-BRACKET'));
 const details=await store.catalogCommand(admin,'details',{id:pvc.id});const maker=details.products.find((row:any)=>row.id===a.id).manufacturerId;
 const names=await store.catalogCommand(admin,'page',{section:'manufacturers',manufacturerIds:[maker]});assert.equal(names.total,1);assert.equal(names.records[0].name,'Fixture Alpha');
 assert.equal((await store.catalogCommand(foreign,'page',{section:'manufacturers',manufacturerIds:[maker]})).total,0);
 const input={projectId:'riverside',materialKey:null,category:null,manufacturerIds:[maker],productIds:[]};const rule=await store.catalogCommand(admin,'policy',input);assert.equal(rule.enabled,false);
 const validate=(materialId:string,productId:string,partNumber:string)=>store.catalogCommand(user,'validate-lines',{projectId:'riverside',lines:[{id:randomUUID(),candidate:{id:materialId},purchasing:{productId,manufacturer:'Fixture Beta',partNumber,noSubstitutions:true}}]});
 assert.equal((await validate(support.id,bracketB.id,'TEST-BRACKET')).ready,true);
 await store.catalogCommand(admin,'policy',{...input,id:rule.id,enabled:true});assert.equal((await validate(support.id,bracketB.id,'TEST-BRACKET')).ready,false);
 await store.catalogCommand(admin,'policy',{...input,id:rule.id,category:'conduit',enabled:true});assert.equal((await validate(support.id,bracketB.id,'TEST-BRACKET')).ready,true);assert.equal((await validate(pvc.id,b.id,'TEST-B')).ready,false);
 assert.equal((await store.catalogCommand(admin,'page',{section:'policies',ruleId:rule.id})).total,1);assert.equal((await store.catalogCommand(foreign,'page',{section:'policies',ruleId:rule.id})).total,0);
 const rules=await store.catalogCommand(admin,'page',{section:'policies',ruleScope:'global'});assert.equal(rules.total,1);assert.equal(rules.records[0].category,'conduit');
 await store.catalogCommand(admin,'disable-policy',{id:rule.id});assert.equal((await validate(pvc.id,b.id,'TEST-B')).ready,true);
}},
{name:'staged preview detects duplicate identities and contradictory rows before apply',run:async store=>{
 const {admin}=people();
 const repeated=await store.catalogCommand(admin,'preview',{csv:csv('material',[material('one'),{...material('two'),attributes:{...material().attributes,material:' pvc '}}])});
 assert.equal(repeated.report.errors[0].row,3);assert.match(repeated.report.errors[0].message,/row 2/);
 await assert.rejects(async()=>store.catalogCommand(admin,'apply',{id:repeated.id,approval:'I reviewed this batch'}),/preview errors/);
 assert.equal((await store.catalogCommand(admin,'page',{section:'materials'})).total,0);
 const sameKey=await store.catalogCommand(admin,'preview',{csv:csv('material',[material('same'),material('SAME','80')])});assert.equal(sameKey.report.errors[0].row,3);
 await store.catalogCommand(admin,'material',material('pvc'));
 const products=await store.catalogCommand(admin,'preview',{csv:csv('product',[product('pvc'),{...product('pvc',' fixture alpha ','test-1624'),title:'Conflicting title'}])});assert.equal(products.report.errors[0].row,3);
 const translations=await store.catalogCommand(admin,'preview',{csv:csv('translation',[{materialKey:'pvc',phrase:'PVC stock',origin:'ai_import',sourceUrl:'https://example.invalid/one'},{materialKey:'pvc',phrase:' pvc STOCK ',origin:'ai_import',sourceUrl:'https://example.invalid/two'}])});assert.equal(translations.report.errors[0].row,3);
 const distinct=await store.catalogCommand(admin,'preview',{csv:csv('translation',[{materialKey:'pvc',phrase:'PVC stock',origin:'ai_import',sourceUrl:'https://example.invalid/one'},{materialKey:'pvc',phrase:'PVC stock',origin:'admin_reviewed'}])});assert.equal(distinct.report.errors.length,0);
}},
{name:'admin catalog pages and resumable import previews are bounded, stable and tenant isolated',run:async store=>{
 const {admin,user,foreign}=people();const m=await store.catalogCommand(admin,'material',material());
 const input=csv('translation',Array.from({length:27},(_,i)=>({materialKey:'pvc',phrase:`paged phrase ${i}`,origin:'ai_import',sourceUrl:'https://example.invalid/phrases'})));
 const preview=await store.catalogCommand(admin,'preview',{csv:input});assert.equal(preview.report.errors.length,0);
 const first=await store.catalogCommand(admin,'batch-details',{id:preview.id});assert.equal(first.records.length,25);assert.equal(first.pages,2);assert.equal('sourceCsv' in first,false);assert.equal((await store.catalogCommand(admin,'batch-details',{id:preview.id,includeSource:true})).sourceCsv,input);
 const last=await store.catalogCommand(admin,'batch-details',{id:preview.id,page:999});assert.equal(last.page,2);assert.equal(last.records.length,2);assert.equal(last.records[1].row,28);
 await assert.rejects(async()=>store.catalogCommand(foreign,'batch-details',{id:preview.id}),/not found/);
 await store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'});
 const a=await store.catalogCommand(admin,'page',{section:'translations',materialId:m.id,pageSize:10});const b=await store.catalogCommand(admin,'page',{section:'translations',materialId:m.id,pageSize:10,page:2});
 assert.equal(a.total,27);assert.equal(a.pages,3);assert.equal(a.records.length,10);assert.equal(new Set([...a.records,...b.records].map(row=>row.id.toLowerCase())).size,20);
 assert.deepEqual((await store.catalogCommand(admin,'page',{section:'translations',materialId:m.id,pageSize:10})).records,a.records);
 assert.equal((await store.catalogCommand(admin,'page',{section:'materials',text:'%'})).total,0);
 assert.equal((await store.catalogCommand(admin,'page',{section:'materials',text:'PVC'})).records.length,1);
 assert.equal((await store.catalogCommand(foreign,'page',{section:'materials'})).total,0);
 assert.equal((await store.catalogCommand(admin,'page',{section:'batches'})).records[0].state,'applied');
 assert.equal('csv' in (await store.catalogCommand(admin,'page',{section:'batches'})).records[0],false);
 await assert.rejects(async()=>store.catalogCommand(user,'page',{section:'materials'}),/Administrator/);
 await assert.rejects(async()=>store.catalogCommand(admin,'page',{section:'materials',pageSize:1000}));
 await store.catalogCommand(admin,'rollback',{id:preview.id});assert.equal((await store.catalogCommand(admin,'batch-details',{id:preview.id})).state,'rolled_back');
}},
{name:'relationship snapshot preserves provenance, inactive records and tenant isolation',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');
 const m=await store.catalogCommand(admin,'material',material());
 const prod=await store.catalogCommand(admin,'product',product('pvc'));
 const phrase=await store.catalogCommand(admin,'translation',{materialKey:'pvc',phrase:'retired stock phrase',origin:'ai_import',sourceUrl:'https://example.invalid/source'});
 await store.catalogCommand(admin,'reject-translation',{id:phrase.id});
 await store.catalogCommand(admin,'image-reference',{materialKey:'pvc',manufacturer:'Fixture Alpha',partNumber:'TEST-1624',sourceUrl:'https://example.invalid/photo',rightsBasis:'Synthetic rights evidence only.'});
 await store.catalogCommand(user,'selection',{eventId:randomUUID(),projectId:'riverside',materialId:m.id,productId:prod.id,phrase:'selected stock phrase'});
 await store.catalogCommand(foreign,'material',bracket('foreign-only'));
 await assert.rejects(async()=>store.catalogCommand(user,'export-snapshot',{}),/Administrator/);
 const snap=await store.catalogCommand(admin,'export-snapshot',{});
 assert.equal(snap.format,'etalonops-catalog-snapshot');assert.equal(snap.version,1);assert.equal(snap.imageFilesIncluded,false);
 assert.equal(snap.tables.materials.length,1);assert.equal(snap.tables.materials[0].id.toLowerCase(),m.id.toLowerCase());
 assert.equal(snap.tables.manufacturer_products[0].id.toLowerCase(),prod.id.toLowerCase());
 assert.equal(snap.tables.manufacturers[0].name,'Fixture Alpha');
 const retired=snap.tables.translations.find((row:any)=>row.phrase==='retired stock phrase');assert.equal(Number(retired.active),0);assert.equal(retired.source_url,'https://example.invalid/source');assert.equal(retired.origin,'ai_import');
 assert.equal(snap.tables.selection_events.length,1);assert.equal(snap.tables.image_references[0].status,'pending');
 assert.equal(snap.recordCount,Object.values(snap.tables).reduce((n:number,rows:any)=>n+rows.length,0));
 for(const rows of Object.values(snap.tables) as any[][])assert.ok(rows.every(row=>row.tenant===admin.tenant));
 assert.equal('drafts' in snap.tables,false);assert.equal('memberships' in snap.tables,false);
}},
{name:'canonical identity reuses materials across brands and preserves specification differences',run:async store=>{
 const {admin,user}=people();const first=await store.catalogCommand(admin,'material',material());
 const duplicate=await store.catalogCommand(admin,'material',{...material('another-key'),attributes:{...material().attributes,material:' pvc ',endConnection:'PLAIN'}});assert.equal(duplicate.id,first.id);assert.equal(duplicate.unchanged,true);
 const second=await store.catalogCommand(admin,'material',material('pvc80','80'));assert.notEqual(second.id,first.id);
 const a=await store.catalogCommand(admin,'product',product('pvc')),b=await store.catalogCommand(admin,'product',product('pvc','Fixture Beta','TEST-B'));assert.notEqual(a.id,b.id);
 assert.equal((await store.catalogCommand(admin,'details',{id:first.id})).products.length,2);assert.equal((await store.listImports(admin)).length,0);
 await assert.rejects(async()=>store.catalogCommand(admin,'product',product('pvc80')),/another material/);
 await assert.rejects(async()=>store.catalogCommand(user,'material',material('forged')),/Administrator/);
 await assert.rejects(async()=>store.catalogCommand(admin,'material',{...material('fake-reviewed'),origin:'ai_import',verification:'reviewed'}),/provisional/);
}},
{name:'concurrent canonical inserts and product links converge without duplicates',run:async store=>{
 const {admin}=people();const entries=await Promise.all([store.catalogCommand(admin,'material',material('one')),store.catalogCommand(admin,'material',material('two'))]);assert.equal(entries[0].id,entries[1].id);
 const details=await store.catalogCommand(admin,'details',{id:entries[0].id});const linked=await Promise.all([store.catalogCommand(admin,'product',product(details.externalKey)),store.catalogCommand(admin,'product',product(details.externalKey))]);assert.equal(linked[0].id,linked[1].id);assert.equal((await store.catalogCommand(admin,'details',{id:entries[0].id})).products.length,1);
}},
{name:'deterministic shorthand, explicit brand and span searches preserve ambiguity and constraints',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');
 const pvc=await store.catalogCommand(admin,'material',material());await store.catalogCommand(admin,'material',{...material('pvc2'),attributes:{...material().attributes,diameterIn:2}});await store.catalogCommand(admin,'material',material('pvc80','80'));
 const found=await store.search(user,"10' Stick PVC 40");assert.equal(found.length,2);assert.ok(found.some(row=>row.id===pvc.id));assert.ok(found.every(row=>!row.description.includes('Schedule 80')));
 assert.equal((await store.search(user,'1 inch PVC pipe schedule 40')).length,0);
 const half=await store.catalogCommand(admin,'material',{...material('half'),attributes:{...material().attributes,diameterIn:0.5}});assert.equal((await store.search(user,'1/2 inch PVC schedule 40'))[0]?.id,half.id);assert.equal((await store.search(user,'½ inch PVC schedule 40'))[0]?.id,half.id);
 const bracketRow=await store.catalogCommand(admin,'material',bracket());const alpha=await store.catalogCommand(admin,'product',product('bracket'));const beta=await store.catalogCommand(admin,'product',product('bracket','Fixture Beta','B-10'));
 await store.catalogCommand(admin,'priority',{materialId:bracketRow.id,highUse:false,preferredProductId:alpha.id});assert.equal((await store.search(user,'B-10'))[0]?.products[0]?.id,beta.id);
 const brand=await store.search(user,'Fixture Alpha telescoping bracket');assert.equal(brand[0].id,bracketRow.id);assert.equal(brand[0].products.length,1);assert.equal(brand[0].products[0].id,alpha.id);
 assert.equal((await store.search(user,'bracket for a 20-inch span'))[0]?.id,bracketRow.id);assert.equal((await store.search(user,'bracket for a 30-inch span')).length,0);
 await store.catalogCommand(admin,'priority',{materialId:pvc.id,highUse:true,preferredProductId:null});assert.equal((await store.search(user,'PVC schedule 40'))[0].id,pvc.id);
}},
{name:'selection learning is idempotent, attributed, ambiguous and independently rejectable',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');const a=await store.catalogCommand(admin,'material',material()),b=await store.catalogCommand(admin,'material',material('b','80'));
 const choice={eventId:randomUUID(),projectId:'riverside',materialId:a.id,productId:null,phrase:'blue stock material'};
 await store.catalogCommand(user,'selection',choice);assert.equal((await store.catalogCommand(user,'selection',choice)).unchanged,true);
 await store.catalogCommand(user,'selection',{...choice,eventId:randomUUID(),materialId:b.id});assert.equal((await store.search(user,choice.phrase)).length,2);
 const phrases=await store.catalogCommand(admin,'translations',{id:a.id});assert.equal(phrases.length,1);assert.equal(phrases[0].actor,user.oid);assert.equal(phrases[0].origin,'user_selection');
 await store.catalogCommand(admin,'reject-translation',{id:phrases[0].id});await store.catalogCommand(user,'selection',{...choice,eventId:randomUUID()});assert.equal((await store.search(user,choice.phrase)).length,1);
 await assert.rejects(async()=>store.catalogCommand(foreign,'details',{id:a.id}),/not found/);
 await assert.rejects(async()=>store.catalogCommand(user,'selection',{...choice,materialId:b.id}),/already used/);
}},
{name:'job product policies default inactive, filter choices when active and never override No Substitutions',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const m=await store.catalogCommand(admin,'material',bracket());const a=await store.catalogCommand(admin,'product',product('bracket')),b=await store.catalogCommand(admin,'product',product('bracket','Fixture Beta','TEST-B'));
 const details=await store.catalogCommand(admin,'details',{id:m.id}),manufacturerId=details.products.find((p:any)=>p.id===a.id).manufacturerId;
 const rule=await store.catalogCommand(admin,'policy',{projectId:'riverside',materialKey:'bracket',category:null,manufacturerIds:[manufacturerId],productIds:[a.id]});assert.equal(rule.enabled,false);
 assert.equal((await store.search(user,'bracket','riverside'))[0].products.length,2);
 await store.catalogCommand(admin,'policy',{id:rule.id,projectId:'riverside',materialKey:'bracket',category:null,manufacturerIds:[manufacturerId],productIds:[a.id],enabled:true});
 assert.equal((await store.search(user,'bracket','riverside'))[0].products.length,1);
 const check=(id:string,maker:string)=>store.catalogCommand(user,'validate-lines',{projectId:'riverside',lines:[{id:randomUUID(),candidate:{id:m.id},purchasing:{productId:id,manufacturer:maker,partNumber:id===a.id?'TEST-1624':'TEST-B',noSubstitutions:true}}]});
 assert.equal((await check(a.id,'Fixture Alpha')).ready,true);assert.equal((await check(b.id,'Fixture Beta')).ready,false);
 await store.catalogCommand(admin,'disable-policy',{id:rule.id});assert.equal((await check(b.id,'Fixture Beta')).ready,true);
 await assert.rejects(async()=>store.catalogCommand(admin,'policy',{projectId:'riverside',materialKey:'bracket',category:null,manufacturerIds:[manufacturerId],productIds:[b.id]}),/outside/);
 await store.catalogCommand(admin,'material',material('other-material'));const otherProduct=await store.catalogCommand(admin,'product',product('other-material','Fixture Other','TEST-OTHER'));
 await assert.rejects(async()=>store.catalogCommand(admin,'policy',{projectId:'riverside',materialKey:'bracket',category:null,manufacturerIds:[],productIds:[otherProduct.id]}),/another material/);
 await store.catalogCommand(admin,'policy',{id:rule.id,projectId:'riverside',materialKey:'bracket',category:null,manufacturerIds:[manufacturerId.toUpperCase()],productIds:[],enabled:true});
 await store.catalogCommand(admin,'product',product('bracket','Fixture Alpha','TEST-NEW'));
 const brandResults=(await store.search(user,'bracket','riverside')).find(row=>row.id===m.id);assert.equal(brandResults.products.length,2);assert.ok(brandResults.products.every((row:any)=>row.manufacturer==='Fixture Alpha'));
 assert.equal((await store.catalogCommand(admin,'page',{section:'policies'})).total,1);
 await store.catalogCommand(admin,'disable-policy',{id:rule.id});
 await assert.rejects(async()=>store.catalogCommand(user,'policy',{}),/Administrator/);
}},
{name:'MRF manufacturer snapshots and No Substitutions survive saves and reject spoofed product relationships',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const m=await store.catalogCommand(admin,'material',bracket());const prod=await store.catalogCommand(admin,'product',product('bracket'));const c=(await store.search(user,'bracket'))[0];
 const body=draftBody.parse({projectId:'riverside',deliveryDate:'2026-11-10',version:0,lines:[{id:randomUUID(),quantity:'2',requestedUnit:'EA',description:c.description,rawInput:{quantity:'2',requestedUnit:'EA',description:'Fixture Alpha bracket'},candidate:{...c,verification:'reviewed'},source:c.source,deliveryMode:'inherit',overrideDate:null,purchasing:{productId:prod.id,manufacturer:'Fixture Alpha',partNumber:'TEST-1624',noSubstitutions:true}}]});
 const saved=await store.saveDraft(user,body);assert.equal(saved.lines[0].purchasing?.noSubstitutions,true);assert.equal(saved.lines[0].candidate.verification,'provisional');assert.equal(saved.lines[0].purchasing?.partNumber,'TEST-1624');
 const reloaded=await store.getDraft(user,String(saved.id));assert.equal(reloaded.lines[0].purchasing?.manufacturer,'Fixture Alpha');
 await assert.rejects(async()=>store.saveDraft(user,{...body,version:Number(saved.version),lines:[{...body.lines[0],purchasing:{...body.lines[0].purchasing!,manufacturer:'Forged brand'}}]},String(saved.id)),/does not match/);
 assert.equal(draftBody.safeParse({...body,lines:[{...body.lines[0],purchasing:{productId:null,manufacturer:'',partNumber:'',noSubstitutions:true}}]}).success,false);
 await assert.rejects(async()=>store.catalogCommand(user,'review-material',{id:m.id,approval:'I verified the defining specifications'}),/Administrator/);
 await store.catalogCommand(admin,'review-material',{id:m.id,approval:'I verified the defining specifications'});await store.catalogCommand(admin,'review-product',{materialId:m.id,productId:prod.id,approval:'I verified this product matches the material specification'});assert.equal((await store.catalogCommand(admin,'details',{id:m.id})).verification,'reviewed');
 assert.equal(String(m.id),String(c.id));
}},
{name:'staged CSV imports preview errors, apply idempotently and rollback without erasing separately learned phrases',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const m=await store.catalogCommand(admin,'material',material());
 const bad=await store.catalogCommand(admin,'preview',{csv:csv('translation',[{materialKey:'missing',phrase:'test',origin:'admin_reviewed'}])});assert.equal(bad.report.errors.length,1);await assert.rejects(async()=>store.catalogCommand(admin,'apply',{id:bad.id,approval:'I reviewed this batch'}),/preview errors/);
 const file=csv('translation',[{materialKey:'pvc',phrase:'stock tube phrase',origin:'ai_import',sourceUrl:'https://example.invalid/dataset'}]);const preview=await store.catalogCommand(admin,'preview',{csv:file});assert.equal(preview.report.errors.length,0);assert.equal((await store.catalogCommand(admin,'preview',{csv:file})).id,preview.id);
 assert.equal((await store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'})).created,1);assert.equal((await store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'})).unchanged,true);
 const records=await store.catalogCommand(admin,'translations',{id:m.id});assert.equal(records[0].source_url,'https://example.invalid/dataset');assert.equal(records[0].origin,'ai_import');
 await store.catalogCommand(user,'selection',{eventId:randomUUID(),projectId:'riverside',materialId:m.id,productId:null,phrase:'stock tube phrase'});await store.catalogCommand(admin,'rollback',{id:preview.id});assert.equal((await store.search(user,'stock tube phrase')).length,1);
 const images=await store.catalogCommand(admin,'preview',{csv:csv('image',[{materialKey:'pvc',sourceUrl:'https://example.invalid/photo',rightsBasis:'Synthetic fixture rights only.'}])});await store.catalogCommand(admin,'apply',{id:images.id,approval:'I reviewed this batch'});assert.equal((await store.catalogCommand(admin,'overview',{})).imageReferences[0].status,'pending');
}},
{name:'selected discovery ingestion records provisional sources and bounded variations atomically without paid calls',run:async store=>{
 const {user,admin}=people();await store.member(user,'riverside');const input={eventId:randomUUID(),projectId:'riverside',phrase:'Fixture Alpha bracket',material:bracket(),product:{manufacturer:'Fixture Alpha',partNumber:'TEST-1624',title:'Telescoping bracket',sourceUrl:'https://example.invalid/fixture',verification:'reviewed'},additionalPhrases:['stud telescoping bracket']};
 const selected=await store.catalogCommand(user,'select-discovery',input);assert.equal(selected.provisional,true);const details=await store.catalogCommand(admin,'details',{id:selected.materialId});assert.equal(details.verification,'provisional');assert.equal(details.products[0].verification,'provisional');assert.equal((await store.search(user,'stud telescoping bracket')).length,1);
 const count=(await store.catalogCommand(admin,'translations',{id:selected.materialId})).length;await store.catalogCommand(user,'select-discovery',input);assert.equal((await store.catalogCommand(admin,'translations',{id:selected.materialId})).length,count);
 await assert.rejects(async()=>store.catalogCommand(user,'select-discovery',{...input,eventId:randomUUID(),material:bracket('bad'),additionalPhrases:['bracket 999 inch']}),/unsupported numeric/);
 assert.equal((await store.catalogCommand(admin,'translations',{id:selected.materialId})).length,count);
}},
{name:'one thousand translation rows apply and roll back as a bounded staged batch',run:async store=>{
 const {admin}=people();await store.catalogCommand(admin,'material',material());
 const rows=Array.from({length:1000},(_,i)=>({materialKey:'pvc',phrase:`Synthetic stock phrase token${i}`,origin:'ai_import',sourceUrl:'https://example.invalid/large-fixture'}));
 const preview=await store.catalogCommand(admin,'preview',{csv:csv('translation',rows)});assert.equal(preview.report.rows,1000);assert.deepEqual(preview.report.errors,[]);
 const applied=await store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'});assert.equal(applied.created,1000);assert.equal((await store.catalogCommand(admin,'overview',{})).batches.length,1);
 await store.catalogCommand(admin,'rollback',{id:preview.id});
}},
{name:'generic and manufacturer product image approvals remain separate',run:async store=>{
 const {admin,user}=people();const m=await store.catalogCommand(admin,'material',bracket()),prod=await store.catalogCommand(admin,'product',product('bracket'));const evidence={sourceUrl:'https://example.invalid/photo',rightsBasis:'Synthetic fixture rights, no actual photograph.'};
 const generic=await store.submitImage(admin,m.id,'a'.repeat(64),evidence);const specific=await store.submitImage(admin,m.id,'b'.repeat(64),evidence,prod.id);await store.reviewImage(admin,m.id,generic.id,'approved');await store.reviewImage(admin,m.id,specific.id,'approved');assert.equal((await store.approvedImage(user,m.id))?.id,generic.id);assert.equal((await store.approvedImage(user,m.id,prod.id))?.id,specific.id);assert.equal((await store.listImages(admin,m.id)).filter(row=>row.status==='approved').length,2);
 await assert.rejects(async()=>store.submitImage(admin,m.id,'a'.repeat(64),evidence,prod.id),/another image scope/);
}}
];
