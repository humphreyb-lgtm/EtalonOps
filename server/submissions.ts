import {resolveForeman} from './mrf-foreman';
import { createHash,randomUUID } from 'node:crypto';
import { z } from 'zod';
import { stringify } from 'csv-stringify/sync';
import { ApiError,type Principal } from './contracts';
import { validatePurchase,type Operation,type RecordRow } from './catalog-v2';
function* q(text:string,...values:unknown[]):Operation<RecordRow[]>{return yield {text,values};}
const identity=z.object({id:z.uuid()}).strict();
const reviewInput=z.object({draftId:z.uuid(),version:z.number().int().positive()}).strict();
const submitInput=reviewInput.extend({requestId:z.uuid(),expectedHash:z.string().regex(/^[a-f\d]{64}$/),confirmation:z.literal('I reviewed this MRF and want to submit it'),acceptWarnings:z.boolean()}).strict();
const day=(v:Date|string)=>v instanceof Date?v.toISOString().slice(0,10):String(v);
const guid=(v:unknown)=>String(v).toLowerCase();
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function submissionLabel(number:number,revision:number){return `MRF-${String(number).padStart(6,'0')}${revision>1?`-R${revision}`:''}`;}
function header(r:RecordRow){return {id:guid(r.id),number:submissionLabel(Number(r.mrf_number),Number(r.revision)),revision:Number(r.revision),previousId:r.previous_id?guid(r.previous_id):null,draftId:guid(r.draft_id),draftVersion:Number(r.draft_version),projectId:r.project,submittedAt:r.submitted_at};}
function* member(p:Principal,project:string):Operation<void>{if(!(yield* q('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,project)).length)throw new ApiError(404,'Project not found.');}
function* owned(p:Principal,id:string):Operation<RecordRow>{const r=(yield* q('SELECT * FROM mrf_submissions WHERE tenant=@p0 AND owner=@p1 AND id=@p2',p.tenant,p.oid,id))[0];if(!r)throw new ApiError(404,'Submitted MRF not found.');yield* member(p,String(r.project));return r;}
function detail(r:RecordRow){return {...header(r),snapshot:JSON.parse(r.snapshot),warnings:JSON.parse(r.warnings)};}
function* prepare(p:Principal,v:z.infer<typeof reviewInput>):Operation<any>{
 const d=(yield* q('SELECT * FROM drafts WHERE tenant=@p0 AND owner=@p1 AND id=@p2',p.tenant,p.oid,v.draftId))[0];if(!d)throw new ApiError(404,'Draft not found.');yield* member(p,String(d.project));
 if(Number(d.version)!==v.version)throw new ApiError(409,'This draft changed. Save or reload it, then review again.');
 if((yield* q('SELECT id FROM mrf_submissions WHERE draft_id=@p0',v.draftId)).length)throw new ApiError(409,'This MRF is already submitted. Open My Submitted MRFs to view it or create a revision.');
 const stored=yield* q('SELECT * FROM draft_lines WHERE draft_id=@p0 ORDER BY position',v.draftId);
 const lines=stored.map(l=>({id:guid(l.id),quantity:String(l.quantity),requestedUnit:l.requested_uom,taskCode:String(l.task_code??''),description:l.description,rawInput:JSON.parse(l.raw_input),candidate:l.candidate?JSON.parse(l.candidate):null,source:l.source,deliveryMode:l.delivery_mode,overrideDate:l.override_date?day(l.override_date):null,...(l.purchasing?{purchasing:JSON.parse(l.purchasing)}:{})}));
 const person=(yield* q('SELECT display_name FROM application_users WHERE tenant=@p0 AND oid=@p1',p.tenant,p.oid))[0];
 let foreman={id:String(d.foreman_oid??p.oid).toLowerCase(),name:String(d.foreman_name??p.displayName??person?.display_name??p.oid)},foremanError='';try{foreman=yield* resolveForeman(p,String(d.project),foreman.id);}catch(error){if(!(error instanceof ApiError))throw error;foremanError=error.message;}
 const jobMeta=(yield* q('SELECT name,number,status FROM jobs WHERE tenant=@p0 AND id=@p1',p.tenant,d.project))[0];
 const snapshot={id:guid(d.id),version:Number(d.version),projectId:String(d.project),projectName:String(jobMeta?.name??d.project),projectNumber:String(jobMeta?.number??''),name:d.name,deliveryDate:day(d.delivery_date),foreman,preparedBy:{id:p.oid,name:p.displayName??person?.display_name??p.oid},lines};
 const errors:{lineId:string|null;message:string}[]=[],warnings:{lineId:string;message:string}[]=[],evidence:unknown[]=[];
 if(foremanError)errors.push({lineId:null,message:foremanError});
 const job=jobMeta;if(job&&job.status!=='active')errors.push({lineId:null,message:'This job is archived.'});
 if(!String(d.name).trim())errors.push({lineId:null,message:'An MRF name is required.'});if(!lines.length)errors.push({lineId:null,message:'Add at least one material before submitting.'});
 for(const [i,line] of lines.entries()){
  const id=stored[i].material_id?guid(stored[i].material_id):null;
  try{yield* validatePurchase(p,String(d.project),id,line.purchasing);}catch(error){if(!(error instanceof ApiError))throw error;errors.push({lineId:line.id,message:error.message});}
  if(line.source.endsWith('_fixture'))warnings.push({lineId:line.id,message:'This item is a fictional demonstration fixture; it is not a verified real product.'});
  else if(!id)warnings.push({lineId:line.id,message:'This item uses a requester description; purchasing must verify its identity and specifications.'});
  if(id){
   const material=(yield* q('SELECT m.description,m.details,m.active,p.attributes,p.verification FROM materials m LEFT JOIN catalog_profiles p ON p.material_id=m.id AND p.tenant=m.tenant WHERE m.tenant=@p0 AND m.id=@p1',p.tenant,id))[0];evidence.push(material??null);
   if(material?.verification==='provisional'||line.candidate?.verification==='provisional')warnings.push({lineId:line.id,message:'This catalog item has provisional facts requiring purchasing review.'});
   if(material&&line.candidate&&(line.candidate.description!==material.description||JSON.stringify(line.candidate.specs)!==JSON.stringify(JSON.parse(material.details).specs)))warnings.push({lineId:line.id,message:'Catalog details changed after this line was saved. Review the original requested specifications.'});
  }
  if(line.purchasing?.productId){const product=(yield* q('SELECT * FROM manufacturer_products WHERE tenant=@p0 AND id=@p1',p.tenant,line.purchasing.productId))[0];evidence.push(product??null);if(product?.verification==='provisional')warnings.push({lineId:line.id,message:'The manufacturer product has provisional facts requiring purchasing review.'});}
  else if(line.purchasing?.manufacturer)warnings.push({lineId:line.id,message:'The requested manufacturer and part number are not linked to a verified catalog product.'});
 }
 const policies=yield* q('SELECT * FROM job_restrictions WHERE tenant=@p0 AND project=@p1 AND enabled=1 ORDER BY id',p.tenant,d.project);
 let previous:RecordRow|null=null;if(d.revision_of){previous=yield* owned(p,guid(d.revision_of));const latest=Number((yield* q('SELECT MAX(revision) AS latest FROM mrf_submissions WHERE tenant=@p0 AND mrf_number=@p1',p.tenant,Number(previous.mrf_number)))[0].latest);if(Number(previous.revision)!==latest)errors.push({lineId:null,message:'A newer revision was submitted. Create a revision from the latest submitted MRF.'});}
 return {snapshot:{...snapshot,reviewContext:{catalogEvidence:evidence,jobRestrictions:policies}},errors,warnings,ready:errors.length===0,previousId:previous?guid(previous.id):null,revisionTarget:previous?submissionLabel(Number(previous.mrf_number),Number(previous.revision)+1):null,previewHash:digest({snapshot,errors,warnings,evidence,policies,previousId:previous?guid(previous.id):null})};
}
export function* submissions(p:Principal,action:string,data:unknown):Operation<any>{
 if(action==='list'){
  const v=z.object({projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),page:z.number().int().min(1).max(100000).default(1)}).strict().parse(data);yield* member(p,v.projectId);
  const total=Number((yield* q('SELECT COUNT(*) AS total FROM mrf_submissions WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,v.projectId))[0].total),pages=Math.max(1,Math.ceil(total/25)),page=Math.min(v.page,pages);
  const rows=yield* q('SELECT * FROM (SELECT id,draft_id,draft_version,mrf_number,revision,previous_id,project,submitted_at,snapshot,ROW_NUMBER() OVER(ORDER BY submitted_at DESC,mrf_number DESC,revision DESC,id) AS n FROM mrf_submissions WHERE tenant=@p0 AND owner=@p1 AND project=@p2) s WHERE n>@p3 AND n<=@p4 ORDER BY n',p.tenant,p.oid,v.projectId,(page-1)*25,page*25);
  return {records:rows.map(r=>({...header(r),name:JSON.parse(r.snapshot).name,itemCount:JSON.parse(r.snapshot).lines.length})),total,page,pages};
 }
 if(action==='get'||action==='export'){const r=yield* owned(p,identity.parse(data).id);if(action==='get')return detail(r);const value=detail(r);return {filename:value.number+'.csv',csv:submittedCsv(value)};}
 if(action==='review')return yield* prepare(p,reviewInput.parse(data));
 if(action==='submit'){
  const v=submitInput.parse(data);let prior=(yield* q('SELECT * FROM mrf_submissions WHERE tenant=@p0 AND request_id=@p1',p.tenant,v.requestId))[0];
  if(prior&&(prior.owner!==p.oid||guid(prior.draft_id)!==v.draftId.toLowerCase()||Number(prior.draft_version)!==v.version||prior.preview_hash!==v.expectedHash))throw new ApiError(409,'Submission request identifier is already used.');
  prior=prior??(yield* q('SELECT * FROM mrf_submissions WHERE tenant=@p0 AND owner=@p1 AND draft_id=@p2',p.tenant,p.oid,v.draftId))[0];
  if(prior){if(Number(prior.draft_version)!==v.version||prior.preview_hash!==v.expectedHash)throw new ApiError(409,'The submitted MRF differs from this review. Open the saved submission.');yield* member(p,String(prior.project));return {...detail(prior),unchanged:true};}
  const review=yield* prepare(p,v);if(!review.ready)throw new ApiError(400,'Resolve the review errors before submitting.');if(review.previewHash!==v.expectedHash)throw new ApiError(409,'The MRF or purchasing requirements changed. Review it again; nothing was submitted.');if(review.warnings.length&&!v.acceptWarnings)throw new ApiError(400,'Acknowledge the unverified-item warnings before submitting.');
  const previous=review.previousId?yield* owned(p,review.previousId):null;
  const number=previous?Number(previous.mrf_number):Number((yield* q('SELECT MAX(mrf_number) AS last_number FROM mrf_submissions WHERE tenant=@p0',p.tenant))[0].last_number??0)+1,revision=previous?Number(previous.revision)+1:1,id=randomUUID(),at=new Date().toISOString();
  if(number>2000000000)throw new ApiError(409,'MRF numbering capacity requires administrator review.');
  yield* q('INSERT INTO mrf_submissions(id,tenant,owner,project,draft_id,draft_version,mrf_number,revision,previous_id,request_id,preview_hash,snapshot,warnings,submitted_at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13)',id,p.tenant,p.oid,review.snapshot.projectId,v.draftId,v.version,number,revision,review.previousId,v.requestId,v.expectedHash,JSON.stringify(review.snapshot),JSON.stringify(review.warnings),at);
  yield* q('INSERT INTO audit_events(id,tenant,actor,action,target,at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5)',randomUUID(),p.tenant,p.oid,'mrf.submitted',id,at);
  return detail((yield* owned(p,id)));
 }
 if(action==='revise'){
  const source=yield* owned(p,identity.parse(data).id),latest=Number((yield* q('SELECT MAX(revision) AS latest FROM mrf_submissions WHERE tenant=@p0 AND mrf_number=@p1',p.tenant,Number(source.mrf_number)))[0].latest);if(latest!==Number(source.revision))throw new ApiError(409,'Create a revision from the latest submitted MRF.');
  const pending=(yield* q('SELECT id FROM drafts WHERE tenant=@p0 AND owner=@p1 AND revision_of=@p2',p.tenant,p.oid,source.id))[0];if(pending)return {draftId:guid(pending.id),unchanged:true};
  const snapshot=JSON.parse(source.snapshot),id=randomUUID();yield* q('INSERT INTO drafts(id,tenant,owner,project,delivery_date,version,updated_at,name,revision_of) VALUES(@p0,@p1,@p2,@p3,@p4,1,@p5,@p6,@p7)',id,p.tenant,p.oid,source.project,snapshot.deliveryDate,new Date().toISOString(),snapshot.name,source.id);
  yield* q('UPDATE drafts SET foreman_oid=@p0,foreman_name=@p1 WHERE id=@p2 AND tenant=@p3',snapshot.foreman?.id??source.owner,snapshot.foreman?.name??source.owner,id,p.tenant);
  for(const [i,line] of snapshot.lines.entries())yield* q('INSERT INTO draft_lines(id,draft_id,position,material_id,quantity,requested_uom,description,raw_input,candidate,source,delivery_mode,override_date,purchasing,task_code) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13)',line.id,id,i,line.candidate&&['verified','verified_fixture'].includes(line.source)?line.candidate.id:null,line.quantity,line.requestedUnit,line.description,JSON.stringify(line.rawInput),line.candidate?JSON.stringify(line.candidate):null,line.source,line.deliveryMode,line.overrideDate,line.purchasing?JSON.stringify(line.purchasing):null,line.taskCode??'');
  return {draftId:id,unchanged:false};
 }
 throw new ApiError(404,'Submission operation not found.');
}
export function submittedCsv(value:any){
 const s=value.snapshot;const rows=s.lines.map((l:any,i:number)=>({mrf:value.number,revision:value.revision,name:s.name,project:s.projectId,job_name:s.projectName??s.projectId,job_number:s.projectNumber??'',foreman:s.foreman.name,prepared_by:s.preparedBy?.name??s.foreman.name,submitted_at:value.submittedAt,item:i+1,description:l.description,task_code:l.taskCode??'',specifications:l.candidate?.specs.join('; ')??'',quantity:l.quantity,unit:l.requestedUnit,product_unit:l.candidate?.productUnit??'',delivery_date:l.deliveryMode==='override'?l.overrideDate:s.deliveryDate,manufacturer:l.purchasing?.manufacturer??'',manufacturer_part_number:l.purchasing?.partNumber??'',no_substitutions:l.purchasing?.noSubstitutions?'YES':'NO',source:l.source,verification:l.candidate?.verification??'unverified',original_request:l.rawInput.description,review_warnings:value.warnings.filter((w:any)=>w.lineId===l.id).map((w:any)=>w.message).join('; ')}));
 return stringify(rows,{header:true,escape_formulas:true});
}
