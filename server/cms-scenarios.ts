import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultCmsSite,cmsNode} from '../src/cms-model';
import type {Principal} from './contracts';
import type {Repository} from './repository';
export const cmsScenarios:{name:string;run:(s:Repository)=>Promise<void>}[]=[
{name:'CMS drafts publication permissions navigation history and tenants stay isolated',run:async s=>{
 const tenant='cms-'+randomUUID(),admin:Principal={tenant,oid:'admin',roles:['Admin']},worker:Principal={tenant,oid:'worker',roles:['Foreman']},anonymous:Principal={tenant,oid:'public',roles:[]};
 const base=await s.catalogCommand(admin,'cms-get',{});assert.equal(base.version,0);await assert.rejects(async()=>s.catalogCommand(worker,'cms-get',{}));
 const site=defaultCmsSite();const page={id:'page-fixture',title:'Crew information',slug:'crew-information',kind:'page' as const,visibility:'authenticated' as const,roles:[],enabled:true,description:'',css:'',root:cmsNode('container',{children:[cmsNode('heading',{text:'Crew information'})]})};site.pages.push(page);site.navigation.push({id:'crew-link',label:'Crew information',pageId:page.id,roles:[],newTab:false,children:[]});
 const draft=await s.catalogCommand(admin,'cms-save',{version:0,site});assert.equal(draft.version,1);assert.ok(!(await s.catalogCommand(worker,'cms-live',{})).site.pages.some((p:any)=>p.id===page.id));
 await assert.rejects(async()=>s.catalogCommand(worker,'cms-publish',{version:1,site}));const published=await s.catalogCommand(admin,'cms-publish',{version:1,site});assert.equal(published.version,2);const live=await s.catalogCommand(worker,'cms-live',{});assert.ok(live.site.pages.some((p:any)=>p.id===page.id));assert.ok(live.site.navigation.some((n:any)=>n.pageId===page.id));assert.ok(!live.site.pages.some((p:any)=>p.id==='page-materials'));assert.ok(!(await s.catalogCommand(anonymous,'cms-public',{})).site.pages.some((p:any)=>p.id===page.id));
 assert.equal((await s.catalogCommand({...admin,tenant:tenant+'-other'},'cms-get',{})).version,0);await assert.rejects(async()=>s.catalogCommand(admin,'cms-save',{version:0,site}));
 const prior=published.history[0].site;const restored=await s.catalogCommand(admin,'cms-restore',{version:2,site:prior});assert.equal(restored.version,3);assert.ok(!(await s.catalogCommand(worker,'cms-live',{})).site.pages.some((p:any)=>p.id===page.id));
}},
{name:'CMS public and role pages filter content reusable blocks and navigation with atomic validation',run:async s=>{
 const tenant='cms-public-'+randomUUID(),admin:Principal={tenant,oid:'admin',roles:['Admin']},worker:Principal={tenant,oid:'worker',roles:['Foreman']},pub:Principal={tenant,oid:'public',roles:[]};const site=defaultCmsSite();
 site.symbols.push({id:'public-symbol',name:'Public footer',root:cmsNode('text',{text:'Public footer text'})},{id:'private-symbol',name:'Private block',root:cmsNode('text',{text:'Private admin content'})});
 site.pages.push({id:'public-page',title:'Public information',slug:'information',kind:'page',visibility:'public',roles:[],enabled:true,description:'',css:'',root:cmsNode('container',{children:[cmsNode('symbol',{symbol:'public-symbol'})]})},{id:'admin-page',title:'Private information',slug:'admin-information',kind:'page',visibility:'roles',roles:['Admin'],enabled:true,description:'',css:'',root:cmsNode('container',{children:[cmsNode('symbol',{symbol:'private-symbol'})]})});
 await s.catalogCommand(admin,'cms-publish',{version:0,site});const publicSite=(await s.catalogCommand(pub,'cms-public',{})).site;assert.ok(publicSite.pages.some((p:any)=>p.id==='public-page'));assert.ok(!JSON.stringify(publicSite).includes('Private admin content'));assert.ok(!(await s.catalogCommand(worker,'cms-live',{})).site.pages.some((p:any)=>p.id==='admin-page'));
 const bad=structuredClone(site);bad.pages.find(p=>p.kind==='surface')!.root.children=[];await assert.rejects(async()=>s.catalogCommand(admin,'cms-save',{version:1,site:bad}));assert.equal((await s.catalogCommand(admin,'cms-get',{})).version,1);
}},
{name:'CMS media references protect images, publication controls anonymous access and uploads are tenant scoped',run:async s=>{
 const tenant='cms-media-'+randomUUID(),admin:Principal={tenant,oid:'admin',roles:['Admin']},worker:Principal={tenant,oid:'worker',roles:['Foreman']},pub:Principal={tenant,oid:'public',roles:[]},id=randomUUID();
 await s.catalogCommand(admin,'cms-media-put',{id,name:'Synthetic media fixture',mime:'image/webp',content:Buffer.from('synthetic-fixture').toString('base64')});await assert.rejects(async()=>s.catalogCommand(worker,'cms-media-put',{id:randomUUID(),name:'Denied',mime:'image/webp',content:'AA=='}));
 assert.equal((await s.catalogCommand(admin,'cms-media-list',{})).records.length,1);await assert.rejects(async()=>s.catalogCommand(pub,'cms-media-get',{id,public:true}));await assert.rejects(async()=>s.catalogCommand({...admin,tenant:tenant+'other'},'cms-media-get',{id}));
 const site=defaultCmsSite();site.pages.push({id:'media-page',title:'Media',slug:'media',kind:'page',visibility:'public',roles:[],enabled:true,description:'',css:'',root:cmsNode('container',{children:[cmsNode('image',{src:'/api/cms/media/'+id,alt:'Fixture'})]})});await s.catalogCommand(admin,'cms-save',{version:0,site});await assert.rejects(async()=>s.catalogCommand(admin,'cms-media-delete',{id}));await assert.rejects(async()=>s.catalogCommand(pub,'cms-media-get',{id,public:true}));await s.catalogCommand(admin,'cms-publish',{version:1,site});assert.equal((await s.catalogCommand(pub,'cms-media-get',{id,public:true})).name,'Synthetic media fixture');
 await assert.rejects(async()=>s.catalogCommand(worker,'cms-media-delete',{id}));const unused=randomUUID();await s.catalogCommand(admin,'cms-media-put',{id:unused,name:'Unused',mime:'image/webp',content:'AA=='});assert.equal((await s.catalogCommand(admin,'cms-media-delete',{id:unused})).deleted,true);
}}
];
