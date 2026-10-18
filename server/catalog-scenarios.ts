import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stringify } from 'csv-stringify/sync';
import { parse as parseCsv } from 'csv-parse/sync';
import type { Repository } from './repository';
import { draftBody,type Principal } from './contracts';

const material=(externalKey='pvc',schedule='40')=>({externalKey,category:'conduit',attributes:{diameterIn:1,material:'PVC',type:'conduit',schedule,lengthIn:120,endConnection:'plain'},productUnit:'STICK',verification:'provisional',sourceUrl:'https://example.invalid/fictional-specification',verificationBasis:'Synthetic test data, not real manufacturer evidence.'});
const bracket=(externalKey='bracket')=>({externalKey,category:'bracket',attributes:{minSpanIn:15.75,maxSpanIn:25,mounting:'stud',material:'steel'},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/fixture',verificationBasis:'Synthetic test data only; no product claim.'});
const product=(materialKey:string,manufacturer='Fixture Alpha',partNumber='TEST-1624')=>({materialKey,manufacturer,partNumber,title:'Telescoping bracket',sourceUrl:'https://example.invalid/fixture',verification:'provisional'});
function people(){const tenant=`catalog-${randomUUID()}`;return {admin:{tenant,oid:'admin',roles:['Admin']} as Principal,user:{tenant,oid:'user',roles:['Foreman']} as Principal,foreign:{tenant:`other-${randomUUID()}`,oid:'user',roles:['Admin']} as Principal};}
const csv=(kind:string,rows:unknown[])=>stringify(rows.map(data=>({kind,data_json:JSON.stringify(data)})),{header:true});
export const catalogScenarios:{name:string;run:(store:Repository)=>Promise<void>}[]=[
{name:'AI research publication reuses material across makers, repeated products and phrases, and holds incomplete specifications',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');
 const base={externalKey:'research-pvc',category:'conduit',productUnit:'STICK',attributes:material().attributes,manufacturer:'Synthetic Maker One',partNumber:'ONLY-ONE',title:'Synthetic PVC conduit',sourceUrl:'https://example.invalid/pvc',verificationBasis:'Synthetic evidence for duplicate detection tests only.',phrases:['synthetic pvc research']};
 const publish=async(item:typeof base)=>{let batch=await store.catalogCommand(admin,'research-stage',{results:{scope:'Synthetic research',coverageNotes:'Fictional evidence only.',items:[item]}});if(!batch.items.some((row:any)=>row.state==='unpublished'))return batch;batch=await store.catalogCommand(admin,'inbox-publish',{id:batch.id,version:batch.version,itemIds:batch.items.filter((row:any)=>row.state==='unpublished').map((row:any)=>row.id),approval:'I approve and publish these records'});return batch;};
 await publish(base);const first=(await store.search(user,'ONLY-ONE'))[0];assert.ok(first);
 const second={...base,externalKey:'another-ai-key',manufacturer:'Synthetic Maker Two',partNumber:'ONLY-TWO'};await publish(second);await publish(second);
 const details=await store.catalogCommand(admin,'details',{id:first.id});assert.equal(details.products.length,2);assert.equal((await store.catalogCommand(admin,'overview',{})).manufacturers.length,2);
 assert.equal((await store.search(user,'ONLY-TWO'))[0].id,first.id);assert.equal((await store.catalogCommand(admin,'translations',{id:first.id})).filter((row:any)=>row.phrase==='synthetic pvc research').length,1);
 await publish({...second,manufacturer:'Synthetic Maker Two, Inc.',partNumber:'ONLY-THREE',attributes:{...second.attributes,material:'polyvinyl chloride',endConnection:'plain end'}});assert.equal((await store.catalogCommand(admin,'overview',{})).manufacturers.length,2);assert.equal((await store.catalogCommand(admin,'details',{id:first.id})).products.length,3);
 const incomplete={...base,externalKey:'missing-end',partNumber:'INCOMPLETE',attributes:{diameterIn:2,material:'PVC',type:'conduit',schedule:'40',lengthIn:120}};
 const partial=await store.catalogCommand(admin,'research-stage',{results:{scope:'Partial product',coverageNotes:'End connection unknown.',items:[incomplete]}});assert.ok(partial.items.length);assert.match(partial.research.coverageNotes,/endConnection/);
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-publish',{id:partial.id,version:partial.version,itemIds:partial.items.map((row:any)=>row.id),approval:'I approve and publish these records'}));assert.equal((await store.search(user,'INCOMPLETE')).length,0);
 await assert.rejects(async()=>publish({...base,attributes:{...base.attributes,lengthIn:240}}),/different specifications|reviewed correction/);
}},
{name:'successful AI usage settles once and releases the unused reservation while failed calls remain held',run:async store=>{
 const {admin}=people(),requestId=randomUUID(),id=randomUUID();await store.paidResearch(admin,'reserve',{requestId});assert.equal((await store.paidResearch(admin,'usage',{})).reservedUsd,0.15);
 const save={id,requestId,actualCostMicroUsd:5000,digest:id.replaceAll('-','').repeat(2),payload:JSON.stringify({cacheKey:'a'.repeat(64),results:{scope:'Synthetic',coverageNotes:'Test only.',items:[]}})};
 await store.paidResearch(admin,'save',save);let usage=await store.paidResearch(admin,'usage',{});assert.equal(usage.reservedUsd,0.005);assert.equal(usage.heldUsd,0);assert.equal(usage.estimatedSuccessfulUsd,0.005);
 await assert.rejects(async()=>store.paidResearch(admin,'save',save),/already settled/);await store.paidResearch(admin,'reserve',{requestId:randomUUID()});usage=await store.paidResearch(admin,'usage',{});assert.equal(usage.reservedUsd,0.155);assert.equal(usage.heldUsd,0.15);
}},

{name:'AI dollar reservations stop at thirty dollars under concurrency and are tenant-scoped',run:async store=>{
 const {admin,user,foreign}=people(),period=new Date().toISOString().slice(0,7);
 await assert.rejects(async()=>store.paidResearch(user,'usage',{}),/administrators/);
 for(let n=0;n<199;n++)await store.audit(admin,'ai.research.reserved',`${period}/${randomUUID()}/150000`);
 const outcomes=await Promise.allSettled(Array.from({length:4},async()=>store.paidResearch(admin,'reserve',{requestId:randomUUID()})));assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
 const usage=await store.paidResearch(admin,'usage',{});assert.equal(usage.reservedUsd,30);assert.equal(usage.requests,200);assert.equal((await store.paidResearch(foreign,'usage',{})).requests,0);
 await assert.rejects(async()=>store.paidResearch(admin,'reserve',{requestId:randomUUID()}),/allowance/);
}},
{name:'AI product selection learns source-backed records, images and phrases atomically and reuses generic identity',run:async store=>{
 const {admin,user}=people();await store.member(admin,'riverside');const key='ai-learn-'+randomUUID();const item={externalKey:key,category:'general',productUnit:'EA',attributes:{type:'Fictional learned item',specification:key},manufacturer:'Fictional Learned Maker',partNumber:key,title:'Fictional AI learning test',sourceUrl:'https://example.invalid/learn',verificationBasis:'Synthetic learning test only; no actual evidence.',phrases:['phrase '+key],imageUrl:'https://example.invalid/learn.png'};
 const input={eventId:randomUUID(),projectId:'riverside',phrase:'my search '+key,item};
 await assert.rejects(async()=>store.selectResearch(user,input),/Administrator/);
 await assert.rejects(async()=>store.selectResearch(admin,{...input,projectId:'northside'}),/Project not found/);assert.equal((await store.search(user,key)).length,0);
 const first=await store.selectResearch(admin,input),again=await store.selectResearch(admin,input);assert.equal(first.candidate.id,again.candidate.id);assert.equal(first.candidate.verification,'provisional');assert.equal((await store.search(user,input.phrase)).length,1);assert.equal((await store.search(user,item.phrases[0])).length,1);
 const second=await store.selectResearch(admin,{...input,eventId:randomUUID(),item:{...item,externalKey:key+'-other',manufacturer:'Another Fictional Maker',partNumber:key+'-other'}});assert.equal(first.candidate.id,second.candidate.id);assert.equal(second.candidate.products.length,2);
 const images=await store.catalogCommand(admin,'external-image',{materialId:first.candidate.id,productId:first.productId});assert.equal(images.url,item.imageUrl);
}},

{name:'selected research persists unpublished materials, products, source phrases and coverage until reviewed publication',run:async store=>{
 const {admin,user,foreign}=people();const key='selected-research-'+randomUUID();
 const item={externalKey:key,category:'general',productUnit:'EA',attributes:{type:'Synthetic research item',specification:key},manufacturer:'Fictional Staging Maker',partNumber:key,title:'Synthetic research product',sourceUrl:'https://example.invalid/staged-research',verificationBasis:'Synthetic source used for testing only.',phrases:['Synthetic '+key]};
 const input={results:{scope:'Synthetic research scope',coverageNotes:'Only two synthetic products; not a complete family.',items:[item,{...item,externalKey:key+'-same',manufacturer:'Second Fictional Maker',partNumber:key+'-second'}]},searchPhrase:'original phrase '+key};
 await assert.rejects(async()=>store.catalogCommand(user,'research-stage',input),/Administrator/);
 const batch=await store.catalogCommand(admin,'research-stage',input);assert.equal(batch.research.coverageNotes,input.results.coverageNotes);assert.equal(batch.items.filter((i:any)=>i.kind==='material').length,1);assert.equal(batch.items.filter((i:any)=>i.kind==='product').length,2);assert.equal(batch.items.filter((i:any)=>i.kind==='translation').length,2);assert.ok(batch.items.every((i:any)=>i.state==='unpublished'&&!i.error));assert.equal((await store.search(user,key)).length,0);
 await assert.rejects(async()=>store.catalogCommand(foreign,'inbox-get',{id:batch.id}),/not found/);
 const again=await store.catalogCommand(admin,'research-stage',input);assert.equal(again.id,batch.id);
 const ids=batch.items.map((i:any)=>i.id),plan=await store.catalogCommand(admin,'inbox-plan',{id:batch.id,version:batch.version,itemIds:ids});assert.equal(plan.held.length,0);
 await store.catalogCommand(admin,'inbox-publish-ready',{id:batch.id,version:batch.version,itemIds:ids,planHash:plan.planHash,approval:'I approve and publish these records'});
 const found=await store.search(user,input.searchPhrase);assert.equal(found.length,1);assert.equal((await store.catalogCommand(admin,'details',{id:found[0].id})).products.length,2);
 const reopened=await store.catalogCommand(admin,'inbox-get',{id:batch.id});assert.equal(reopened.research.searchPhrase,input.searchPhrase);assert.ok(reopened.items.every((i:any)=>i.state==='published'));
}},

{name:'reviewed bulk publication holds invalid rows and includes cross-page dependencies; bulk deletion preserves published records',run:async store=>{
 const {admin,user}=people();const materialRow=(key:string,valid=true)=>({id:randomUUID(),kind:'material',sheet:'Other Parts',row:2,fields:{kind:'material',externalKey:key,category:'general',productUnit:'EA',verification:'provisional',origin:'ai_import',sourceUrl:'https://example.invalid/bulk',verificationBasis:'Synthetic bulk-publication test only.',type:'Fictional '+key,specification:valid?'Synthetic specification '+key:''},state:'unpublished'});
 const materials=Array.from({length:27},(_,i)=>({...materialRow('bulk-'+i,i!==0),row:i+2}));const part={id:randomUUID(),kind:'product',sheet:'Manufacturer Products',row:2,state:'unpublished',fields:{kind:'product',materialKey:'bulk-26',manufacturer:'Bulk Fictional Maker',partNumber:'BULK-026',title:'Fictional bulk part',sourceUrl:'https://example.invalid/bulk',origin:'ai_import',verification:'provisional'}};
 let batch=await store.catalogCommand(admin,'inbox-stage',{filename:'bulk.xlsx',items:[...materials,part]});
 const plan=await store.catalogCommand(admin,'inbox-plan',{id:batch.id,version:batch.version,itemIds:[part.id]});assert.equal(plan.selectedReady,1);assert.deepEqual(plan.dependencies.map((i:any)=>i.id),[materials[26].id]);assert.equal((await store.search(user,'BULK-026')).length,0);
 const first=await store.catalogCommand(admin,'inbox-publish-ready',{id:batch.id,version:batch.version,itemIds:[part.id],planHash:plan.planHash,approval:'I approve and publish these records'});assert.equal(first.publication.dependencies,1);assert.equal((await store.search(user,'BULK-026')).length,1);batch=first;
 const pending=batch.items.filter((i:any)=>i.state==='unpublished').map((i:any)=>i.id);const all=await store.catalogCommand(admin,'inbox-plan',{id:batch.id,version:batch.version,itemIds:pending});assert.equal(all.held.length,1);assert.equal(all.selectedReady,25);
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-publish-ready',{id:batch.id,version:batch.version,itemIds:pending,planHash:'wrong',approval:'I approve and publish these records'}),/review changed/);
 batch=await store.catalogCommand(admin,'inbox-publish-ready',{id:batch.id,version:batch.version,itemIds:pending,planHash:all.planHash,approval:'I approve and publish these records'});assert.equal(batch.publication.held,1);assert.equal(batch.items.filter((i:any)=>i.state==='unpublished').length,1);assert.equal(batch.items.filter((i:any)=>i.state==='published').length,27);
 batch=await store.catalogCommand(admin,'inbox-delete',{id:batch.id,version:batch.version,itemIds:[materials[0].id]});assert.equal(batch.items.filter((i:any)=>i.state==='deleted').length,1);assert.equal((await store.search(user,'BULK-026')).length,1);
}},
{name:'publication review detects missing or deleted material dependencies and concurrent catalog conflicts without partial writes',run:async store=>{
 const {admin,user}=people();const mat={id:randomUUID(),kind:'material',sheet:'Supports',row:2,state:'unpublished',fields:{kind:'material',externalKey:'planned-bracket',category:'bracket',productUnit:'EA',verification:'provisional',origin:'ai_import',sourceUrl:'https://example.invalid/plan',verificationBasis:'Synthetic dependency test only.',minSpanIn:'12',maxSpanIn:'18',mounting:'planned stud',material:'steel'}};const productRow={id:randomUUID(),kind:'product',sheet:'Manufacturer Products',row:2,state:'unpublished',fields:{kind:'product',materialKey:'planned-bracket',manufacturer:'Planned Fictional Maker',partNumber:'PLANNED-001',title:'Test planned bracket',sourceUrl:'https://example.invalid/plan',origin:'ai_import',verification:'provisional'}};
 const batch=await store.catalogCommand(admin,'inbox-stage',{filename:'plan.xlsx',items:[mat,productRow]});await assert.rejects(async()=>store.catalogCommand(user,'inbox-plan',{id:batch.id,version:batch.version,itemIds:[productRow.id]}),/Administrator/);
 const plan=await store.catalogCommand(admin,'inbox-plan',{id:batch.id,version:batch.version,itemIds:[productRow.id]});await store.catalogCommand(admin,'material',bracket('other-planned'));await store.catalogCommand(admin,'product',product('other-planned','Planned Fictional Maker','PLANNED-001'));
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-publish-ready',{id:batch.id,version:batch.version,itemIds:[productRow.id],planHash:plan.planHash,approval:'I approve and publish these records'}),/review changed/);assert.equal((await store.catalogCommand(admin,'page',{section:'materials',text:'planned-bracket'})).total,0);
 const deleted=await store.catalogCommand(admin,'inbox-delete',{id:batch.id,version:batch.version,itemIds:[mat.id]});const held=await store.catalogCommand(admin,'inbox-plan',{id:batch.id,version:deleted.version,itemIds:[productRow.id]});assert.equal(held.readyIds.length,0);assert.match(held.held[0].reason,/missing|deleted/);
}},

{name:'unpublished imports persist edits and remain invisible until explicit publication; delete never changes live catalog',run:async store=>{
 const {admin,user,foreign}=people();const materialFields={kind:'material',externalKey:'inbox-conduit',category:'conduit',productUnit:'STICK',verification:'provisional',origin:'ai_import',sourceUrl:'https://example.invalid/inbox',verificationBasis:'Synthetic import data for unpublished workflow.',diameterIn:'1',material:'PVC',type:'conduit',schedule:'40',lengthIn:'120',endConnection:'bell'};
 const records=[{id:randomUUID(),kind:'material',sheet:'Conduit',row:2,fields:materialFields,state:'unpublished'},{id:randomUUID(),kind:'product',sheet:'Manufacturer Products',row:2,fields:{kind:'product',materialKey:'inbox-conduit',manufacturer:'Inbox Fictional Maker',partNumber:'INBOX-001',title:'Fictional conduit',sourceUrl:'https://example.invalid/inbox',verification:'provisional',origin:'ai_import'},state:'unpublished'},{id:randomUUID(),kind:'translation',sheet:'Translations',row:2,fields:{kind:'translation',materialKey:'inbox-conduit',phrase:'inbox test conduit',origin:'ai_generated',sourceUrl:'https://example.invalid/inbox'},state:'unpublished'}];
 await assert.rejects(async()=>store.catalogCommand(user,'inbox-stage',{filename:'test.xlsx',items:records}),/Administrator/);
 let batch=await store.catalogCommand(admin,'inbox-stage',{filename:'test.xlsx',items:records});assert.equal((await store.search(user,'INBOX-001')).length,0);assert.equal((await store.catalogCommand(admin,'inbox-list',{})).imports[0].unpublished,3);
 await assert.rejects(async()=>store.catalogCommand(foreign,'inbox-get',{id:batch.id}),/not found/);
 const again=await store.catalogCommand(admin,'inbox-stage',{filename:'test.xlsx',items:records.map(r=>({...r,id:randomUUID()}))});assert.equal(again.id,batch.id);
 const old=batch.version;batch=await store.catalogCommand(admin,'inbox-save',{id:batch.id,version:batch.version,changes:[{itemId:records[0].id,fields:{...materialFields,lengthIn:'240'}},{itemId:records[1].id,fields:{...records[1].fields,title:'Edited unpublished product'}}]});assert.equal(batch.items[0].state,'unpublished');assert.equal((await store.search(user,'INBOX-001')).length,0);
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-delete',{id:batch.id,version:old,itemIds:[records[0].id]}),/changed/);await assert.rejects(async()=>store.catalogCommand(admin,'inbox-save',{id:batch.id,version:batch.version,changes:[{itemId:records[0].id,fields:{...materialFields,lengthIn:'480'}},{itemId:randomUUID(),fields:{}}]}),/unpublished/);assert.equal((await store.catalogCommand(admin,'inbox-get',{id:batch.id})).items[0].fields.lengthIn,'240');
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-publish',{id:batch.id,version:batch.version,itemIds:[records[0].id],approval:'yes'}),/approval/);
 batch=await store.catalogCommand(admin,'inbox-delete',{id:batch.id,version:batch.version,itemIds:[records[2].id]});assert.equal(batch.items[2].state,'deleted');
 batch=await store.catalogCommand(admin,'inbox-publish',{id:batch.id,version:batch.version,itemIds:records.slice(0,2).map(r=>r.id),approval:'I approve and publish these records'});const found=await store.search(user,'INBOX-001');assert.equal(found.length,1);assert.match(found[0].description,/240/);assert.equal(batch.items[0].state,'published');
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-delete',{id:batch.id,version:batch.version,itemIds:[records[0].id]}),/unavailable/);assert.equal((await store.search(user,'INBOX-001')).length,1);
}},
{name:'publication rolls back late failures and explicitly publishes owner-managed image references',run:async store=>{
 const {admin,user}=people();const first={id:randomUUID(),kind:'material',sheet:'Supports',row:2,state:'unpublished',fields:{kind:'material',externalKey:'inbox-atomic',category:'bracket',productUnit:'EA',verification:'provisional',origin:'ai_import',sourceUrl:'https://example.invalid/atomic',verificationBasis:'Synthetic bracket import for rollback testing.',minSpanIn:'12',maxSpanIn:'18',material:'steel',mounting:'stud'}};
 const second={id:randomUUID(),kind:'product',sheet:'Manufacturer Products',row:2,state:'unpublished',fields:{kind:'product',materialKey:'inbox-atomic',manufacturer:'Atomic Fictional Maker',partNumber:'ATOMIC-001',title:'',sourceUrl:'https://example.invalid/atomic',origin:'ai_import',verification:'provisional'}};
 const batch=await store.catalogCommand(admin,'inbox-stage',{filename:'atomic.xlsx',items:[first,second]});assert.ok(batch.items[1].error);
 await assert.rejects(async()=>store.catalogCommand(admin,'inbox-publish',{id:batch.id,version:batch.version,itemIds:[first.id,second.id],approval:'I approve and publish these records'}));
 assert.equal((await store.search(user,'12 inch stud bracket')).length,0);assert.equal((await store.catalogCommand(admin,'inbox-get',{id:batch.id})).version,batch.version);assert.equal((await store.catalogCommand(admin,'page',{section:'materials',text:'inbox-atomic'})).total,0);
 const image=await store.catalogCommand(admin,'inbox-stage',{filename:'image.csv',items:[{id:randomUUID(),kind:'image',sheet:'CSV',row:2,state:'unpublished',fields:{materialKey:'inbox-atomic',sourceUrl:'https://example.invalid/photo',rightsBasis:'Permission pending, reference only.'}}]});assert.equal(image.items[0].error,'');assert.equal((await store.catalogCommand(admin,'overview',{})).imageReferences.length,0);await store.catalogCommand(admin,'inbox-publish',{id:batch.id,version:batch.version,itemIds:[first.id],approval:'I approve and publish these records'});await store.catalogCommand(admin,'inbox-publish',{id:image.id,version:image.version,itemIds:[image.items[0].id],approval:'I approve and publish these records'});const rows=(await store.catalogCommand(admin,'page',{section:'materials',text:'inbox-atomic'})).records;const photo=await store.catalogCommand(user,'external-image',{materialId:rows[0].id,productId:null});assert.equal(photo.url,'https://example.invalid/photo');const references=(await store.catalogCommand(admin,'overview',{})).imageReferences;assert.equal(references[0].status,'approved');assert.match(references[0].rights_basis,/Owner-managed/);
}},

{name:'product-family review previews without inserting, shares canonical items and applies idempotently',run:async store=>{
 const {admin,user,foreign}=people();
 const item={externalKey:'research-pvc',category:'conduit',productUnit:'STICK',attributes:material().attributes,manufacturer:'Fictional Research Maker',partNumber:'RESEARCH-001',title:'Fictional PVC conduit',sourceUrl:'https://example.invalid/research',verificationBasis:'Synthetic test source, no manufacturer verification.',phrases:['Fictional Research Maker RESEARCH-001','research pvc conduit']};
 const results={scope:'Fictional family',coverageNotes:'Two fictional manufacturer parts, not actual research.',items:[item,{...item,externalKey:'same-spec-other-key',manufacturer:'Other Fictional Maker',partNumber:'RESEARCH-002'}]};
 await assert.rejects(async()=>store.catalogCommand(user,'research-preview',{results}),/Administrator/);
 const preview=await store.catalogCommand(admin,'research-preview',{results});assert.equal(preview.summaries.length,2);assert.equal(preview.summaries[0].materialKey,preview.summaries[1].materialKey);assert.equal((await store.search(user,'RESEARCH-001')).length,0);
 await assert.rejects(async()=>store.catalogCommand(admin,'research-apply',{results,previewHash:preview.previewHash,approval:'yes'}),/review confirmation/);
 await assert.rejects(async()=>store.catalogCommand(admin,'research-apply',{results:{...results,items:[{...item,title:'Edited after preview'}]},previewHash:preview.previewHash,approval:'I reviewed these products and sources'}),/Preview changed/);
 const applied=await store.catalogCommand(admin,'research-apply',{results,previewHash:preview.previewHash,approval:'I reviewed these products and sources'});assert.equal(applied.batches.length,3);
 const found=await store.search(user,'RESEARCH-001');assert.equal(found.length,1);assert.equal(found[0].verification,'provisional');assert.equal((await store.search(foreign,'RESEARCH-001')).length,0);
 const details=await store.catalogCommand(admin,'details',{id:found[0].id});assert.equal(details.products.length,2);
 const again=await store.catalogCommand(admin,'research-preview',{results});assert.equal(again.summaries[0].materialAction,'Link existing material');await store.catalogCommand(admin,'research-apply',{results,previewHash:again.previewHash,approval:'I reviewed these products and sources'});assert.equal((await store.catalogCommand(admin,'details',{id:found[0].id})).products.length,2);
}},
{name:'research rejects incomplete evidence, normalized duplicate phrases and conflicting products',run:async store=>{
 const {admin,user}=people();const item={externalKey:'research-bracket',category:'bracket',productUnit:'EA',attributes:bracket().attributes,manufacturer:'Fictional Research',partNumber:'FAIL-001',title:'Fictional bracket',sourceUrl:'https://example.invalid/research',verificationBasis:'Synthetic specifications for transactional test.',phrases:['15 3/4 inch research bracket']};
 const results={scope:'Test',coverageNotes:'Synthetic research only.',items:[item]};
 await assert.rejects(async()=>store.catalogCommand(admin,'research-preview',{results:{...results,items:[{...item,attributes:{...item.attributes,maxSpanIn:0}}]}}),/maxSpanIn/);
 await assert.rejects(async()=>store.catalogCommand(admin,'research-preview',{results:{...results,items:[{...item,sourceUrl:''}]}}));
 await assert.rejects(async()=>store.catalogCommand(admin,'research-preview',{results:{...results,items:[item,item]}}),/more than once/);
 const broken={...results,items:[{...item,phrases:['research bracket stick','research bracket']}]};
 await assert.rejects(async()=>store.catalogCommand(admin,'research-preview',{results:broken}),/Repeated catalog identity/);
 assert.equal((await store.search(user,'FAIL-001')).length,0);assert.equal((await store.catalogCommand(admin,'overview',{})).batches.length,0);
 await store.catalogCommand(admin,'material',bracket());await store.catalogCommand(admin,'product',product('bracket','Fictional Research','FAIL-001'));
 await assert.rejects(async()=>store.catalogCommand(admin,'research-preview',{results:{...results,items:[{...item,attributes:{...item.attributes,maxSpanIn:30}}]}}),/different specifications/);
}},

{name:'explicit translated field terminology can retrieve conduit called pipe without overriding dimensional constraints',run:async store=>{
 const {admin,user}=people();const a=await store.catalogCommand(admin,'material',material());await store.catalogCommand(admin,'material',material('pvc80','80'));
 assert.equal((await store.search(user,'1 inch PVC pipe schedule 40')).length,0);
 await store.catalogCommand(admin,'translation',{materialKey:'pvc',phrase:'1 inch PVC pipe schedule 40',origin:'ai_import',sourceUrl:'https://example.invalid/owner-terminology'});
 assert.equal((await store.search(user,'1 inch PVC pipe schedule 40'))[0]?.id,a.id);assert.equal((await store.search(user,'2 inch PVC pipe schedule 40')).length,0);assert.equal((await store.search(user,'1 inch PVC pipe schedule 80')).length,0);assert.equal((await store.search(user,'1 inch PVC plumbing pipe schedule 40')).length,0);
 const phrases=await store.catalogCommand(admin,'translations',{id:a.id});await store.catalogCommand(admin,'reject-translation',{id:phrases[0].id});assert.equal((await store.search(user,'1 inch PVC pipe schedule 40')).length,0);
}},

{name:'Excel-friendly CSV imports retain linked manufacturer identifiers, phrase text and provisional provenance',run:async store=>{
 const {admin}=people();
 const files=[
 [{kind:'material',externalKey:'00001',category:'bracket',productUnit:'EA',verification:'provisional',origin:'ai_import',sourceUrl:'https://example.invalid/spec',verificationBasis:'Synthetic test specifications only.',minSpanIn:'15.75',maxSpanIn:'25',mounting:'stud',material:'steel'}],
 [{kind:'product',materialKey:'00001',manufacturer:'Synthetic Maker',partNumber:'001E02',title:'Synthetic support',sourceUrl:'https://example.invalid/part',verification:'provisional',origin:'ai_import'}],
 [{kind:'translation',materialKey:'00001',phrase:'15 3/4" support, stud bracket',origin:'ai_generated',sourceUrl:'https://example.invalid/part'}],
 [{kind:'image',materialKey:'00001',manufacturer:'Synthetic Maker',partNumber:'001E02',sourceUrl:'https://example.invalid/photo.png',rightsBasis:'Synthetic placeholder only; not actual image permission.'}],
 ];
 for(const rows of files){const preview=await store.catalogCommand(admin,'preview',{csv:stringify(rows,{header:true,bom:true})});assert.deepEqual(preview.report.errors,[]);await store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'});assert.equal((await store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'})).unchanged,true);}
 const materials=await store.catalogCommand(admin,'page',{section:'materials'});assert.equal(materials.total,1);const detail=await store.catalogCommand(admin,'details',{id:materials.records[0].id});assert.equal(detail.externalKey,'00001');assert.equal(detail.attributes.minSpanIn,15.75);assert.equal(detail.verification,'provisional');assert.equal(detail.products[0].partNumber,'001E02');assert.equal(detail.products[0].verification,'provisional');
 const phrases=await store.catalogCommand(admin,'translations',{id:detail.id});assert.equal(phrases[0].phrase,'15 3/4" support, stud bracket');assert.equal(phrases[0].origin,'ai_generated');const images=await store.catalogCommand(admin,'page',{section:'images'});assert.equal(images.records[0].status,'pending');
 const invalid=await store.catalogCommand(admin,'preview',{csv:stringify([{...files[0][0],externalKey:'bad-origin',verification:'reviewed'}],{header:true})});assert.ok(invalid.report.errors.length);
}},

