import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Repository} from './repository';
import type {Principal} from './contracts';
import {defaultDesign} from '../src/global-design';
export const adminReviewScenarios:{name:string;run:(s:Repository)=>Promise<void>}[]=[
{name:'appearance drafts, publication and history are isolated, versioned and administrator controlled',run:async s=>{
 const tenant='appearance-'+randomUUID(),admin:Principal={tenant,oid:'admin',roles:['Admin']},user:Principal={tenant,oid:'worker',roles:['Foreman']};
 const settings={rules:{fields:{desktop:{paddingTop:0,paddingBottom:0}}},order:['entry','items']};
 await assert.rejects(async()=>s.catalogCommand(user,'appearance-get',{}));await assert.rejects(async()=>s.catalogCommand(user,'appearance-save',{version:0,settings}));
 const saved=await s.catalogCommand(admin,'appearance-save',{version:0,settings});assert.equal(saved.version,1);assert.deepEqual((await s.catalogCommand(user,'appearance-public',{})).published.rules,{});
 await assert.rejects(async()=>s.catalogCommand(admin,'appearance-publish',{version:0,settings}));
 const published=await s.catalogCommand(admin,'appearance-publish',{version:1,settings});assert.equal(published.history.length,1);assert.deepEqual((await s.catalogCommand(user,'appearance-public',{})).published,settings);
 assert.deepEqual((await s.catalogCommand({...user,tenant:tenant+'other'},'appearance-public',{})).published.rules,{});
 const restored=await s.catalogCommand(admin,'appearance-restore',{version:2,settings:published.history[0].settings});assert.deepEqual(restored.published.rules,{});
 await assert.rejects(async()=>s.catalogCommand(admin,'appearance-publish',{version:3,settings:{rules:{fields:{desktop:{color:'bad;display:none'}}},order:[]}}));
}},
{name:'manual MRF reporting is idempotent, scoped, and never creates a material automatically',run:async s=>{
 const tenant='manual-'+randomUUID(),admin:Principal={tenant,oid:'admin',roles:['Admin']},user:Principal={tenant,oid:'worker',roles:['Foreman']},foreign:Principal={...admin,tenant:tenant+'-other'};await s.member(user,'manual-job');
 const input={id:randomUUID(),projectId:'manual-job',searchPhrase:'new synthetic gizmo',description:'synthetic gizmo edited',quantity:'5',unit:'EA'};
 const report=await s.catalogCommand(user,'manual-report',input);await s.catalogCommand(user,'manual-report',input);
 const page=await s.catalogCommand(admin,'manual-list',{});assert.equal(page.total,1);assert.equal(page.pending,1);assert.equal(page.records[0].search_phrase,input.searchPhrase);assert.equal((await s.search(user,'synthetic gizmo')).length,0);
 await assert.rejects(async()=>s.catalogCommand(user,'manual-list',{}));assert.equal((await s.catalogCommand(foreign,'manual-list',{})).total,0);await assert.rejects(async()=>s.catalogCommand({...user,oid:'outsider'},'manual-report',{...input,id:randomUUID()}));
 await assert.rejects(async()=>s.catalogCommand(admin,'manual-resolve',{id:report.id,version:1,action:'link',materialId:randomUUID(),note:'Invalid material test'}));assert.equal((await s.catalogCommand(admin,'manual-count',{})).pending,1);
 await s.catalogCommand(admin,'manual-resolve',{id:report.id,version:1,action:'ignore',note:'Not a useful catalog addition.'});assert.equal((await s.catalogCommand(admin,'manual-count',{})).pending,0);
 await assert.rejects(async()=>s.catalogCommand(admin,'manual-resolve',{id:report.id,version:1,action:'ignore',note:'Stale review rejected.'}));
 await s.catalogCommand(admin,'manual-resolve',{id:report.id,version:2,action:'reopen',note:'Review again after clarification.'});assert.equal((await s.catalogCommand(admin,'manual-count',{})).pending,1);
}},
{name:'saved manual MRF lines reliably enter the inbox without duplicate reports on later saves',run:async s=>{
 const tenant='manual-save-'+randomUUID(),user:Principal={tenant,oid:'worker',roles:['Foreman']},admin:Principal={tenant,oid:'admin',roles:['Admin']};await s.member(user,'manual-job');
 const line={id:randomUUID(),quantity:'2',requestedUnit:'EA' as const,description:'Saved custom connector',rawInput:{quantity:'2',requestedUnit:'EA' as const,description:'custom connector'},candidate:null,source:'user_description' as const,deliveryMode:'inherit' as const,overrideDate:null};
 const body={projectId:'manual-job',deliveryDate:'2026-11-01',version:0,lines:[line]};const saved=await s.saveDraft(user,body);
 await s.saveDraft(user,{...body,version:Number(saved.version)},String(saved.id));const page=await s.catalogCommand(admin,'manual-list',{});assert.equal(page.total,1);assert.equal(String(page.records[0].draft_id).toLowerCase(),String(saved.id).toLowerCase());
 assert.equal((await s.search(user,'Saved custom connector')).length,0);
}},
{name:'manual phrase approval checks missing and conflicting specs and resolves atomically',run:async s=>{
 const tenant='manual-link-'+randomUUID(),user:Principal={tenant,oid:'worker',roles:['Foreman']},admin:Principal={tenant,oid:'admin',roles:['Admin']};await s.member(user,'manual-job');
 const m=await s.catalogCommand(admin,'material',{externalKey:'manual-coupling',category:'general',productUnit:'EA',attributes:{type:'coupling',specification:'socket center stop',diameterIn:1,material:'PVC'},verification:'provisional',sourceUrl:'',verificationBasis:'Synthetic manual review test only.'});
 const lineId=randomUUID();const recorded=await s.catalogCommand(user,'manual-report',{id:lineId,projectId:'manual-job',searchPhrase:'1" PVC sch 40 coupling',description:'1" PVC coupling',quantity:'5',unit:'EA'});const id=recorded.id;
 await assert.rejects(async()=>s.catalogCommand(admin,'manual-resolve',{id,version:1,action:'link',materialId:m.id,learnPhrase:true,note:'Reviewed match with missing schedule.'}));assert.equal((await s.catalogCommand(admin,'manual-count',{})).pending,1);assert.equal((await s.catalogCommand(admin,'translations',{id:m.id})).length,0);
 await s.catalogCommand(admin,'manual-resolve',{id,version:1,action:'link',materialId:m.id,learnPhrase:false,note:'Matched candidate without learning the missing schedule.'});assert.equal((await s.catalogCommand(admin,'manual-count',{})).pending,0);
 const secondLine=randomUUID();const recorded2=await s.catalogCommand(user,'manual-report',{id:secondLine,projectId:'manual-job',searchPhrase:'1" PVC coupling',description:'1" PVC coupling',quantity:'2',unit:'EA'});const id2=recorded2.id;
 await s.catalogCommand(admin,'manual-resolve',{id:id2,version:1,action:'link',materialId:m.id,learnPhrase:true,note:'Supported phrase approved.'});assert.equal((await s.catalogCommand(admin,'translations',{id:m.id})).length,1);
}},
{name:'global design is tenant scoped, administrator controlled, versioned and rejects injected CSS',run:async s=>{
 const tenant='design-'+randomUUID(),admin:Principal={tenant,oid:'admin',roles:['Admin']},user:Principal={tenant,oid:'worker',roles:['Foreman']};
 assert.deepEqual((await s.catalogCommand(user,'design-get',{})).settings,defaultDesign);
 const next=structuredClone(defaultDesign);next.field.paddingY=2;next.heading1.font='Georgia';
 await assert.rejects(async()=>s.catalogCommand(user,'design-save',{version:0,settings:next}));await s.catalogCommand(admin,'design-save',{version:0,settings:next});assert.equal((await s.catalogCommand(user,'design-get',{})).settings.field.paddingY,2);
 await assert.rejects(async()=>s.catalogCommand(admin,'design-save',{version:0,settings:next}));assert.equal((await s.catalogCommand({...admin,tenant:tenant+'other'},'design-get',{})).version,0);
 await assert.rejects(async()=>s.catalogCommand(admin,'design-save',{version:1,settings:{...next,field:{...next.field,color:'red; background:url(evil)'}}}));
}}
];
