import {createHash} from 'node:crypto';
import type {Principal} from '../../server/contracts';
import type {Repository} from '../../server/repository';
import {materialIdentity,materialInput,type MaterialInput} from '../../server/catalog-v2';
import type {WorkbookRow} from '../../src/material-workbook-format';
import {z} from 'zod';

export const importRecordSchema=z.object({ref:z.string().min(1).max(200),originalKey:z.string().max(100),row:z.record(z.string(),z.string()),material:materialInput,phrases:z.array(z.string().min(1).max(500)).max(100),baselineSignature:z.string().optional(),image:z.object({file:z.string().regex(/^images\/[a-zA-Z0-9_.-]+$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),sourceUrl:z.url(),width:z.number().positive(),height:z.number().positive()}).strict().optional()}).strict();
export type ImportRecord=z.infer<typeof importRecordSchema>;
export const packageSchema=z.object({format:z.literal('etalonops-publication-import-v1'),source:z.string().min(1).max(100),expectedTenantHash:z.string().regex(/^[a-f0-9]{64}$/),held:z.number().int().min(0).max(1000),records:z.array(importRecordSchema).min(1).max(1000)}).strict();
export function stable(value:any):any {if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
export const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
export const normId=(v:unknown)=>String(v??'').toLowerCase();
export function signature(m:any,profile:any){const details=JSON.parse(m.details??'{}'),a=profile?JSON.parse(profile.attributes):{};return hash({key:m.external_key,description:m.description,unit:m.product_uom,identity:materialIdentity(a.category??'general',m.product_uom,a),source:details.row?.source_url??'',notes:details.row?.verification_basis??''});}
function desiredSignature(m:MaterialInput){return hash({key:m.externalKey,description:m.displayDescription,unit:m.productUnit,identity:materialIdentity(m.category,m.productUnit,m.attributes),source:m.sourceUrl,notes:m.verificationBasis});}
export function reconcile(records:ImportRecord[],snapshot:any){
 const tables=snapshot.tables,mats=tables.materials as any[],profiles=new Map<string,any>((tables.catalog_profiles as any[]).map(p=>[normId(p.material_id),p]));
 const identities=new Map<string,any[]>();for(const m of mats){const p=profiles.get(normId(m.id));if(!p)continue;const a=JSON.parse(p.attributes),id=materialIdentity(a.category??'general',m.product_uom,a);identities.set(id,[...(identities.get(id)??[]),m]);}
 const prepared:WorkbookRow[]=[],seen=new Set<string>(),matches:any[]=[];
 for(const [i,r] of records.entries()){
  const identity=materialIdentity(r.material.category,r.material.productUnit,r.material.attributes);if(seen.has(identity))throw Error('Duplicate physical identity in package: '+r.ref);seen.add(identity);
  const byKey=r.originalKey?mats.find(m=>normId(m.external_key)===normId(r.originalKey)):undefined;
  if(r.originalKey&&!byKey)throw Error('Previously exported key is missing from live catalog: '+r.originalKey);
  const candidates=identities.get(identity)??[];if(candidates.length>1)throw Error('Multiple catalog materials match '+r.ref+'; resolve the duplicate first.');
  const match=byKey??candidates[0];if(match&&!match.active)throw Error('Matching material is retired: '+match.external_key);
  if(byKey){const p=profiles.get(normId(byKey.id));if(!p||!candidates.some(m=>normId(m.id)===normId(byKey.id)))throw Error('Existing key now has different physical specifications: '+r.originalKey);const current=signature(byKey,p);if(r.baselineSignature&&current!==r.baselineSignature&&current!==desiredSignature(r.material))throw Error('Existing material changed after the supplied snapshot: '+r.originalKey+'. Refresh the export before overwriting it.');}
  // Keyed baseline rows may receive the reviewed metadata update. A discovered
  // existing match retains its current wording/evidence and gains only phrases/images.
  const row:WorkbookRow=byKey?{...r.row}:match?{key:match.external_key,phrases:r.phrases.join('\n'),image:r.row.image??''}:{...r.row};
  if(match){row.key=match.external_key;const uploaded=(tables.image_associations??[]).some((x:any)=>normId(x.material_id)===normId(match.id)&&x.status==='approved');const reference=(tables.image_references??[]).some((x:any)=>normId(x.material_id)===normId(match.id)&&!x.product_id&&x.status==='approved');if(uploaded||reference)row.image='';}
  row._row=String(i+2);prepared.push(row);matches.push({ref:r.ref,identity,existingId:match?normId(match.id):null,existingKey:match?.external_key??null,kind:byKey?'reviewed metadata':match?'reuse':'new'});
 }
 return {prepared,matches};
}
export async function validateChunks(store:Repository,p:Principal,rows:WorkbookRow[],progress:(s:string)=>void=()=>{}){
 const chunks:{rows:WorkbookRow[];preview:any}[]=[];
 for(let i=0;i<rows.length;i+=50){const part=rows.slice(i,i+50),filename='R2-ready-'+String(i/50+1).padStart(2,'0')+'.xlsx';const preview=await store.catalogCommand(p,'material-workbook-preview',{filename,rows:part});if(preview.summary.errors||preview.summary.duplicates)throw Error('Import conflicts: '+JSON.stringify(preview.results.filter((r:any)=>['Needs correction','Duplicate in workbook'].includes(r.status))));chunks.push({rows:part,preview});progress(`Validated ${Math.min(i+50,rows.length)} / ${rows.length} materials`);}
 return chunks;
}
export async function applyChunk(store:Repository,p:Principal,rows:WorkbookRow[],filename:string,approveImages:boolean){
 // Recheck immediately inside the application's own revision-protected workflow.
 const preview=await store.catalogCommand(p,'material-workbook-preview',{filename,rows});if(preview.summary.errors||preview.summary.duplicates)throw Error('Catalog changed; a batch now has conflicts. Nothing further was applied.');
 if(!preview.summary.new&&!preview.summary.updated)return {summary:preview.summary,publication:null};
 // Without image approval, materials still import, but references remain unpublished.
 const batch=await store.catalogCommand(p,'material-workbook-apply',{filename,rows,previewHash:preview.previewHash});if(!batch.id)return {summary:batch.workbookSummary,publication:null};
 const itemIds=batch.items.filter((r:any)=>r.state==='unpublished'&&(approveImages||r.kind!=='image')).map((r:any)=>r.id);if(!itemIds.length)return {summary:batch.workbookSummary,publication:null,pendingImages:true};
 const plan=await store.catalogCommand(p,'inbox-plan',{id:batch.id,version:batch.version,itemIds});if(plan.held.length)throw Error('Publication has held records: '+JSON.stringify(plan.held));
 const published=await store.catalogCommand(p,'inbox-publish-ready',{id:batch.id,version:batch.version,itemIds,planHash:plan.planHash,approval:'I approve and publish these records'});
 return {summary:batch.workbookSummary,publication:published.publication};
}

export async function attachReviewedImages(store:Repository,p:Principal,records:ImportRecord[],matches:{existingId:string|null}[],images:Map<string,{bytes:Buffer;hash:string}>,assets:import('../../server/image-assets').ImageAssets,approve:boolean,progress:(s:any)=>void|Promise<void>=()=>{},assertActive:()=>void=()=>{}){
 const {imageKey}=await import('../../server/image-assets');
 const stats={uploaded:0,preserved:0,alreadyApproved:0,pending:0};
 for(const [i,r] of records.entries()){
  assertActive();if(!r.image)continue;const id=matches[i].existingId;if(!id)throw Error('Imported material cannot be found for '+r.ref);const image=images.get(r.image.file);if(!image)throw Error('Normalized image is unavailable: '+r.image.file);
  const stored=await store.listImages(p,id);if(stored.some(x=>x.status==='approved')){if(stored.some(x=>x.status==='approved'&&x.contentHash===image.hash))stats.alreadyApproved++;else stats.preserved++;continue;}
  const key=imageKey(p.tenant,id,image.hash);await assets.put(key,image.bytes);const association=await store.submitImage(p,id,image.hash,{sourceUrl:r.image.sourceUrl,rightsBasis:'Owner-managed representative catalog image from the owner-approved research package; no independent license assertion.'},null);
  if(approve){if(createHash('sha256').update(await assets.get(key)).digest('hex')!==image.hash)throw Error('Stored image verification failed.');await store.reviewImage(p,id,association.id,'approved');stats.uploaded++;}else stats.pending++;
  await progress({...stats});
 }
 return stats;
}