{name:'saved draft filters apply before paging, treat wildcard characters literally and preserve ownership and project boundaries',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');await store.member(user,'northside');await store.member(admin,'riverside');await store.member(foreign,'riverside');
 for(let i=0;i<28;i++)await store.saveDraft(user,draftBody.parse({projectId:'riverside',name:`Lighting ${String(i).padStart(2,'0')}`,deliveryDate:i%2?'2026-11-20':'2026-11-10',lines:[],version:0}));
 await store.saveDraft(user,draftBody.parse({projectId:'riverside',name:'Literal [%_] 100% request',deliveryDate:'2026-11-15',lines:[],version:0}));
 await store.saveDraft(admin,draftBody.parse({projectId:'riverside',name:'Lighting private other owner',deliveryDate:'2026-11-10',lines:[],version:0}));
 await store.saveDraft(user,draftBody.parse({projectId:'northside',name:'Lighting private other project',deliveryDate:'2026-11-10',lines:[],version:0}));
 const all=await store.listDrafts(user,'riverside',1,{text:'LIGHTING'});assert.equal(all.total,28);assert.equal(all.records.length,25);const second=await store.listDrafts(user,'riverside',2,{text:'lighting'});assert.equal(second.records.length,3);assert.equal(new Set([...all.records,...second.records].map(r=>r.id)).size,28);
 assert.equal((await store.listDrafts(user,'riverside',1,{text:'lighting',deliveryFrom:'2026-11-11',deliveryTo:'2026-11-20'})).total,14);
 assert.equal((await store.listDrafts(user,'riverside',1,{text:'[%_]'})).total,1);assert.equal((await store.listDrafts(user,'riverside',1,{text:'100%'})).total,1);
 assert.equal((await store.listDrafts(foreign,'riverside',1,{text:'lighting'})).total,0);
 const empty=await store.listDrafts(user,'riverside',100,{deliveryFrom:'2027-01-01'});assert.equal(empty.total,0);assert.equal(empty.page,1);
 await assert.rejects(async()=>store.listDrafts(user,'riverside',1,{deliveryFrom:'2026-11-20',deliveryTo:'2026-11-10'}),/Delivery from/);
 await assert.rejects(async()=>store.listDrafts(user,'riverside',1,{deliveryFrom:'2026-02-30'}),/Invalid/);
}},

