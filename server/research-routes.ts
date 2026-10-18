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
export function researchRoutes(app:express.Express,store:Repository,provider?:ProductResearchProvider,loadSource:(url:string)=>Promise<ResearchSource>=fetchResearchSource){
 app.get('/api/research/status',(_req,res)=>res.json({enabled:Boolean(provider)&&res.locals.principal.roles.includes('Admin'),mode:'manufacturer-pages',webSearch:false,policy:researchPolicy}));
 app.get('/api/admin/research/usage',async(_req,res)=>res.json({...await store.paidResearch(res.locals.principal,'usage',{}),enabled:Boolean(provider)}));
 app.post('/api/research/run',async(req,res)=>{
  const p=res.locals.principal;await store.requireAdmin(p);if(!provider)throw new ApiError(503,'Live manufacturer-page research is disabled.');
  const input=z.object({requestId:z.uuid(),scope:z.string().trim().min(1).max(2000),sourceUrls:z.array(z.url().max(2000)).min(1).max(3),searchPhrase:z.string().trim().max(500).default('')}).strict().parse(req.body);
  const sources:ResearchSource[]=[];for(const url of [...new Set(input.sourceUrls)])sources.push(await loadSource(url));
  for(const parent of [...sources])for(const link of parent.linkedDocuments??[]){if(sources.length>=3)break;if(sources.some(source=>source.url===link))continue;try{sources.push(await loadSource(link));}catch{parent.text+=' [Linked manufacturer PDF was unavailable or exceeded extraction limits; do not infer missing facts.]';}}
  if(Buffer.byteLength(JSON.stringify({scope:input.scope,sources}))>100000)throw new ApiError(413,'Source text exceeds the research limit. Use fewer or smaller pages.');
  const cacheKey=digest({scope:input.scope,searchPhrase:input.searchPhrase,sources,model:researchPolicy.model,version:researchPolicy.version});
  const cached=await store.paidResearch(p,'cached',{cacheKey});if(cached){res.json(cached);return;}
  checkResearchPricing();
  await store.paidResearch(p,'reserve',{requestId:input.requestId});
  try{const value=await provider.research(input.scope,sources);const id=randomUUID(),payload={cacheKey,results:value.results,searchPhrase:input.searchPhrase,sourceUrls:sources.map(source=>source.url),usage:{inputTokens:value.inputTokens,outputTokens:value.outputTokens,estimatedUsd:value.costMicroUsd/1e6,reservedUsd:researchPolicy.reservationMicroUsd/1e6},researchedAt:new Date().toISOString()};await store.paidResearch(p,'save',{id,requestId:input.requestId,actualCostMicroUsd:value.costMicroUsd,digest:digest({id,cacheKey}),payload:JSON.stringify(payload)});await store.audit(p,'ai.research.used',`${input.requestId}/${value.inputTokens}/${value.outputTokens}/${value.costMicroUsd}`);res.json({id,...payload,cached:false});}
  catch(error){await store.audit(p,'ai.research.failed',input.requestId);if(error instanceof ApiError)throw error;throw new ApiError(502,'Research failed. The reservation is retained; no automatic paid retry.');}
 });
 app.post('/api/research/select',async(req,res)=>{
  const p=res.locals.principal;await store.requireAdmin(p);const input=z.object({researchId:z.uuid(),index:z.number().int().min(0).max(researchPolicy.maxItems-1),eventId:z.uuid(),projectId:z.enum(['riverside','northside'])}).strict().parse(req.body);
  const session=await store.paidResearch(p,'get',{id:input.researchId}),item=(session.results as LiveResearch).items[input.index];if(!item||!session.searchPhrase)throw new ApiError(400,'Select a saved research candidate with an original search phrase.');
  res.json(await store.selectResearch(p,{eventId:input.eventId,projectId:input.projectId,phrase:session.searchPhrase,item}));
 });
 app.post('/api/research/stage',async(req,res)=>{
  const p=res.locals.principal;await store.requireAdmin(p);const input=z.object({researchId:z.uuid(),indices:z.array(z.number().int().min(0).max(researchPolicy.maxItems-1)).min(1).max(researchPolicy.maxItems)}).strict().parse(req.body);
  const session=await store.paidResearch(p,'get',{id:input.researchId});const results=withoutResearchImages(session.results);results.items=[...new Set(input.indices)].map(index=>{if(!results.items[index])throw new ApiError(400,'Unknown candidate.');return results.items[index];});
  res.json(await store.catalogCommand(p,'research-stage',{results,searchPhrase:session.searchPhrase,images:[...new Set(input.indices)].map(index=>session.results.items[index]).filter((item:any)=>item.imageUrl).map((item:any)=>({manufacturer:item.manufacturer,partNumber:item.partNumber,sourceUrl:item.imageUrl}))}));
 });
}
