import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import type {Operation} from './catalog-v2';
import {researchPolicy} from './research-policy';
export function* researchLedger(p:Principal,action:string,data:unknown):Operation<any>{
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Live AI research is limited to administrators during development.');
 const period=new Date().toISOString().slice(0,7);
 if(action==='usage'||action==='reserve'){
  const rows=yield {text:"SELECT target FROM audit_events WHERE tenant=@p0 AND action='ai.research.reserved' AND target LIKE @p1",values:[p.tenant,period+'/%']};
  const settled=yield {text:"SELECT target FROM audit_events WHERE tenant=@p0 AND action='ai.research.settled' AND target LIKE @p1",values:[p.tenant,period+'/%']};
  const costs=new Map<string,number>();for(const row of settled){const parts=String(row.target).split('/'),cost=Number(parts[2]);if(costs.has(parts[1])||!Number.isSafeInteger(cost)||cost<0||cost>researchPolicy.reservationMicroUsd)throw new ApiError(503,'AI budget ledger requires review.');costs.set(parts[1],cost);}
  let committed=0,held=0,successful=0;for(const row of rows){const parts=String(row.target).split('/'),reserve=Number(parts[2]);if(reserve!==researchPolicy.reservationMicroUsd)throw new ApiError(503,'AI budget ledger requires review.');if(costs.has(parts[1])){committed+=costs.get(parts[1])!;successful+=costs.get(parts[1])!;}else{committed+=reserve;held+=reserve;}}
  if(action==='usage')return {period,limitUsd:researchPolicy.monthlyMicroUsd/1e6,reservedUsd:committed/1e6,heldUsd:held/1e6,estimatedSuccessfulUsd:successful/1e6,requests:rows.length,reservationUsd:researchPolicy.reservationMicroUsd/1e6};
  const input=z.object({requestId:z.uuid()}).strict().parse(data),target=period+'/'+input.requestId+'/'+researchPolicy.reservationMicroUsd;
  const prior=yield {text:"SELECT id FROM audit_events WHERE tenant=@p0 AND action='ai.research.reserved' AND target LIKE @p1",values:[p.tenant,'%/'+input.requestId+'/%']};
  if(prior.length)throw new ApiError(409,'This research request was already reserved. No automatic paid retry.');
  if(committed+researchPolicy.reservationMicroUsd>researchPolicy.monthlyMicroUsd)throw new ApiError(429,'The $30 monthly AI allowance is committed. Catalog searches and saved research remain available.');
  yield {text:'INSERT INTO audit_events(id,tenant,actor,action,target,at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5)',values:[randomUUID(),p.tenant,p.oid,'ai.research.reserved',target,new Date().toISOString()]};return {reservedUsd:researchPolicy.reservationMicroUsd/1e6};
 }
 if(action==='save'){
  const input=z.object({id:z.uuid(),requestId:z.uuid(),actualCostMicroUsd:z.number().int().min(0).max(researchPolicy.reservationMicroUsd),digest:z.string().regex(/^[a-f0-9]{64}$/),payload:z.string().max(500000)}).strict().parse(data);
  const reservations=yield {text:"SELECT target FROM audit_events WHERE tenant=@p0 AND actor=@p1 AND action='ai.research.reserved' AND target LIKE @p2",values:[p.tenant,p.oid,'%/'+input.requestId+'/%']};if(reservations.length!==1)throw new ApiError(409,'Research reservation not found.');const reservedPeriod=String(reservations[0].target).split('/')[0];
  const settled=yield {text:"SELECT id FROM audit_events WHERE tenant=@p0 AND action='ai.research.settled' AND target LIKE @p1",values:[p.tenant,'%/'+input.requestId+'/%']};if(settled.length)throw new ApiError(409,'Research usage was already settled.');
  yield {text:"INSERT INTO catalog_batches(id,tenant,digest,state,csv,report,created_at) VALUES(@p0,@p1,@p2,'ai-research',@p3,@p4,@p5)",values:[input.id,p.tenant,input.digest,input.payload,JSON.stringify({workflow:'live-research-v1',actor:p.oid}),new Date().toISOString()]};
  // Settle to returned token usage atomically with the saved research. Unknown/failed usage stays fully reserved.
  yield {text:'INSERT INTO audit_events(id,tenant,actor,action,target,at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5)',values:[randomUUID(),p.tenant,p.oid,'ai.research.settled',`${reservedPeriod}/${input.requestId}/${input.actualCostMicroUsd}`,new Date().toISOString()]};return {id:input.id};
 }
 if(action==='get'){
  const input=z.object({id:z.uuid()}).strict().parse(data);const row=(yield {text:"SELECT csv,report FROM catalog_batches WHERE id=@p0 AND tenant=@p1 AND state='ai-research'",values:[input.id,p.tenant]})[0];
  if(!row||JSON.parse(row.report).actor!==p.oid)throw new ApiError(404,'Research not found.');return JSON.parse(row.csv);
 }
 if(action==='cached'){
  const input=z.object({cacheKey:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(data);
  const rows=yield {text:"SELECT id,csv,report,created_at FROM catalog_batches WHERE tenant=@p0 AND state='ai-research' AND created_at>=@p1 ORDER BY created_at DESC",values:[p.tenant,new Date(Date.now()-86400000).toISOString()]};
  for(const row of rows){const payload=JSON.parse(row.csv);if(payload.cacheKey===input.cacheKey&&JSON.parse(row.report).actor===p.oid)return {id:String(row.id).toLowerCase(),...payload,cached:true};}return null;
 }
 throw new ApiError(404,'Unknown research ledger operation.');
}
