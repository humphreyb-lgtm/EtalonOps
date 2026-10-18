import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import type {Operation,RecordRow} from './catalog-v2';
import type {DraftFilters} from '../src/draft-filters';
function* query(text:string,...values:unknown[]):Operation<RecordRow[]>{return yield {text,values};}
export const draftFilters=z.object({text:z.string().trim().max(120).default(''),deliveryFrom:z.iso.date().optional(),deliveryTo:z.iso.date().optional()}).strict().refine(f=>!f.deliveryFrom||!f.deliveryTo||f.deliveryFrom<=f.deliveryTo,'Delivery from must be on or before delivery through.');
export function* listSavedDrafts(p:Principal,project:string,page:number,filters:DraftFilters):Operation<{records:{id:string;name:string;projectId:string;deliveryDate:string;savedAt:string;itemCount:number;version:number}[];total:number;page:number;pages:number}>{
 z.enum(['riverside','northside']).parse(project);page=z.number().int().min(1).max(100000).parse(page);const input=draftFilters.parse(filters);
 if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,project)).length)throw new ApiError(404,'Project not found.');
 const values:unknown[]=[p.tenant,p.oid,project];let where='d.tenant=@p0 AND d.owner=@p1 AND d.project=@p2 AND NOT EXISTS(SELECT 1 FROM mrf_submissions s WHERE s.draft_id=d.id)';
 if(input.text){values.push('%'+input.text.toLowerCase().replace(/[!%_\[]/g,c=>'!'+c)+'%');where+=` AND LOWER(d.name) LIKE @p${values.length-1} ESCAPE '!'`;}
 if(input.deliveryFrom){values.push(input.deliveryFrom);where+=` AND d.delivery_date>=@p${values.length-1}`;}
 if(input.deliveryTo){values.push(input.deliveryTo);where+=` AND d.delivery_date<=@p${values.length-1}`;}
 const total=Number((yield* query(`SELECT COUNT(*) AS total FROM drafts d WHERE ${where}`,...values))[0].total),pages=Math.max(1,Math.ceil(total/25));page=Math.min(page,pages);const start=values.length;values.push((page-1)*25,page*25);
 const rows=yield* query(`SELECT * FROM (SELECT d.id,d.name,d.project,d.delivery_date,d.updated_at,d.version,(SELECT COUNT(*) FROM draft_lines l WHERE l.draft_id=d.id) AS item_count,ROW_NUMBER() OVER(ORDER BY d.updated_at DESC,d.id DESC) AS row_num FROM drafts d WHERE ${where}) saved WHERE row_num>@p${start} AND row_num<=@p${start+1} ORDER BY row_num`,...values);
 const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);
 return {records:rows.map(r=>({id:String(r.id).toLowerCase(),name:r.name,projectId:r.project,deliveryDate:iso(r.delivery_date).slice(0,10),savedAt:iso(r.updated_at),itemCount:Number(r.item_count),version:Number(r.version)})),total,page,pages};
}