{name:'catalog readiness queues are tenant-scoped, paged, source-aware and clear after reviewed changes',run:async store=>{
 const {admin,user,foreign}=people();
 assert.equal((await store.catalogCommand(admin,'readiness',{})).summary.activeMaterials,0);
 await assert.rejects(async()=>store.catalogCommand(user,'readiness',{}),/Administrator/);
 const materials=[];
 for(let i=0;i<28;i++)materials.push(await store.catalogCommand(admin,'material',{...bracket(`READINESS-${String(i).padStart(2,'0')}`),attributes:{...bracket().attributes,maxSpanIn:25+i}}));
 const prod=await store.catalogCommand(admin,'product',product('READINESS-00'));
 await store.catalogCommand(admin,'translation',{materialKey:'READINESS-00',phrase:'readiness test bracket',origin:'admin_reviewed'});
 const evidence={sourceUrl:'https://example.invalid/readiness-photo',rightsBasis:'Synthetic test evidence; no actual image rights claim.'};
 const image=await store.submitImage(admin,materials[0].id,'d'.repeat(64),evidence);
 let report=await store.catalogCommand(admin,'readiness',{});assert.equal(report.total,28);assert.equal(report.records.length,25);assert.equal(report.pages,2);assert.equal(report.summary.products,27);assert.equal(report.summary.translations,27);assert.equal(report.summary.images,28);assert.equal(report.summary.productReview,1);assert.equal(report.summary.pendingImages,1);
 const second=await store.catalogCommand(admin,'readiness',{page:2});assert.equal(second.records.length,3);assert.equal(new Set([...report.records,...second.records].map(r=>r.materialId)).size,28);
 assert.equal((await store.catalogCommand(admin,'readiness',{text:'READINESS-00'})).total,1);assert.equal((await store.catalogCommand(admin,'readiness',{text:'%'})).total,0);
 assert.equal((await store.catalogCommand(foreign,'readiness',{})).summary.activeMaterials,0);
 const pending=await store.catalogCommand(admin,'readiness',{issue:'pendingImages'});assert.equal(pending.records[0].relatedId,image.id);
 await store.reviewImage(admin,materials[0].id,image.id,'approved');await store.catalogCommand(admin,'review-material',{id:materials[0].id,approval:'I verified the defining specifications'});await store.catalogCommand(admin,'review-product',{materialId:materials[0].id,productId:prod.id,approval:'I verified this product matches the material specification'});
 report=await store.catalogCommand(admin,'readiness',{});assert.equal(report.total,27);assert.equal(report.summary.reviewedMaterials,1);assert.equal(report.summary.pendingImages,0);assert.equal(report.summary.productReview,0);assert.equal(report.summary.images,27);
 const imported=await store.previewImport(admin,readFileSync(new URL('../db/fixtures/catalog.csv',import.meta.url),'utf8'));await store.applyImport(admin,imported.id,'I reviewed this batch',true);
 report=await store.catalogCommand(admin,'readiness',{issue:'legacy'});assert.ok(report.summary.fixtureMaterials>0);assert.equal(report.total,report.summary.fixtureMaterials);assert.equal(report.summary.translations,27); // legacy aliases count as phrase coverage
 await assert.rejects(async()=>store.catalogCommand(admin,'readiness',{issue:'sql',page:0}),/Invalid|option|small/);
}},

