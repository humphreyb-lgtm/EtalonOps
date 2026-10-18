import {isDeepStrictEqual} from 'node:util';
import {researchCandidate} from '../src/catalog-research';
import {researchGaps} from './research-output';
import {ResearchFailure} from './research-error';
import type express from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from './contracts';
import type {Repository} from './repository';
import type {ProductResearchProvider,LiveResearch} from './azure-research';
import {withoutResearchImages} from './azure-research';
import {fetchResearchSource,type ResearchSource} from './research-source';
import {researchPolicy,checkResearchPricing} from './research-policy';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function researchRoutes(app:express.Express,store:Repository,provider?:ProductResearchProvider,loadSource?: (url:string)=>Promise<ResearchSource>){
 app.get('/api/research/status',(_req,res)=>res.json({enabled:Boolean(provider)&&res.locals.principal.roles.includes('Admin'),mode:'assisted-research',webSearch:Boolean(provider?.discoveryEnabled),policy:researchPolicy}));
 app.get('/api/admin/research/usage',async(_req,res)=>res.json({...await store.paidResearch(res.locals.principal,'usage',{}),enabled:Boolean(provider)}));
 app.get('/api/research/history',async(_req,res)=>res.json(await store.paidResearch(res.locals.principal,'list',{})));
 app.get('/api/research/saved/:id',async(req,res)=>{const id=z.uuid().parse(req.params.id);res.json({id,...await store.paidResearch(res.locals.principal,'get',{id}),cached:true});});
 app.post('/api/research/run',async(req,res)=>{
  const p=res.locals.principal;await store.requireAdmin(p);if(!provider)throw new ApiError(503,'Live research is disabled.');
  const input=z.object({requestId:z.uuid(),scope:z.string().trim().min(1).max(2000),sourceUrls:z.array(z.url().max(2000)).max(3).default([]),searchPhrase:z.string().trim().max(500).default('')}).strict().parse(req.body);
  const cacheKey=digest({workflow:'assisted-v18',scope:input.scope,searchPhrase:input.searchPhrase,urls:input.sourceUrls,discovery:Boolean(provider.discoveryEnabled),model:researchPolicy.model,version:researchPolicy.version});
  const cached=await store.paidResearch(p,'cached',{cacheKey});if(cached){res.json(cached);return;}
  const sourceLoader=loadSource??((url:string)=>fetchResearchSource(url,0,input.scope));
  const sources:ResearchSource[]=[],attempted=new Set<string>(),gaps:string[]=[];
  let modelUsd=0,searchUsd=0,bingRequests=0,step=0;let discoveryRan=false;
  async function load(url:string){if(attempted.has(url)||sources.length>=4)return;attempted.add(url);try{const source=await sourceLoader(url);source.text=source.text.slice(0,22000);if(!sources.some(s=>s.url===source.url))sources.push(source);}catch{gaps.push('Could not read source: '+url);}}
  async function linked(){for(const parent of [...sources])for(const url of parent.linkedDocuments??[])await load(url);}
  async function paid(work:()=>Promise<{results:LiveResearch;inputTokens:number;outputTokens:number;costMicroUsd:number;modelMicroUsd?:number;searchMicroUsd?:number;bingRequests?:number}>,internalStep=false){
   checkResearchPricing();const requestId=step++===0?input.requestId:randomUUID();await store.paidResearch(p,'reserve',{requestId});
   try{const value=await work();if(!internalStep&&gaps.length)value.results.coverageNotes+=' '+gaps.join(' ').slice(0,1500);value.results.coverageNotes=value.results.coverageNotes.slice(0,4000);modelUsd+=(value.modelMicroUsd??value.costMicroUsd)/1e6;searchUsd+=(value.searchMicroUsd??0)/1e6;bingRequests+=value.bingRequests??0;
    const id=randomUUID(),payload={cacheKey:internalStep?digest({cacheKey,id}):cacheKey,internalStep,results:value.results,searchPhrase:input.searchPhrase,sourceUrls:sources.map(s=>s.url),usage:{inputTokens:value.inputTokens,outputTokens:value.outputTokens,estimatedUsd:modelUsd+searchUsd,modelUsd,searchUsd,bingRequests,reservedUsd:researchPolicy.reservationMicroUsd/1e6},researchedAt:new Date().toISOString()};
    await store.paidResearch(p,'save',{id,requestId,actualCostMicroUsd:value.costMicroUsd,digest:digest({id,cacheKey}),payload:JSON.stringify(payload)});return {id,...payload,cached:false};
   }catch(error){if(error instanceof ResearchFailure){if(error.diagnostic.code==='web-discovery-usage')await store.audit(p,'ai.research.cost_review',requestId);console.error('AI_RESEARCH_DIAGNOSTIC '+JSON.stringify({requestId,...error.diagnostic}));await store.audit(p,'ai.research.diagnostic',requestId+'/'+error.diagnostic.code);}await store.audit(p,'ai.research.failed',requestId);if(error instanceof ApiError)throw error;throw new ApiError(502,'Research failed. Reservation retained; no automatic paid retry.');}
  }
  async function discover(){
   discoveryRan=true;
   if(!provider?.discoveryEnabled||!provider.discover)throw new ApiError(503,'Web discovery needs activation for manufacturer/part-only requests. Supplied page links still work.');
   let urls:string[]=[];
   await paid(async()=>{const found=await provider.discover!(input.scope,input.sourceUrls);urls=found.urls;return {...found,results:{scope:input.scope,coverageNotes:found.notes,items:[]}};},true);
   for(const url of urls.slice(0,2))await load(url);await linked();for(const url of urls)await load(url);
  }
  for(const url of input.sourceUrls)await load(url);await linked();
  if(!sources.length)await discover();
  if(!sources.length)throw new ApiError(422,'Discovery completed, but no cited page could be read. Search usage is saved in AI usage. Try a manufacturer PDF or another link; no automatic retry.');
  let reply=await paid(()=>provider.research(input.scope,sources));
  // One bounded evidence follow-up only. Previously confirmed products remain in saved history.
  if(!discoveryRan&&input.sourceUrls.length&&provider.discoveryEnabled&&(!reply.results.items.length||reply.results.items.some(item=>item.missingFields?.length))){
   const before=sources.map(source=>source.url).join('|');if(sources.length>=4)sources.splice(3);
   try{await discover();if(sources.map(source=>source.url).join('|')!==before)reply=await paid(()=>provider.research(input.scope,sources));}
   catch(error){reply.results.coverageNotes+=' Supporting research stopped: '+(error instanceof Error?error.message:'Unavailable.');}
  }
  reply.results.coverageNotes=reply.results.coverageNotes.slice(0,4000);
  reply.usage={...reply.usage,estimatedUsd:modelUsd+searchUsd,modelUsd,searchUsd,bingRequests};
  const {id:_id,cached:_cached,...saved}=reply;await store.paidResearch(p,'finish',{id:reply.id,payload:JSON.stringify(saved)});
  res.json(reply);
 });
 app.post('/api/research/select',async(req,res)=>{
  const p=res.locals.principal;await store.requireAdmin(p);const input=z.object({researchId:z.uuid(),index:z.number().int().min(0).max(researchPolicy.maxItems-1),eventId:z.uuid(),projectId:z.enum(['riverside','northside'])}).strict().parse(req.body);
  const session=await store.paidResearch(p,'get',{id:input.researchId}),item=(session.results as LiveResearch).items[input.index];if(item&&researchGaps(item).length)throw new ApiError(400,'Complete the missing specifications in admin review before adding this product to an MRF.');if(!item||!session.searchPhrase)throw new ApiError(400,'Select a saved research candidate with an original search phrase.');
  const {missingFields:_missing,...candidate}=item;res.json(await store.selectResearch(p,{eventId:input.eventId,projectId:input.projectId,phrase:session.searchPhrase,item:candidate}));
 });
 app.post('/api/research/stage',async(req,res)=>{
  const p=res.locals.principal;await store.requireAdmin(p);const input=z.object({researchId:z.uuid(),indices:z.array(z.number().int().min(0).max(researchPolicy.maxItems-1)).min(1).max(researchPolicy.maxItems),edits:z.array(researchCandidate).max(researchPolicy.maxItems).optional()}).strict().parse(req.body);
  const session=await store.paidResearch(p,'get',{id:input.researchId});const results=withoutResearchImages(session.results);results.items=[...new Set(input.indices)].map(index=>{if(!results.items[index])throw new ApiError(400,'Unknown candidate.');return results.items[index];});if(input.edits){if(input.edits.length!==results.items.length)throw new ApiError(400,'Edits must match selected products.');results.items=input.edits.map((edited,index)=>({...edited,verificationBasis:isDeepStrictEqual(edited,results.items[index])?edited.verificationBasis:('Administrator-edited research candidate; verify changes against evidence. '+edited.verificationBasis).slice(0,2000)}));}
  res.json(await store.catalogCommand(p,'research-stage',{results,searchPhrase:session.searchPhrase,images:[...new Set(input.indices)].flatMap((index,i)=>{const item=session.results.items[index];return item.imageUrl&&item.manufacturer===results.items[i].manufacturer&&item.partNumber===results.items[i].partNumber?[{manufacturer:item.manufacturer,partNumber:item.partNumber,sourceUrl:item.imageUrl}]:[];})}));
 });
}
