import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import type {Operation,RecordRow} from './catalog-v2';
function* query(text:string,...values:unknown[]):Operation<RecordRow[]>{return yield {text,values};}
const issues={
 unreviewed:'Catalog specifications need review',
 legacy:'Materials need structured identity review',
 products:'Materials without manufacturer products',
 translations:'Materials without search phrases',
 images:'Materials without approved images',
 productReview:'Manufacturer products need review',
 pendingImages:'Uploaded images awaiting review',
} as const;
export function* catalogReadiness(p:Principal,data:unknown):Operation<any>{
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');
 const input=z.object({issue:z.enum(['unreviewed','legacy','products','translations','images','productReview','pendingImages']).default('unreviewed'),text:z.string().trim().max(200).default(''),page:z.number().int().min(1).max(100000).default(1)}).strict().parse(data);
 const base='m.tenant=@p0 AND m.active=1';
 const reviewed="EXISTS(SELECT 1 FROM catalog_profiles cp WHERE cp.tenant=m.tenant AND cp.material_id=m.id AND cp.verification='reviewed')";
 const rules={
 unreviewed:"EXISTS(SELECT 1 FROM catalog_profiles cp WHERE cp.tenant=m.tenant AND cp.material_id=m.id AND cp.verification='provisional')",
 legacy:'NOT EXISTS(SELECT 1 FROM catalog_profiles cp WHERE cp.tenant=m.tenant AND cp.material_id=m.id)',
 products:'NOT EXISTS(SELECT 1 FROM manufacturer_products mp WHERE mp.tenant=m.tenant AND mp.material_id=m.id AND mp.active=1)',
 translations:'NOT EXISTS(SELECT 1 FROM translations t WHERE t.tenant=m.tenant AND t.material_id=m.id AND t.active=1) AND NOT EXISTS(SELECT 1 FROM aliases a WHERE a.material_id=m.id)',
 images:"NOT EXISTS(SELECT 1 FROM image_associations ia WHERE ia.tenant=m.tenant AND ia.material_id=m.id AND ia.status='approved' AND (ia.product_id IS NULL OR EXISTS(SELECT 1 FROM manufacturer_products ip WHERE ip.tenant=m.tenant AND ip.material_id=m.id AND ip.id=ia.product_id AND ip.active=1)))",
 productReview:"mp.active=1 AND mp.verification='provisional'",
 pendingImages:"ia.status='pending' AND (ia.product_id IS NULL OR EXISTS(SELECT 1 FROM manufacturer_products ip WHERE ip.tenant=m.tenant AND ip.material_id=m.id AND ip.id=ia.product_id AND ip.active=1))",
 };
 const source=(issue:keyof typeof issues)=>issue==='productReview'?'materials m INNER JOIN manufacturer_products mp ON mp.material_id=m.id AND mp.tenant=m.tenant':issue==='pendingImages'?'materials m INNER JOIN image_associations ia ON ia.material_id=m.id AND ia.tenant=m.tenant':'materials m';
 const counts:Record<string,string>={activeMaterials:`SELECT COUNT(*) FROM materials m WHERE ${base}`,reviewedMaterials:`SELECT COUNT(*) FROM materials m WHERE ${base} AND ${reviewed}`,fixtureMaterials:`SELECT COUNT(*) FROM materials m WHERE ${base} AND m.dataset_kind='fixture'`,activeProducts:'SELECT COUNT(*) FROM manufacturer_products mp INNER JOIN materials m ON m.id=mp.material_id AND m.tenant=mp.tenant WHERE '+base+' AND mp.active=1',activePhrases:'SELECT COUNT(*) FROM translations t INNER JOIN materials m ON m.id=t.material_id AND m.tenant=t.tenant WHERE '+base+' AND t.active=1',stagedImports:"SELECT COUNT(*) FROM catalog_batches WHERE tenant=@p0 AND state='preview'",enabledRestrictions:'SELECT COUNT(*) FROM job_restrictions WHERE tenant=@p0 AND enabled=1'};
 for(const issue of Object.keys(issues) as (keyof typeof issues)[])counts[issue]=`SELECT COUNT(*) FROM ${source(issue)} WHERE ${base} AND (${rules[issue]})`;
 const raw=(yield* query('SELECT '+Object.entries(counts).map(([key,sql])=>`(${sql}) AS ${key}`).join(','),p.tenant))[0];
 const summary=Object.fromEntries(Object.keys(counts).map(key=>[key,Number(raw[key]) ]));
 const values:unknown[]=[p.tenant];let where=`${base} AND (${rules[input.issue]})`;
 if(input.text){values.push('%'+input.text.toLowerCase().replace(/[!%_\[]/g,c=>'!'+c)+'%');where+=" AND (LOWER(m.description) LIKE @p1 ESCAPE '!' OR LOWER(m.external_key) LIKE @p1 ESCAPE '!')";}
 const total=Number((yield* query(`SELECT COUNT(*) AS total FROM ${source(input.issue)} WHERE ${where}`,...values))[0].total);
 const pages=Math.max(1,Math.ceil(total/25)),page=Math.min(input.page,pages),offset=values.length;values.push((page-1)*25,page*25);
 const extra=input.issue==='productReview'?',mp.id AS related_id,mp.part_number AS related_label':input.issue==='pendingImages'?',ia.id AS related_id,ia.source_url AS related_label':'';
 const tie=input.issue==='productReview'?',mp.id':input.issue==='pendingImages'?',ia.id':'';
 const rows=yield* query(`SELECT * FROM (SELECT m.id,m.external_key,m.description${extra},ROW_NUMBER() OVER(ORDER BY m.external_key,m.id${tie}) AS row_num FROM ${source(input.issue)} WHERE ${where}) queue WHERE row_num>@p${offset} AND row_num<=@p${offset+1} ORDER BY row_num`,...values);
 return {summary,issue:input.issue,label:issues[input.issue],generatedAt:new Date().toISOString(),records:rows.map(row=>({materialId:String(row.id).toLowerCase(),materialKey:row.external_key,description:row.description,...(row.related_id?{relatedId:String(row.related_id).toLowerCase(),relatedLabel:row.related_label}:{})})),total,page,pages};
}