{name:'MRF submission freezes exact intent, exports safe CSV and creates linked immutable revisions',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');await store.member(admin,'riverside');await store.member(foreign,'riverside');
 await store.catalogCommand(admin,'material',{...bracket(),verification:'reviewed'});const prod=await store.catalogCommand(admin,'product',{...product('bracket'),verification:'reviewed'});const c=(await store.search(user,'Fixture Alpha TEST-1624','riverside'))[0];
 const body=draftBody.parse({projectId:'riverside',name:'Level 2 Rough-In',deliveryDate:'2026-11-10',version:0,lines:[{id:randomUUID(),quantity:'2.500000',requestedUnit:'EA',description:c.description,rawInput:{quantity:'2.500000',requestedUnit:'EA',description:'=1+1'},candidate:c,source:c.source,deliveryMode:'override',overrideDate:'2026-11-12',purchasing:{productId:prod.id,manufacturer:'Fixture Alpha',partNumber:'TEST-1624',noSubstitutions:true}}]});const saved=await store.saveDraft(user,body);
 const review=await store.submissions(user,'review',{draftId:saved.id,version:1});assert.equal(review.ready,true);assert.equal(review.warnings.length,0);assert.equal((await store.submissions(user,'list',{projectId:'riverside'})).total,0);
 const input={draftId:saved.id,version:1,requestId:randomUUID(),expectedHash:review.previewHash,confirmation:'I reviewed this MRF and want to submit it',acceptWarnings:false};const result=await store.submissions(user,'submit',input);assert.equal(result.number,'MRF-000001');assert.ok(result.snapshot.reviewContext.catalogEvidence.length);assert.deepEqual(result.snapshot.reviewContext.jobRestrictions,[]);assert.equal(result.snapshot.lines[0].quantity,'2.500000');assert.equal(result.snapshot.lines[0].purchasing.noSubstitutions,true);
 assert.equal((await store.submissions(user,'submit',input)).id,result.id);assert.equal((await store.submissions(user,'submit',{...input,requestId:randomUUID()})).id,result.id);
 assert.equal((await store.listDrafts(user,'riverside')).total,0);assert.equal(await store.getProjectDraft(user,'riverside'),null);assert.equal((await store.getDraft(user,String(saved.id))).submitted!.number,result.number);
 await assert.rejects(async()=>store.saveDraft(user,{...body,version:1},String(saved.id)),/Submitted MRFs/);await assert.rejects(async()=>store.submissions(admin,'get',{id:result.id}),/not found/);await assert.rejects(async()=>store.submissions(foreign,'get',{id:result.id}),/not found/);
 const file=await store.submissions(user,'export',{id:result.id}),csv=parseCsv(file.csv,{columns:true}) as Record<string,string>[];assert.equal(csv[0].quantity,'2.500000');assert.equal(csv[0].delivery_date,'2026-11-12');assert.equal(csv[0].no_substitutions,'YES');assert.equal(csv[0].original_request,"'=1+1");assert.equal(csv[0].manufacturer_part_number,'TEST-1624');
 const revision=await store.submissions(user,'revise',{id:result.id});assert.equal((await store.submissions(user,'revise',{id:result.id})).draftId,revision.draftId);const draft=await store.getDraft(user,revision.draftId);assert.equal(draft.revisionOf,result.id);
 const updated=draftBody.parse({projectId:'riverside',name:draft.name,version:1,deliveryDate:draft.deliveryDate,lines:draft.lines.map((l:any)=>({...l,quantity:'5'}))});await store.saveDraft(user,updated,revision.draftId);const next=await store.submissions(user,'review',{draftId:revision.draftId,version:2});const r2=await store.submissions(user,'submit',{...input,draftId:revision.draftId,version:2,expectedHash:next.previewHash,requestId:randomUUID()});assert.equal(r2.number,'MRF-000001-R2');assert.equal(r2.previousId,result.id);assert.equal((await store.submissions(user,'get',{id:result.id})).snapshot.lines[0].quantity,'2.500000');assert.equal((await store.submissions(user,'get',{id:r2.id})).snapshot.lines[0].quantity,'5');assert.equal((await store.submissions(user,'list',{projectId:'riverside'})).total,2);
 await assert.rejects(async()=>store.submissions(user,'revise',{id:result.id}),/latest/);
}},
{name:'submission requires nonempty saved review, warning acknowledgement and current purchasing rules',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const body=draftBody.parse({projectId:'riverside',name:'Fixture request',deliveryDate:'2026-11-10',version:0,lines:[]});const empty=await store.saveDraft(user,body);const emptyReview=await store.submissions(user,'review',{draftId:empty.id,version:1});assert.equal(emptyReview.ready,false);
 const item={id:randomUUID(),quantity:'1',requestedUnit:'EA',description:'Unverified requester specification',rawInput:{quantity:'1',requestedUnit:'EA',description:'Unverified requester specification'},candidate:null,source:'user_description',deliveryMode:'inherit',overrideDate:null};const filled=draftBody.parse({...body,lines:[item]});const d=await store.saveDraft(user,filled);const review=await store.submissions(user,'review',{draftId:d.id,version:1});assert.equal(review.ready,true);assert.ok(review.warnings.length);
 const submit={draftId:d.id,version:1,requestId:randomUUID(),expectedHash:review.previewHash,confirmation:'I reviewed this MRF and want to submit it',acceptWarnings:false};await assert.rejects(async()=>store.submissions(user,'submit',submit),/Acknowledge/);assert.equal((await store.submissions(user,'list',{projectId:'riverside'})).total,0);
 await store.saveDraft(user,{...filled,version:1,name:'Revised name'},String(d.id));await assert.rejects(async()=>store.submissions(user,'submit',{...submit,acceptWarnings:true}),/draft changed/);
 const current=await store.submissions(user,'review',{draftId:d.id,version:2});const done=await store.submissions(user,'submit',{...submit,version:2,expectedHash:current.previewHash,acceptWarnings:true});assert.ok(done.warnings.length);
 await store.catalogCommand(admin,'material',{...bracket(),verification:'reviewed'});const prod=await store.catalogCommand(admin,'product',{...product('bracket'),verification:'reviewed'});const details=await store.catalogCommand(admin,'details',{id:(await store.search(user,'Fixture Alpha TEST-1624'))[0].id});
 const second=await store.saveDraft(user,filled);const beforePolicy=await store.submissions(user,'review',{draftId:second.id,version:1});
 await store.catalogCommand(admin,'policy',{projectId:'riverside',materialKey:null,category:null,manufacturerIds:[details.products.find((p:any)=>p.id===prod.id).manufacturerId],productIds:[],enabled:true});const denied=await store.submissions(user,'review',{draftId:second.id,version:1});assert.equal(denied.ready,false);await assert.rejects(async()=>store.submissions(user,'submit',{...submit,draftId:second.id,requestId:randomUUID(),expectedHash:beforePolicy.previewHash,acceptWarnings:true}),/Resolve/);
}},
{name:'submission previews expire after valid rule changes and concurrent requests get distinct numbers',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const m=await store.catalogCommand(admin,'material',{...bracket(),verification:'reviewed'}),prod=await store.catalogCommand(admin,'product',{...product('bracket'),verification:'reviewed'}),details=await store.catalogCommand(admin,'details',{id:m.id}),c=(await store.search(user,'Fixture Alpha TEST-1624'))[0];
 const body=draftBody.parse({projectId:'riverside',name:'Numbered request',deliveryDate:'2026-11-10',version:0,lines:[{id:randomUUID(),quantity:'1',requestedUnit:'EA',description:c.description,rawInput:{quantity:'1',requestedUnit:'EA',description:'Fixture bracket'},candidate:c,source:c.source,deliveryMode:'inherit',overrideDate:null,purchasing:{productId:prod.id,manufacturer:'Fixture Alpha',partNumber:'TEST-1624',noSubstitutions:true}}]});
 const a=await store.saveDraft(user,body),b=await store.saveDraft(user,{...body,name:'Another numbered request'});const before=await store.submissions(user,'review',{draftId:a.id,version:1});
 await store.catalogCommand(admin,'policy',{projectId:'riverside',materialKey:'bracket',category:null,enabled:true,manufacturerIds:[details.products[0].manufacturerId],productIds:[]});
 const submit={draftId:a.id,version:1,expectedHash:before.previewHash,requestId:randomUUID(),confirmation:'I reviewed this MRF and want to submit it',acceptWarnings:false};await assert.rejects(async()=>store.submissions(user,'submit',submit),/requirements changed/);
 const ra=await store.submissions(user,'review',{draftId:a.id,version:1}),rb=await store.submissions(user,'review',{draftId:b.id,version:1});assert.equal(ra.ready,true);
 const [one,two]=await Promise.all([Promise.resolve().then(()=>store.submissions(user,'submit',{...submit,expectedHash:ra.previewHash})),Promise.resolve().then(()=>store.submissions(user,'submit',{...submit,draftId:b.id,requestId:randomUUID(),expectedHash:rb.previewHash}))]);assert.notEqual(one.number,two.number);assert.equal((await store.submissions(user,'list',{projectId:'riverside'})).total,2);
 await assert.rejects(async()=>store.submissions(user,'submit',{...submit,draftId:b.id,expectedHash:rb.previewHash}),/identifier is already used/);
}},
{name:'concurrent draft save and submission cannot silently change a submitted request',run:async store=>{
 const {user}=people();await store.member(user,'riverside');const body=draftBody.parse({projectId:'riverside',name:'Concurrent request',deliveryDate:'2026-11-10',version:0,lines:[{id:randomUUID(),quantity:'1',requestedUnit:'EA',description:'Unverified fixture',rawInput:{quantity:'1',requestedUnit:'EA',description:'Unverified fixture'},candidate:null,source:'user_description',deliveryMode:'inherit',overrideDate:null}]});const d=await store.saveDraft(user,body),review=await store.submissions(user,'review',{draftId:d.id,version:1});
 const results=await Promise.allSettled([Promise.resolve().then(()=>store.submissions(user,'submit',{draftId:d.id,version:1,expectedHash:review.previewHash,requestId:randomUUID(),confirmation:'I reviewed this MRF and want to submit it',acceptWarnings:true})),Promise.resolve().then(()=>store.saveDraft(user,{...body,version:1,name:'Changed in another tab'},String(d.id)))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const list=await store.submissions(user,'list',{projectId:'riverside'});if(list.total){const submitted=await store.submissions(user,'get',{id:list.records[0].id});assert.equal(submitted.snapshot.name,'Concurrent request');assert.equal((await store.getDraft(user,String(d.id))).version,1);}else assert.equal((await store.getDraft(user,String(d.id))).name,'Changed in another tab');
}},

{name:'user administration enforces Microsoft role ceilings, revocation, history and tenant isolation',run:async store=>{
 const {admin,user,foreign}=people();await store.admit(admin,true);await store.admit(user,true);await store.admit(foreign,true);
 const original=await store.users(admin,'detail',{oid:user.oid});assert.equal(original.active,true);
 const registered=await store.users(admin,'save',{oid:'registered-foreman',displayName:'Registered Fixture Foreman',active:true,roleLimit:null,projects:['northside'],version:0,reason:'Register this existing Microsoft identity before first sign-in.'});assert.equal(registered.version,1);const registrationHistory=await store.users(admin,'history',{oid:'registered-foreman'});assert.equal(registrationHistory.records[0].before,null);assert.equal(registrationHistory.records[0].after.displayName,'Registered Fixture Foreman');
 const body=draftBody.parse({projectId:'riverside',name:'Retain this request',deliveryDate:'2026-11-10',version:0,lines:[]});const saved=await store.saveDraft(user,body);
 const change={oid:user.oid,displayName:'Fixture Foreman',active:true,roleLimit:null,projects:['northside'],version:original.version,reason:'Limit this foreman to the Northside pilot project.'};
 await assert.rejects(async()=>store.users(user,'list',{}),/Administrator/);
 await assert.rejects(async()=>store.users(admin,'save',{...change,roleLimit:'Admin'}),/Microsoft first/);
 const limited=await store.users(admin,'save',change);await assert.rejects(async()=>store.getDraft(user,String(saved.id)),/Project not found/);
 await store.admit(user,true);await assert.rejects(async()=>store.listDrafts(user,'riverside'),/Project not found/);
 await assert.rejects(async()=>store.users(admin,'save',change),/changed elsewhere/);
 await store.users(admin,'save',{...change,version:limited.version,active:false,reason:'Deactivate this pilot account while retaining its saved MRFs.'});
 await assert.rejects(async()=>store.admit(user),/deactivated/);await assert.rejects(async()=>store.admit(user,true),/deactivated/);
 const deactivated=await store.users(admin,'detail',{oid:user.oid});const restored=await store.users(admin,'save',{...change,version:deactivated.version,projects:['riverside'],reason:'Restore access to the original request without replacing it.'});assert.equal(restored.active,true);await store.admit(user);assert.equal((await store.getDraft(user,String(saved.id))).name,'Retain this request');
 const history=await store.users(admin,'history',{oid:user.oid});assert.equal(history.total,3);assert.ok(history.records.some((r:any)=>r.before.active===true&&r.after.active===false));
 assert.equal((await store.users(foreign,'detail',{oid:user.oid})).displayName,user.oid);assert.equal((await store.users(foreign,'history',{oid:user.oid})).total,0);assert.equal((await store.users(foreign,'list',{})).total,1);
 const own=await store.users(admin,'detail',{oid:admin.oid});await assert.rejects(async()=>store.users(admin,'save',{...change,oid:admin.oid.toUpperCase(),version:own.version,active:false}),/your own/);
 const second={...admin,oid:'second-admin'};await store.admit(second,true);const secondRow=await store.users(admin,'detail',{oid:second.oid});await store.users(admin,'save',{...change,oid:second.oid,version:secondRow.version,roleLimit:'Foreman',projects:[],reason:'Restrict the second assigned administrator to foreman features.'});const effective=await store.admit(second);assert.deepEqual(effective.roles,['Foreman']);await assert.rejects(async()=>store.users(effective,'list',{}),/Administrator/);
}},

{name:'multiple named drafts remain independent, owned, paged and protected against stale saves',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');await store.member(user,'northside');await store.member(admin,'riverside');await store.member(foreign,'riverside');
 const item={id:randomUUID(),quantity:'2.5',requestedUnit:'EA',description:'User-entered fixture part',rawInput:{quantity:'2.5',requestedUnit:'EA',description:'User-entered fixture part'},candidate:null,source:'user_description',deliveryMode:'inherit',overrideDate:null,purchasing:{productId:null,manufacturer:'Fixture Maker',partNumber:'PART-A',noSubstitutions:true}};
 const body=draftBody.parse({projectId:'riverside',name:'Level 2 Rough-In',deliveryDate:'2026-11-10',version:0,lines:[item]});
 const a=await store.saveDraft(user,body),b=await store.saveDraft(user,{...body,name:'Parking Lot Lighting',deliveryDate:'2026-11-20',lines:[]});assert.notEqual(a.id,b.id);
 let list=await store.listDrafts(user,'riverside');assert.equal(list.total,2);assert.equal(list.records.find(r=>r.id===a.id)!.itemCount,1);assert.equal(list.records.find(r=>r.id===b.id)!.name,'Parking Lot Lighting');
 assert.equal((await store.listDrafts(admin,'riverside')).total,0);assert.equal((await store.listDrafts(foreign,'riverside')).total,0);assert.equal((await store.listDrafts(user,'northside')).total,0);
 await assert.rejects(async()=>store.getDraft(admin,String(a.id)),/not found/);await assert.rejects(async()=>store.getDraft(foreign,String(a.id)),/not found/);
 const renamed=await store.saveDraft(user,{...body,version:1,name:'Level 2 Rough-In — revised',deliveryDate:'2026-11-12'},String(a.id));assert.equal(renamed.version,2);assert.equal(renamed.lines[0].purchasing?.noSubstitutions,true);
 assert.equal((await store.getDraft(user,String(b.id))).deliveryDate,'2026-11-20');assert.equal((await store.getDraft(user,String(b.id))).version,1);
 const compatible=await store.saveDraft(user,{...body,name:undefined,version:1,lines:[]},String(b.id));assert.equal(compatible.name,'Parking Lot Lighting');
 await assert.rejects(async()=>store.saveDraft(user,{...body,version:1},String(a.id)),/changed elsewhere/);
 await assert.rejects(async()=>store.saveDraft(user,{...body,projectId:'northside',version:2},String(a.id)),/cannot be moved/);
 for(let i=0;i<26;i++)await store.saveDraft(user,{...body,name:`Extra request ${i}`,lines:[]});list=await store.listDrafts(user,'riverside');assert.equal(list.records.length,25);assert.equal(list.total,28);const next=await store.listDrafts(user,'riverside',2);assert.equal(next.records.length,3);assert.equal(new Set([...list.records,...next.records].map(r=>r.id)).size,28);
 assert.throws(()=>draftBody.parse({...body,name:'   '}));assert.throws(()=>draftBody.parse({...body,name:'x'.repeat(121)}));
}},

{name:'reviewed corrections preserve MRF snapshots and reject forged history',run:async store=>{
 const {admin,user,foreign}=people();await store.member(user,'riverside');
 const input={...bracket(),verification:'reviewed'},m=await store.catalogCommand(admin,'material',input),prod=await store.catalogCommand(admin,'product',product('bracket'));
 const c=(await store.search(user,'Fixture Alpha TEST-1624','riverside'))[0];
 const body=draftBody.parse({projectId:'riverside',deliveryDate:'2026-11-10',version:0,lines:[{id:randomUUID(),quantity:'2',requestedUnit:'EA',description:c.description,rawInput:{quantity:'2',requestedUnit:'EA',description:'Fixture Alpha bracket'},candidate:c,source:c.source,deliveryMode:'inherit',overrideDate:null,purchasing:{productId:prod.id,manufacturer:'Fixture Alpha',partNumber:'TEST-1624',noSubstitutions:true}}]});
 const saved=await store.saveDraft(user,body);
 const correction={id:m.id,reason:'Correct documented nominal spacing and source.',material:{...input,attributes:{...input.attributes,nominalSpacing:'16 to 24 in.'},sourceUrl:'https://example.invalid/corrected'}};
 await assert.rejects(async()=>store.catalogCommand(user,'preview-material-correction',correction),/Administrator/);
 await assert.rejects(async()=>store.catalogCommand(foreign,'preview-material-correction',correction),/not found/);
 const preview=await store.catalogCommand(admin,'preview-material-correction',correction);assert.equal(preview.mode,'metadata');assert.equal(preview.impact.savedLines,1);
 await assert.rejects(async()=>store.catalogCommand(admin,'apply-material-correction',{...correction,expectedHash:preview.previewHash}),/Explicit/);
 const apply={...correction,expectedHash:preview.previewHash,approval:'I reviewed the correction and historical impact'};
 const revision=await store.catalogCommand(admin,'apply-material-correction',apply);assert.equal((await store.catalogCommand(admin,'apply-material-correction',apply)).id,revision.id);
 const original=saved.lines[0].candidate;
 const resave=draftBody.parse({deliveryDate:saved.deliveryDate,version:Number(saved.version),projectId:'riverside',lines:[{...saved.lines[0],quantity:'3'}]});
 const updated=await store.saveDraft(user,resave,String(saved.id));assert.deepEqual(updated.lines[0].candidate,original);assert.equal(updated.lines[0].purchasing?.partNumber,'TEST-1624');
 await assert.rejects(async()=>store.saveDraft(user,{...resave,version:Number(updated.version),lines:[{...resave.lines[0],candidate:{...resave.lines[0].candidate!,description:'Forged historical description'}}]},String(saved.id)),/snapshot/);
 const details=await store.catalogCommand(admin,'details',{id:m.id});assert.equal(details.verification,'provisional');assert.match(details.description,/16 to 24/);
 const history=await store.catalogCommand(admin,'page',{section:'revisions',entityId:m.id});assert.equal(history.total,1);
 assert.equal((await store.catalogCommand(foreign,'page',{section:'revisions',entityId:m.id})).total,0);
 const record=await store.catalogCommand(admin,'revision-details',{id:revision.id});assert.equal(record.reason,correction.reason);
 await assert.rejects(async()=>store.catalogCommand(foreign,'revision-details',{id:revision.id}),/not found/);
}},
{name:'specification and part identity changes retain old records and stop purchasing retired references',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');const m=await store.catalogCommand(admin,'material',material());
 const prod=await store.catalogCommand(admin,'product',product('pvc'));
 const correction={id:prod.id,reason:'Correct the documented manufacturer part number.',product:product('pvc','Fixture Alpha','TEST-CORRECTED')};
 const preview=await store.catalogCommand(admin,'preview-product-correction',correction);assert.equal(preview.mode,'replacement');
 const result=await store.catalogCommand(admin,'apply-product-correction',{...correction,expectedHash:preview.previewHash,approval:'I reviewed the correction and historical impact'});assert.notEqual(result.replacementId,prod.id);
 assert.equal((await store.catalogCommand(admin,'page',{section:'revisions',entityId:m.id})).total,1);
 const bad=await store.catalogCommand(user,'validate-lines',{projectId:'riverside',lines:[{id:randomUUID(),candidate:{id:m.id},purchasing:{productId:prod.id,manufacturer:'Fixture Alpha',partNumber:'TEST-1624',noSubstitutions:true}}]});assert.equal(bad.ready,false);
 const next={id:m.id,reason:'Correct the actual conduit schedule to 80.',material:material('corrected-pvc','80')};
 const p=await store.catalogCommand(admin,'preview-material-correction',next);assert.equal(p.mode,'replacement');
 await assert.rejects(async()=>store.catalogCommand(admin,'apply-material-correction',{...next,reason:'Different reason makes the review stale.',expectedHash:p.previewHash,approval:'I reviewed the correction and historical impact'}),/Preview it again/);
 const fixed=await store.catalogCommand(admin,'apply-material-correction',{...next,expectedHash:p.previewHash,approval:'I reviewed the correction and historical impact'});
 assert.equal((await store.catalogCommand(admin,'details',{id:m.id})).active,false);assert.equal((await store.catalogCommand(admin,'details',{id:fixed.replacementId})).active,true);
 assert.equal((await store.catalogCommand(user,'validate-lines',{projectId:'riverside',lines:[{id:randomUUID(),candidate:{id:m.id}}]})).ready,false);
 await assert.rejects(async()=>store.catalogCommand(admin,'preview-material-correction',{id:fixed.replacementId,reason:'Try to point back to retired original specifications.',material:material('another-key')}),/retired/);
}},
{name:'retired product snapshots remain editable drafts and correction targets are reviewed for staleness',run:async store=>{
 const {admin,user}=people();await store.member(user,'riverside');
 const original={...bracket(),origin:'ai_import',verification:'provisional'},m=await store.catalogCommand(admin,'material',original),prod=await store.catalogCommand(admin,'product',product('bracket'));
 const c=(await store.search(user,'Fixture Alpha TEST-1624','riverside'))[0];
 const body=draftBody.parse({projectId:'riverside',deliveryDate:'2026-11-10',version:0,lines:[{id:randomUUID(),quantity:'2',requestedUnit:'EA',description:c.description,rawInput:{quantity:'2',requestedUnit:'EA',description:'Fixture Alpha bracket'},candidate:c,source:c.source,deliveryMode:'inherit',overrideDate:null,purchasing:{productId:prod.id,manufacturer:'Fixture Alpha',partNumber:'TEST-1624',noSubstitutions:true}}]});
 const saved=await store.saveDraft(user,body);
 const next={id:prod.id,reason:'Correct manufacturer part number based on source evidence.',product:product('bracket','Fixture Alpha','CORRECTED')};const preview=await store.catalogCommand(admin,'preview-product-correction',next);
 const target=await store.catalogCommand(admin,'product',next.product);
 await assert.rejects(async()=>store.catalogCommand(admin,'apply-product-correction',{...next,expectedHash:preview.previewHash,approval:'I reviewed the correction and historical impact'}),/Preview it again/);
 const refreshed=await store.catalogCommand(admin,'preview-product-correction',next);const done=await store.catalogCommand(admin,'apply-product-correction',{...next,expectedHash:refreshed.previewHash,approval:'I reviewed the correction and historical impact'});assert.equal(done.replacementId,target.id);
 const resave=draftBody.parse({projectId:'riverside',deliveryDate:'2026-11-12',version:Number(saved.version),lines:[{...saved.lines[0],quantity:'4'}]});const updated=await store.saveDraft(user,resave,String(saved.id));assert.equal(updated.lines[0].purchasing?.partNumber,'TEST-1624');assert.equal(updated.lines[0].quantity,'4');
 await assert.rejects(async()=>store.saveDraft(user,{...resave,version:Number(updated.version),lines:[{...resave.lines[0],purchasing:{...resave.lines[0].purchasing!,manufacturer:'Forged maker'}}]},String(saved.id)),/Product|product|snapshot/);
 await assert.rejects(async()=>store.catalogCommand(admin,'preview-product-correction',{id:target.id,reason:'Do not reuse a retired manufacturer identity.',product:product('bracket')}),/retired/);
 const fix={id:m.id,reason:'Update source evidence while preserving the AI origin.',material:{...original,origin:'admin_reviewed',sourceUrl:'https://example.invalid/corrected'}};const p=await store.catalogCommand(admin,'preview-material-correction',fix);await store.catalogCommand(admin,'apply-material-correction',{...fix,expectedHash:p.previewHash,approval:'I reviewed the correction and historical impact'});
 assert.equal((await store.catalogCommand(admin,'details',{id:m.id})).attributes.recordOrigin,'ai_import');
 const changed={id:m.id,reason:'Correct actual maximum spread to 26 inches.',material:{...original,externalKey:'corrected-span',attributes:{...original.attributes,maxSpanIn:26}}};const cp=await store.catalogCommand(admin,'preview-material-correction',changed);await store.catalogCommand(admin,'apply-material-correction',{...changed,expectedHash:cp.previewHash,approval:'I reviewed the correction and historical impact'});
 const historical=draftBody.parse({projectId:'riverside',deliveryDate:'2026-11-13',version:Number(updated.version),lines:updated.lines});const kept=await store.saveDraft(user,historical,String(saved.id));assert.deepEqual(kept.lines[0].candidate,saved.lines[0].candidate);
}},
{name:'duplicate retirement requires reviewed identical specifications and retains source history',run:async store=>{
 const {admin,user}=people();const fixture=readFileSync(new URL('../db/fixtures/catalog.csv',import.meta.url),'utf8');const batch=await store.previewImport(admin,fixture);await store.applyImport(admin,batch.id,'I reviewed this batch',true);
 const legacy=(await store.catalogCommand(admin,'page',{section:'materials'})).records[0];
 const retained=await store.catalogCommand(admin,'material',{...material('canonical'),verification:'reviewed'});
 const source=await store.catalogCommand(admin,'details',{id:legacy.id});
 // The legacy source must have the same unit as the retained structured item.
 const canonical=await store.catalogCommand(admin,'material',{externalKey:'reviewed-legacy-match',category:'general',attributes:{type:'Reviewed legacy fixture',specification:'Explicitly compared synthetic duplicate specifications'},productUnit:source.productUnit,verification:'reviewed',sourceUrl:'https://example.invalid/fixture',verificationBasis:'Synthetic fixture reviewed for duplicate-retirement test only.'});
 const spec={externalKey:'reviewed-legacy-match',category:'general',attributes:{type:'Reviewed legacy fixture',specification:'Explicitly compared synthetic duplicate specifications'},productUnit:source.productUnit,verification:'reviewed',sourceUrl:'https://example.invalid/fixture',verificationBasis:'Synthetic fixture reviewed for duplicate-retirement test only.'};
 const data={sourceId:source.id,targetId:canonical.id,specifications:spec,phrases:[source.description],reason:'Compared the legacy record and verified matching specifications.'};
 await assert.rejects(async()=>store.catalogCommand(admin,'preview-duplicate-retirement',{...data,phrases:['Invented unsupported phrase']}),/recorded/);
 const preview=await store.catalogCommand(admin,'preview-duplicate-retirement',data);
 const done=await store.catalogCommand(admin,'apply-duplicate-retirement',{...data,expectedHash:preview.previewHash,approval:'I reviewed the correction and historical impact'});
 assert.equal(done.replacementId,canonical.id);assert.equal((await store.catalogCommand(admin,'details',{id:source.id})).active,false);
 const phrases=await store.catalogCommand(admin,'page',{section:'translations',materialId:canonical.id});assert.ok(phrases.records.some((r:any)=>r.phrase===source.description&&r.origin==='admin_reviewed'));
 const different=await store.catalogCommand(admin,'material',{...material('different','80'),verification:'reviewed'});
 await assert.rejects(async()=>store.catalogCommand(admin,'preview-duplicate-retirement',{...data,sourceId:retained.id,targetId:different.id,specifications:{...material('different','80'),verification:'reviewed'},phrases:[]}),/different specifications/);
 await assert.rejects(async()=>store.catalogCommand(user,'preview-duplicate-retirement',data),/Administrator/);
}},

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
