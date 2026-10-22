import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ApiError,type Principal,unit} from './contracts';
import {query,audit,materialById,addPhrase,type Operation} from './catalog-v2';
import {compareSpecifications} from './specification-search';
import {matchesPhysicalSearch} from './material-search-constraints';
const text=z.string().trim().min(1).max(2000);
const record=z.object({id:z.uuid(),projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),draftId:z.uuid().nullable().optional(),searchPhrase:text,description:text,quantity:z.string().regex(/^(?:\d{1,12}(?:\.\d{1,6})?|\.\d{1,6})$/).refine(v=>Number(v)>0),unit}).strict();
export function* reportManual(p:Principal,data:unknown):Operation<any>{
 const v=record.parse(data);const h=createHash('sha256').update(JSON.stringify([p.tenant,p.oid,v.projectId,v.id].map(s=>s.toLowerCase()))).digest('hex');const eventId=h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);
 if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,v.projectId)).length)throw new ApiError(404,'Job not found.');
 if(v.draftId&&!(yield* query('SELECT id FROM drafts WHERE tenant=@p0 AND owner=@p1 AND project=@p2 AND id=@p3',p.tenant,p.oid,v.projectId,v.draftId)).length)throw new ApiError(404,'MRF not found.');
 const prior=(yield* query('SELECT * FROM manual_item_reports WHERE tenant=@p0 AND id=@p1',p.tenant,eventId))[0];
 if(prior){if(prior.actor!==p.oid||prior.project!==v.projectId)throw new ApiError(409,'Manual-entry identifier already used.');
  if(prior.draft_id&&v.draftId&&String(prior.draft_id).toLowerCase()!==v.draftId.toLowerCase())return {id:eventId,recorded:true,unchanged:true};
  const changed=prior.description!==v.description||prior.quantity!==v.quantity||prior.unit!==v.unit;
  if(prior.status==='pending'&&(changed||v.draftId&&String(prior.draft_id??'').toLowerCase()!==v.draftId.toLowerCase()))yield* query('UPDATE manual_item_reports SET description=@p0,quantity=@p1,unit=@p2,draft_id=@p3,version=version+1 WHERE tenant=@p4 AND id=@p5',v.description,v.quantity,v.unit,v.draftId??prior.draft_id,p.tenant,eventId);
  return {id:eventId,recorded:true,unchanged:!changed};
 }
 yield* query("INSERT INTO manual_item_reports(tenant,id,actor,project,draft_id,search_phrase,description,quantity,unit,status,resolution,created_at,version,line_id) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,'pending','',@p9,1,@p10)",p.tenant,eventId,p.oid,v.projectId,v.draftId??null,v.searchPhrase,v.description,v.quantity,v.unit,new Date().toISOString(),v.id);
 yield* audit(p,'manual_item.reported',eventId);return {id:eventId,recorded:true};
}
export function* manualReview(p:Principal,action:string,data:any):Operation<any>{
 if(action==='manual-report')return yield* reportManual(p,data);
 if(!['manual-count','manual-list','manual-resolve'].includes(action))throw new ApiError(404,'Unknown manual review operation.');
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');
 if(action==='manual-count')return {pending:Number((yield* query("SELECT COUNT(*) AS n FROM manual_item_reports WHERE tenant=@p0 AND status='pending'",p.tenant))[0].n)};
 if(action==='manual-list'){
  const v=z.object({status:z.enum(['pending','resolved','ignored','all']).default('pending'),text:z.string().max(200).default(''),project:z.string().max(64).default(''),page:z.number().int().min(1).max(100000).default(1)}).strict().parse(data);
  const all=yield* query('SELECT r.*,u.display_name,j.name AS job_name,d.name AS mrf_name FROM manual_item_reports r LEFT JOIN application_users u ON u.tenant=r.tenant AND u.oid=r.actor LEFT JOIN jobs j ON j.tenant=r.tenant AND j.id=r.project LEFT JOIN drafts d ON d.tenant=r.tenant AND d.id=r.draft_id WHERE r.tenant=@p0 ORDER BY r.created_at DESC,r.id',p.tenant);
  const counts=new Map<string,number>();for(const r of all){const key=r.description.toLowerCase().replace(/\s+/g,' ').trim();counts.set(key,(counts.get(key)??0)+1);}
  const filtered=all.filter(r=>(v.status==='all'||r.status===v.status)&&(!v.project||r.project===v.project)&&(!v.text||[r.description,r.search_phrase,r.display_name,r.actor,r.job_name,r.project].join(' ').toLowerCase().includes(v.text.toLowerCase()))),pages=Math.max(1,Math.ceil(filtered.length/25)),page=Math.min(v.page,pages);
  return {records:filtered.slice((page-1)*25,page*25).map(r=>({...r,id:String(r.id).toLowerCase(),material_id:r.material_id?String(r.material_id).toLowerCase():null,repeatCount:counts.get(r.description.toLowerCase().replace(/\s+/g,' ').trim())})),total:filtered.length,pages,page,pending:all.filter(r=>r.status==='pending').length,jobs:[...new Map(all.map(r=>[r.project,{id:r.project,name:r.job_name??r.project}])).values()]};
 }
 const v=z.object({id:z.uuid(),version:z.number().int().positive(),action:z.enum(['link','created','ignore','reopen']),materialId:z.uuid().optional(),learnPhrase:z.boolean().default(false),note:z.string().trim().min(3).max(1000)}).strict().parse(data);
 const r=(yield* query('SELECT * FROM manual_item_reports WHERE tenant=@p0 AND id=@p1',p.tenant,v.id))[0];if(!r)throw new ApiError(404,'Manual entry not found.');if(r.version!==v.version)throw new ApiError(409,'This report changed. Close this review, refresh the inbox, and review it again.');
 if(v.action!=='reopen'&&r.status!=='pending')throw new ApiError(409,'This entry is already reviewed. Reopen it first.');
 let materialId:string|null=null;
 if(v.action==='link'||v.action==='created'){
  if(!v.materialId)throw new ApiError(400,'Choose a catalog material.');const m=yield* materialById(p,v.materialId);if(!m.active)throw new ApiError(409,'Material is inactive.');materialId=v.materialId;
  if(v.learnPhrase){if(r.search_phrase.length>500)throw new ApiError(400,'This search phrase exceeds 500 characters; add a shorter phrase in Catalog and imports.');const profile=(yield* query('SELECT attributes FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,materialId))[0];const attrs=profile?JSON.parse(profile.attributes):{};const c=compareSpecifications(r.search_phrase,attrs,m.description);if(c.conflicts.length||c.missing.length||!matchesPhysicalSearch(r.search_phrase,attrs))throw new ApiError(409,'Phrase specifications are conflicting or incomplete. Resolve without learning, or correct the material first.');yield* addPhrase(p,materialId,r.search_phrase,'admin_reviewed');}
 }else if(v.learnPhrase)throw new ApiError(400,'Phrase learning requires a selected material.');
 const status=v.action==='ignore'?'ignored':v.action==='reopen'?'pending':'resolved';
 yield* query('UPDATE manual_item_reports SET status=@p0,material_id=@p1,resolution=@p2,reviewer=@p3,reviewed_at=@p4,version=version+1 WHERE tenant=@p5 AND id=@p6',status,materialId,v.note,p.oid,new Date().toISOString(),p.tenant,v.id);yield* audit(p,'manual_item.'+v.action,v.id);return {reviewed:true,status};
}
