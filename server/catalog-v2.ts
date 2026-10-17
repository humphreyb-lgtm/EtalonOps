import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import { ApiError, type Principal } from './contracts';
import { score } from './search';

// Domain operations yield parameterized statements. The SQLite adapter executes
// synchronously; SQL Server executes the identical operation in one transaction.
export type CatalogQuery = { text: string; values: unknown[] };
export type RecordRow = Record<string, any>;
export type Operation<T = any> = Generator<CatalogQuery, T, RecordRow[]>;
function* query(text: string, ...values: unknown[]): Operation<RecordRow[]> { return yield { text, values }; }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const key = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const phraseKey = (value: string) => key(searchWords(value)).replace(/[″"]/g,' inch ').replace(/\s+/g,' ').trim();
const name = z.string().trim().min(1).max(200);
const reference = z.string().trim().min(1).max(100);
const https = z.url().max(2000).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;},'Use a public HTTPS evidence URL.');
const verification = z.enum(['provisional','reviewed']);
const attributeValue = z.union([z.string().trim().min(1).max(200),z.number().finite().nonnegative()]);
export const materialInput = z.object({externalKey:reference,category:z.enum(['conduit','bracket','box','general']),attributes:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),attributeValue).refine(v=>Object.keys(v).length>0&&Object.keys(v).length<=25),productUnit:z.enum(['EA','FT','STICK','BOX','ROLL','PAIR']),verification,origin:z.enum(['admin_reviewed','ai_import','ai_discovery']).default('admin_reviewed'),sourceUrl:https,verificationBasis:z.string().trim().min(10).max(2000)}).strict();
export type MaterialInput=z.infer<typeof materialInput>;
export const productInput=z.object({materialKey:reference,manufacturer:name,partNumber:name,title:z.string().trim().min(1).max(500),sourceUrl:https,verification,origin:z.enum(['admin_reviewed','ai_import','ai_discovery']).default('admin_reviewed')}).strict();
export const translationInput=z.object({materialKey:reference,phrase:z.string().trim().min(1).max(500),origin:z.enum(['admin_reviewed','ai_import','ai_generated']),sourceUrl:https.optional()}).strict().superRefine((v,c)=>{if(v.origin!=='admin_reviewed'&&!v.sourceUrl)c.addIssue({code:'custom',message:'AI phrases need source evidence.'});});
export const imageReferenceInput=z.object({materialKey:reference,manufacturer:name.optional(),partNumber:name.optional(),sourceUrl:https,rightsBasis:z.string().trim().min(10).max(2000)}).strict().refine(v=>Boolean(v.manufacturer)===Boolean(v.partNumber),'Manufacturer and part number must be supplied together.');
export { purchaseSchema, type Purchasing } from './purchasing';
import { purchaseSchema, type Purchasing } from './purchasing';
export const policyInput=z.object({id:z.uuid().optional(),projectId:z.enum(['riverside','northside']),materialKey:reference.nullable(),category:z.enum(['conduit','bracket','box','general']).nullable(),enabled:z.boolean().default(false),manufacturerIds:z.array(z.uuid()).max(100),productIds:z.array(z.uuid()).max(100)}).strict().refine(v=>!(v.materialKey&&v.category),'Choose material or category scope, not both.').refine(v=>v.manufacturerIds.length+v.productIds.length>0,'An allow list cannot be empty.');
export function describeMaterial(input:MaterialInput){
  const a=input.attributes;
  if(Object.keys(a).some(field=>/manufacturer|brand|vendor|partnumber|source|verification|price|usage|image/i.test(field)))throw new ApiError(400,'Brands, part numbers and administrative metadata belong outside material specifications.');
  const positive=(field:string)=>{if(typeof a[field]!=='number'||Number(a[field])<=0)throw new ApiError(400,`Positive numeric ${field} in inches is required.`);return a[field];};
  const required=(field:string)=>{if(typeof a[field]!=='string'||!String(a[field]).trim())throw new ApiError(400,`${field} is required.`);return String(a[field]).trim();};
  let description:string;
  if(input.category==='conduit'){
    const type=required('type').toLowerCase();if(!['pipe','conduit'].includes(type))throw new ApiError(400,'Specify pipe or conduit explicitly.');
    description=`${positive('diameterIn')} in. ${required('material')} ${type}, Schedule ${required('schedule')}, ${positive('lengthIn')} in. Length, ${required('endConnection')}`;
  }else if(input.category==='bracket'){
    const min=positive('minSpanIn'),max=positive('maxSpanIn');if(Number(min)>Number(max))throw new ApiError(400,'Minimum span cannot exceed maximum span.');
    description=`Telescoping Support Bracket, ${min}–${max} in. Adjustable Span, ${required('mounting')}, ${required('material')}`;
    if(a.nominalSpacing)description+=`, ${a.nominalSpacing} Nominal Spacing`;
  }else if(input.category==='box')description=`${required('type')} Box, ${positive('widthIn')} × ${positive('heightIn')} × ${positive('depthIn')} in., ${required('material')}, ${required('knockouts')}`;
  else description=`${required('type')}, ${required('specification')}`;
  const canonical=Object.fromEntries(Object.entries(a).filter(([field])=>field!=='nominalSpacing').sort(([x],[y])=>x.localeCompare(y)).map(([k,v])=>[k,typeof v==='string'?key(v):v]));
  return {description,identity:digest(JSON.stringify({category:input.category,productUnit:input.productUnit,attributes:canonical}))};
}
export function* materialByKey(p:Principal,externalKey:string):Operation<RecordRow>{
  const row=(yield* query('SELECT * FROM materials WHERE tenant=@p0 AND LOWER(external_key)=LOWER(@p1) AND active=1',p.tenant,externalKey))[0];
  if(!row)throw new ApiError(404,`Active material not found: ${externalKey}`);return row;
}
function* materialById(p:Principal,id:string):Operation<RecordRow>{
  if(!z.uuid().safeParse(id).success)throw new ApiError(404,'Material not found.');
  const row=(yield* query('SELECT * FROM materials WHERE tenant=@p0 AND id=@p1',p.tenant,id))[0];if(!row)throw new ApiError(404,'Material not found.');return row;
}
function* audit(p:Principal,action:string,target:string):Operation<void>{yield* query('INSERT INTO audit_events(id,tenant,actor,action,target,at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5)',randomUUID(),p.tenant,p.oid,action,target,new Date().toISOString());}
function admin(p:Principal){if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');}
export function* createMaterial(p:Principal,data:unknown,dry=false):Operation<any>{
  admin(p);const input=materialInput.parse(data),built=describeMaterial(input);
  if(input.origin!=='admin_reviewed'&&input.verification==='reviewed')throw new ApiError(400,'AI-origin material records must enter as provisional.');
  const existing=(yield* query('SELECT material_id FROM catalog_profiles WHERE tenant=@p0 AND identity_key=@p1',p.tenant,built.identity))[0];
  const byKey=(yield* query('SELECT id FROM materials WHERE tenant=@p0 AND LOWER(external_key)=LOWER(@p1)',p.tenant,input.externalKey))[0];
  if(existing){if(byKey&&String(byKey.id).toLowerCase()!==String(existing.material_id).toLowerCase())throw new ApiError(409,'External key conflicts with another material.');return {id:String(existing.material_id).toLowerCase(),unchanged:true};}
  if(byKey)throw new ApiError(409,'Existing external key requires reviewed correction; no automatic merge.');
  // Legacy materials are not blindly merged based on wording. Identical descriptions
  // require an explicit profile review before adding another record.
  if((yield* query('SELECT id FROM materials WHERE tenant=@p0 AND description=@p1 AND active=1',p.tenant,built.description)).length)throw new ApiError(409,'Matching legacy description requires identity review.');
  if(dry)return {description:built.description};
  let batch=(yield* query('SELECT id FROM import_batches WHERE tenant=@p0 AND hash=@p1',p.tenant,digest('catalog-v2-materials')))[0];
  if(!batch){batch={id:randomUUID()};yield* query("INSERT INTO import_batches(id,tenant,hash,state,[file],report) VALUES(@p0,@p1,@p2,'applied',@p3,@p4)",batch.id,p.tenant,digest('catalog-v2-materials'),'',JSON.stringify({rows:0,errors:[],kind:'structured'}));}
  const id=randomUUID();
  const row={schema_version:'1',external_key:input.externalKey,description:built.description,aliases_json:JSON.stringify([built.description]),requested_uom:input.productUnit,product_uom:input.productUnit,manufacturer:'',manufacturer_part_number:'',specifications_json:JSON.stringify(Object.entries(input.attributes).map(([k,v])=>`${k}: ${v}`)),conversion_basis_json:'null',source_url:input.sourceUrl,verification_basis:input.verificationBasis,dataset_kind:'reviewed'};
  yield* query('INSERT INTO materials(id,tenant,external_key,description,product_uom,details,dataset_kind,batch_id,active) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,1)',id,p.tenant,input.externalKey,built.description,input.productUnit,JSON.stringify({row,specs:JSON.parse(row.specifications_json),category:input.category==='conduit'?'conduit':'general'}),'reviewed',batch.id);
  yield* query('INSERT INTO catalog_profiles(material_id,tenant,identity_key,attributes,verification,high_use) VALUES(@p0,@p1,@p2,@p3,@p4,0)',id,p.tenant,built.identity,JSON.stringify({category:input.category,...input.attributes,recordOrigin:input.origin}),input.verification);
  yield* audit(p,input.origin==='admin_reviewed'?'catalog.material_created':'catalog.material_ai_created',id);return {id,description:built.description,unchanged:false};
}
export function* addProduct(p:Principal,data:unknown,dry=false):Operation<any>{
  admin(p);const input=productInput.parse(data);if(input.origin!=='admin_reviewed'&&input.verification==='reviewed')throw new ApiError(400,'AI-origin products must enter as provisional.');const material=yield* materialByKey(p,input.materialKey);
  let maker=(yield* query('SELECT * FROM manufacturers WHERE tenant=@p0 AND normalized=@p1',p.tenant,key(input.manufacturer)))[0];
  const prior=maker?(yield* query('SELECT * FROM manufacturer_products WHERE tenant=@p0 AND manufacturer_id=@p1 AND normalized_part=@p2',p.tenant,maker.id,key(input.partNumber)))[0]:null;
  if(prior){if(String(prior.material_id).toLowerCase()!==String(material.id).toLowerCase())throw new ApiError(409,'Manufacturer part number is already linked to another material.');return {id:String(prior.id).toLowerCase(),unchanged:true};}
  if(dry)return {};
  if(!maker){maker={id:randomUUID()};yield* query('INSERT INTO manufacturers(id,tenant,name,normalized) VALUES(@p0,@p1,@p2,@p3)',maker.id,p.tenant,input.manufacturer,key(input.manufacturer));}
  const id=randomUUID();yield* query('INSERT INTO manufacturer_products(id,tenant,material_id,manufacturer_id,part_number,normalized_part,title,source_url,verification,active) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,1)',id,p.tenant,material.id,maker.id,input.partNumber,key(input.partNumber),input.title,input.sourceUrl,input.verification);
  yield* audit(p,input.origin==='admin_reviewed'?'catalog.product_linked':'catalog.product_ai_linked',id);return {id,unchanged:false};
}
function* addPhrase(p:Principal,materialId:string,phrase:string,origin:string,batch:string|null=null,sourceUrl:string|null=null):Operation<any>{
  const normalized=phraseKey(phrase);if(!normalized||normalized.length>500)throw new ApiError(400,'Phrase must normalize to 1–500 characters.');
  const prior=(yield* query('SELECT id,active FROM translations WHERE tenant=@p0 AND material_id=@p1 AND normalized=@p2 AND origin=@p3',p.tenant,materialId,normalized,origin))[0];
  if(prior)return {id:String(prior.id).toLowerCase(),unchanged:true,active:Boolean(prior.active)};
  const id=randomUUID();yield* query('INSERT INTO translations(id,tenant,material_id,phrase,normalized,origin,actor,created_at,active,batch_id,source_url) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,1,@p8,@p9)',id,p.tenant,materialId,phrase,normalized,origin,p.oid,new Date().toISOString(),batch,sourceUrl);return {id,unchanged:false};
}
export function* addTranslation(p:Principal,data:unknown,dry=false,batch:string|null=null):Operation<any>{admin(p);const input=translationInput.parse(data),m=yield* materialByKey(p,input.materialKey);if(dry)return {};const result=yield* addPhrase(p,String(m.id).toLowerCase(),input.phrase,input.origin,batch,input.sourceUrl??null);yield* audit(p,'translation.imported',result.id);return result;}
export function* selectMaterial(p:Principal,data:unknown):Operation<any>{
  const input=z.object({eventId:z.uuid(),projectId:z.enum(['riverside','northside']),materialId:z.uuid(),productId:z.uuid().nullable(),phrase:z.string().trim().min(1).max(500)}).strict().parse(data);
  if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,input.projectId)).length)throw new ApiError(404,'Project not found.');
  const material=yield* materialById(p,input.materialId);if(!material.active)throw new ApiError(409,'Material is inactive.');
  const existing=(yield* query('SELECT * FROM selection_events WHERE id=@p0',input.eventId))[0];
  if(existing){if(existing.tenant!==p.tenant||existing.actor!==p.oid||String(existing.material_id).toLowerCase()!==input.materialId||existing.phrase!==input.phrase||existing.project!==input.projectId||(existing.product_id?String(existing.product_id).toLowerCase():null)!==input.productId)throw new ApiError(409,'Selection identifier is already used.');return {unchanged:true};}
  if(input.productId)yield* productForMaterial(p,input.materialId,input.productId);
  yield* query('INSERT INTO selection_events(id,tenant,actor,project,material_id,product_id,phrase,created_at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)',input.eventId,p.tenant,p.oid,input.projectId,input.materialId,input.productId,input.phrase,new Date().toISOString());
  const translation=yield* addPhrase(p,input.materialId,input.phrase,'user_selection');yield* audit(p,'catalog.selected',input.eventId);return {translation,unchanged:false};
}
export function* productForMaterial(p:Principal,materialId:string,productId:string):Operation<RecordRow>{
  const product=(yield* query('SELECT p.*,m.name AS manufacturer FROM manufacturer_products p JOIN manufacturers m ON p.manufacturer_id=m.id AND p.tenant=m.tenant WHERE p.id=@p0 AND p.tenant=@p1 AND p.material_id=@p2 AND p.active=1',productId,p.tenant,materialId))[0];
  if(!product)throw new ApiError(400,'Manufacturer product does not belong to this material.');return product;
}
export function* materialDetails(p:Principal,id:string,projectId?:string):Operation<any>{
  if(projectId&&!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,projectId)).length)throw new ApiError(404,'Project not found.');
  const material=yield* materialById(p,id);
  const profile=(yield* query('SELECT * FROM catalog_profiles WHERE material_id=@p0 AND tenant=@p1',id,p.tenant))[0];
  const products=yield* query('SELECT p.*,m.name AS manufacturer FROM manufacturer_products p JOIN manufacturers m ON m.id=p.manufacturer_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND p.material_id=@p1 AND p.active=1',p.tenant,id);
  for(const product of products){product.allowed=true;if(projectId)try{yield* validatePurchase(p,projectId,id,{productId:String(product.id).toLowerCase(),manufacturer:product.manufacturer,partNumber:product.part_number,noSubstitutions:false});}catch(error){if(!(error instanceof ApiError))throw error;product.allowed=false;}}
  return {id,externalKey:material.external_key,description:material.description,attributes:profile?JSON.parse(profile.attributes):{},verification:profile?.verification??'reviewed',highUse:Boolean(profile?.high_use),preferredProductId:profile?.preferred_product_id?String(profile.preferred_product_id).toLowerCase():null,products:products.map(product=>({id:String(product.id).toLowerCase(),manufacturerId:String(product.manufacturer_id).toLowerCase(),manufacturer:product.manufacturer,partNumber:product.part_number,title:product.title,sourceUrl:product.source_url,verification:product.verification,allowed:product.allowed}))};
}
export function* setPriority(p:Principal,data:unknown):Operation<any>{
  admin(p);const input=z.object({materialId:z.uuid(),highUse:z.boolean(),preferredProductId:z.uuid().nullable()}).strict().parse(data);const m=yield* materialById(p,input.materialId);
  if(input.preferredProductId)yield* productForMaterial(p,input.materialId,input.preferredProductId);
  const exists=(yield* query('SELECT material_id FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,input.materialId))[0];
  if(!exists)yield* query('INSERT INTO catalog_profiles(material_id,tenant,identity_key,attributes,verification,high_use) VALUES(@p0,@p1,@p2,@p3,@p4,0)',m.id,p.tenant,digest(`legacy:${m.id}`),'{}','reviewed');
  yield* query('UPDATE catalog_profiles SET high_use=@p0,preferred_product_id=@p1 WHERE tenant=@p2 AND material_id=@p3',Number(input.highUse),input.preferredProductId,p.tenant,input.materialId);yield* audit(p,'catalog.priority_changed',input.materialId);return {updated:true};
}
export function* setPolicy(p:Principal,data:unknown):Operation<any>{
  admin(p);const input=policyInput.parse(data);let materialId:string|null=null;if(input.materialKey)materialId=String((yield* materialByKey(p,input.materialKey)).id).toLowerCase();
  for(const id of input.manufacturerIds)if(!(yield* query('SELECT id FROM manufacturers WHERE tenant=@p0 AND id=@p1',p.tenant,id)).length)throw new ApiError(400,'Unknown manufacturer.');
  for(const id of input.productIds)if(!(yield* query('SELECT id FROM manufacturer_products WHERE tenant=@p0 AND id=@p1 AND active=1',p.tenant,id)).length)throw new ApiError(400,'Unknown product.');
  const id=input.id??randomUUID();const prior=(yield* query('SELECT id FROM job_restrictions WHERE tenant=@p0 AND id=@p1',p.tenant,id))[0];
  if(input.id&&!prior)throw new ApiError(404,'Restriction not found.');
  if(prior)yield* query('UPDATE job_restrictions SET project=@p0,material_id=@p1,category=@p2,enabled=@p3,manufacturer_ids=@p4,product_ids=@p5 WHERE tenant=@p6 AND id=@p7',input.projectId,materialId,input.category,Number(input.enabled),JSON.stringify(input.manufacturerIds),JSON.stringify(input.productIds),p.tenant,id);
  else yield* query('INSERT INTO job_restrictions(id,tenant,project,material_id,category,enabled,manufacturer_ids,product_ids) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)',id,p.tenant,input.projectId,materialId,input.category,Number(input.enabled),JSON.stringify(input.manufacturerIds),JSON.stringify(input.productIds));
  yield* audit(p,'job.restriction_changed',id);return {id,enabled:input.enabled};
}
export function* validatePurchase(p:Principal,project:string,materialId:string|null,purchase:Purchasing|undefined,enforcePolicies=true,allowHistorical=false):Operation<void>{
  const value=purchase?purchaseSchema.parse(purchase):undefined;
  if(value?.productId&&!allowHistorical){if(!materialId)throw new ApiError(400,'A linked manufacturer product requires a catalog material.');const product=yield* productForMaterial(p,materialId,value.productId);if(product.manufacturer!==value.manufacturer||product.part_number!==value.partNumber)throw new ApiError(400,'Manufacturer snapshot does not match the selected product.');}
  if(!enforcePolicies)return;
  const profiles=materialId?yield* query('SELECT attributes FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,materialId):[];
  let category=profiles[0]?JSON.parse(profiles[0].attributes).category:null;
  if(!category&&materialId){const m=yield* materialById(p,materialId);category=JSON.parse(m.details).category;}
  const policies=yield* query('SELECT * FROM job_restrictions WHERE tenant=@p0 AND project=@p1 AND enabled=1',p.tenant,project);
  for(const policy of policies){
    if(policy.material_id&&String(policy.material_id).toLowerCase()!==materialId)continue;
    if(policy.category&&policy.category!==category){if(materialId)continue;throw new ApiError(400,'Job restrictions require a classified catalog material.');}
    if(!value?.productId||!materialId)throw new ApiError(400,'This job requires an allowed catalog manufacturer product.');
    const product=yield* productForMaterial(p,materialId,value.productId),makers:string[]=JSON.parse(policy.manufacturer_ids),products:string[]=JSON.parse(policy.product_ids);
    if((makers.length&&!makers.includes(String(product.manufacturer_id).toLowerCase()))||(products.length&&!products.includes(String(product.id).toLowerCase())))throw new ApiError(400,'The selected manufacturer product violates this job restriction.');
  }
}
export function* translationsForAdmin(p:Principal,materialId:string):Operation<RecordRow[]>{admin(p);yield* materialById(p,materialId);return yield* query('SELECT * FROM translations WHERE tenant=@p0 AND material_id=@p1',p.tenant,materialId);}
export function* rejectTranslation(p:Principal,id:string):Operation<any>{admin(p);if(!(yield* query('SELECT id FROM translations WHERE id=@p0 AND tenant=@p1',id,p.tenant)).length)throw new ApiError(404,'Translation not found.');yield* query('UPDATE translations SET active=0 WHERE id=@p0 AND tenant=@p1',id,p.tenant);yield* audit(p,'translation.rejected',id);return {rejected:true};}
export function* addImageReference(p:Principal,data:unknown,dry=false,batch:string|null=null):Operation<any>{
  admin(p);const input=imageReferenceInput.parse(data),m=yield* materialByKey(p,input.materialKey);let productId:string|null=null;
  if(input.manufacturer){const row=(yield* query('SELECT p.id FROM manufacturer_products p JOIN manufacturers m ON m.id=p.manufacturer_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND p.material_id=@p1 AND m.normalized=@p2 AND p.normalized_part=@p3 AND p.active=1',p.tenant,m.id,key(input.manufacturer),key(input.partNumber!)))[0];if(!row)throw new ApiError(400,'Image manufacturer product not found.');productId=String(row.id).toLowerCase();}
  const prior=(yield* query('SELECT id,product_id FROM image_references WHERE tenant=@p0 AND material_id=@p1 AND source_url=@p2',p.tenant,m.id,input.sourceUrl)).find(row=>(row.product_id?String(row.product_id).toLowerCase():null)===productId);if(prior)return {id:String(prior.id).toLowerCase(),unchanged:true};if(dry)return {};
  const id=randomUUID();yield* query("INSERT INTO image_references(id,tenant,material_id,product_id,source_url,rights_basis,status,batch_id) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,'pending',@p6)",id,p.tenant,m.id,productId,input.sourceUrl,input.rightsBasis,batch);yield* audit(p,'image.reference_imported',id);return {id,unchanged:false};
}
function searchWords(text:string){return text.replace(/(\d)([½¼¾⅛⅜⅝⅞])/g,'$1 $2').normalize('NFKC').replace(/[⁄∕]/g,'/').replace(/\b(\d+)[ -](\d+)\/(\d+)(?=\s*(?:inches|inch|in\b|["″]|pvc\b))/gi,(_all,whole,num,den)=>Number(den)?String(Number(whole)+Number(num)/Number(den)):_all).replace(/\b(\d+)\/(\d+)(?=\s*(?:inches|inch|in\b|["″]|pvc\b))/gi,(_all,num,den)=>Number(den)?String(Number(num)/Number(den)):_all).replace(/(\d+(?:\.\d+)?)\s*['′]/g,'$1 ft ').replace(/\b(\d+)\s*(?:feet|foot|ft)\b/gi,'$1 ft').replace(/\bsticks?\b/gi,'').replace(/\bpvc\s+(40|80)\b/gi,'PVC schedule $1').replace(/\s+/g,' ').trim();}
export function* searchCatalog(p:Principal,input:string,projectId?:string):Operation<any[]>{
  if(projectId&&!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,projectId)).length)throw new ApiError(404,'Project not found.');
  const policies=projectId?yield* query('SELECT * FROM job_restrictions WHERE tenant=@p0 AND project=@p1 AND enabled=1',p.tenant,projectId):[];
  const materials=yield* query('SELECT * FROM materials WHERE tenant=@p0 AND active=1',p.tenant);
  const profiles=yield* query('SELECT * FROM catalog_profiles WHERE tenant=@p0',p.tenant);
  const aliases=yield* query('SELECT * FROM translations WHERE tenant=@p0 AND active=1',p.tenant);
  const products=yield* query('SELECT p.*,m.name AS manufacturer,m.normalized AS manufacturer_normalized FROM manufacturer_products p JOIN manufacturers m ON m.id=p.manufacturer_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND p.active=1',p.tenant);
  const counts=yield* query('SELECT material_id,COUNT(*) AS uses FROM selection_events WHERE tenant=@p0 GROUP BY material_id',p.tenant);
  const requestedMakers=[...new Set(products.map(product=>product.manufacturer_normalized))].filter(maker=>new RegExp(`(?:^|[^a-z0-9])${String(maker).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^a-z0-9])`,'i').test(input));
  const results=materials.map(material=>{
    const id=String(material.id).toLowerCase(),details=JSON.parse(material.details),profile=profiles.find(row=>String(row.material_id).toLowerCase()===id),attributes=profile?JSON.parse(profile.attributes):{};
    let choices=products.filter(product=>String(product.material_id).toLowerCase()===id);
    if(requestedMakers.length)choices=choices.filter(product=>requestedMakers.includes(product.manufacturer_normalized));
    if(requestedMakers.length&&!choices.length)return null;
    const applicable=policies.filter(rule=>(!rule.material_id||String(rule.material_id).toLowerCase()===id)&&(!rule.category||rule.category===(attributes.category??details.category)));
    for(const rule of applicable){const makers:string[]=JSON.parse(rule.manufacturer_ids),allowed:string[]=JSON.parse(rule.product_ids);choices=choices.filter(product=>(!makers.length||makers.includes(String(product.manufacturer_id).toLowerCase()))&&(!allowed.length||allowed.includes(String(product.id).toLowerCase())));}
    if(applicable.length&&!choices.length)return null;
    const phraseList=[material.description,...JSON.parse(details.row.aliases_json),...aliases.filter(row=>String(row.material_id).toLowerCase()===id).map(row=>row.phrase)];
    // Convert only a structured length for retrieval, never a requested quantity/UOM.
    if(attributes.lengthIn)phraseList.push(`${attributes.diameterIn} inch ${attributes.material} ${attributes.type} schedule ${attributes.schedule} ${Number(attributes.lengthIn)/12} ft`);
    for(const product of choices)phraseList.push(`${product.manufacturer} ${product.part_number} ${product.title} ${material.description}`);
    let q=searchWords(input);
    const span=q.match(/(?:for\s+(?:a\s+)?)?(\d+(?:\.\d+)?)[ -]*(?:inch|in\b|["″])[ -]*(?:span|spread)/i);
    if(span&&attributes.minSpanIn!=null&&attributes.maxSpanIn!=null){if(Number(span[1])<Number(attributes.minSpanIn)||Number(span[1])>Number(attributes.maxSpanIn))return null;q=q.replace(span[0],'').trim();}
    let rank=Math.max(...phraseList.map(phrase=>score(q,searchWords(phrase))));
    const schedule=q.match(/\bsch(?:edule)?\s*(\d+)\b/i)?.[1],expectedSchedule=attributes.schedule??material.description.match(/\bsch(?:edule)?\s*(\d+)\b/i)?.[1];
    const diameter=q.match(/\b(\d+(?:\.\d+|\/\d+)?)\s*(?:inch|in\b|["″])/i)?.[1];
    if((/\bpipe\b/i.test(q)&&attributes.type==='conduit')||(/\bconduit\b/i.test(q)&&attributes.type==='pipe'))rank=0;
    if((schedule&&expectedSchedule&&String(schedule)!==String(expectedSchedule))||(diameter&&attributes.diameterIn&&Number(diameter)!==Number(attributes.diameterIn)))rank=0;
    choices.sort((a,b)=>Number(key(input).includes(key(b.part_number)))-Number(key(input).includes(key(a.part_number)))||Number(String(b.id).toLowerCase()===String(profile?.preferred_product_id).toLowerCase())-Number(String(a.id).toLowerCase()===String(profile?.preferred_product_id).toLowerCase()));
    const useCount=Number(counts.find(row=>String(row.material_id).toLowerCase()===id)?.uses??0);
    return {id,description:material.description,productUnit:material.product_uom,specs:details.specs,category:details.category,source:material.dataset_kind==='fixture'?'verified_fixture':'verified',verification:profile?.verification??'reviewed',score:rank,highUse:Boolean(profile?.high_use)||useCount>=10,useCount,reason:rank===100?'Exact phrase match':'Potential specification match',preferredProductId:profile?.preferred_product_id?String(profile.preferred_product_id).toLowerCase():null,products:choices.map(product=>({id:String(product.id).toLowerCase(),manufacturer:product.manufacturer,partNumber:product.part_number,verification:product.verification})),provenance:{sourceUrl:details.row.source_url,verificationBasis:details.row.verification_basis,datasetKind:material.dataset_kind}};
  }).filter((row):row is NonNullable<typeof row>=>Boolean(row&&row.score>=85));
  return results.sort((a,b)=>b.score-a.score||Number(b.highUse)-Number(a.highUse)||Math.min(b.useCount,100)-Math.min(a.useCount,100)||a.description.localeCompare(b.description)).slice(0,20);
}
const importKinds=['material','product','translation','image'] as const;
export function parseExtendedCsv(csv:string){
  const errors:{row:number;message:string}[]=[],records:{kind:typeof importKinds[number];data:unknown;row:number}[]=[];let rowCount=0;
  try{
    const rows:Record<string,string>[]=parse(csv,{bom:true,columns:(header:string[])=>{if(header.length!==2||!header.includes('kind')||!header.includes('data_json'))throw new Error('Use kind and data_json columns.');return header;},skip_empty_lines:true,max_record_size:20000});
    rowCount=rows.length;
    if(!rows.length||rows.length>2000)throw new Error('Use 1–2000 rows per staged file.');
    const seen=new Set<string>();
    rows.forEach((row,i)=>{try{const kind=z.enum(importKinds).parse(row.kind),schema={material:materialInput,product:productInput,translation:translationInput,image:imageReferenceInput}[kind],data=schema.parse(JSON.parse(row.data_json));const identifier=JSON.stringify([kind,data]);if(seen.has(identifier))throw new Error('Duplicate row.');seen.add(identifier);records.push({kind,data,row:i+2});}catch(error){errors.push({row:i+2,message:error instanceof z.ZodError?'Invalid row fields.':error instanceof Error?error.message:'Invalid JSON.'});}});
    if(new Set(records.map(row=>row.kind)).size>1)errors.push({row:1,message:'Stage one record kind per file: materials first, then products/translations/images.'});
  }catch(error){errors.push({row:1,message:error instanceof Error?error.message:'Malformed CSV.'});}
  return {records,errors,rowCount};
}
function* importRecord(p:Principal,record:ReturnType<typeof parseExtendedCsv>['records'][number],dry:boolean,batch:string):Operation<any>{
  if(record.kind==='material')return yield* createMaterial(p,record.data,dry);
  if(record.kind==='product')return yield* addProduct(p,record.data,dry);
  if(record.kind==='translation')return yield* addTranslation(p,record.data,dry,batch);
  return yield* addImageReference(p,record.data,dry,batch);
}
export function* previewBulk(p:Principal,csv:string):Operation<any>{
  admin(p);if(Buffer.byteLength(csv)>800000)throw new ApiError(413,'Stage imports in files up to 800 KB.');
  const hash=digest(csv),prior=(yield* query('SELECT * FROM catalog_batches WHERE tenant=@p0 AND digest=@p1',p.tenant,hash))[0];if(prior&&prior.state!=='preview')return {id:String(prior.id).toLowerCase(),state:prior.state,report:JSON.parse(prior.report)};
  const parsed=parseExtendedCsv(csv),id=prior?String(prior.id).toLowerCase():randomUUID();
  for(const record of parsed.records){try{yield* importRecord(p,record,true,id);}catch(error){parsed.errors.push({row:record.row,message:error instanceof Error?error.message:'Invalid reference.'});}}
  const report={rows:parsed.rowCount,errors:parsed.errors,created:[] as {kind:string;id:string}[]};
  if(prior)yield* query('UPDATE catalog_batches SET report=@p0 WHERE tenant=@p1 AND id=@p2',JSON.stringify(report),p.tenant,id);
  else yield* query("INSERT INTO catalog_batches(id,tenant,digest,state,csv,report,created_at) VALUES(@p0,@p1,@p2,'preview',@p3,@p4,@p5)",id,p.tenant,hash,csv,JSON.stringify(report),new Date().toISOString());yield* audit(p,'catalog.bulk_previewed',id);return {id,state:'preview',report};
}
export function* applyBulk(p:Principal,id:string,approval:string):Operation<any>{
  admin(p);if(approval!=='I reviewed this batch')throw new ApiError(400,'Explicit review confirmation required.');
  const batch=(yield* query('SELECT * FROM catalog_batches WHERE tenant=@p0 AND id=@p1',p.tenant,id))[0];if(!batch)throw new ApiError(404,'Import not found.');if(batch.state==='applied')return {unchanged:true};if(batch.state!=='preview')throw new ApiError(409,'Rolled back imports cannot be reapplied.');
  const parsed=parseExtendedCsv(batch.csv);if(parsed.errors.length||JSON.parse(batch.report).errors.length)throw new ApiError(409,'Resolve preview errors before applying.');
  const created:{kind:string;id:string}[]=[];for(const record of parsed.records){const result=yield* importRecord(p,record,false,id);if(!result.unchanged)created.push({kind:record.kind,id:result.id});}
  yield* query("UPDATE catalog_batches SET state='applied',report=@p0 WHERE tenant=@p1 AND id=@p2",JSON.stringify({rows:parsed.records.length,errors:[],created}),p.tenant,id);yield* audit(p,'catalog.bulk_applied',id);return {created:created.length,unchanged:parsed.records.length-created.length};
}
export function* rollbackBulk(p:Principal,id:string):Operation<any>{
  admin(p);const batch=(yield* query('SELECT * FROM catalog_batches WHERE tenant=@p0 AND id=@p1',p.tenant,id))[0];if(!batch)throw new ApiError(404,'Import not found.');if(batch.state==='rolled_back')return {unchanged:true};if(batch.state!=='applied')throw new ApiError(409,'Only applied batches can be rolled back.');
  for(const row of JSON.parse(batch.report).created){
    if(row.kind==='translation'){
      // A subsequently selected phrase remains learned independently of this import.
      const record=(yield* query('SELECT * FROM translations WHERE tenant=@p0 AND id=@p1',p.tenant,row.id))[0];
      if(record)yield* query('UPDATE translations SET active=0 WHERE tenant=@p0 AND id=@p1 AND batch_id=@p2',p.tenant,row.id,id);
    }else if(row.kind==='material')yield* query('UPDATE materials SET active=0 WHERE tenant=@p0 AND id=@p1',p.tenant,row.id);
    else if(row.kind==='product')yield* query('UPDATE manufacturer_products SET active=0 WHERE tenant=@p0 AND id=@p1',p.tenant,row.id);
    else if(row.kind==='image')yield* query("UPDATE image_references SET status='withdrawn' WHERE tenant=@p0 AND id=@p1 AND batch_id=@p2",p.tenant,row.id,id);
  }
  yield* query("UPDATE catalog_batches SET state='rolled_back' WHERE tenant=@p0 AND id=@p1",p.tenant,id);yield* audit(p,'catalog.bulk_rolled_back',id);return {historyPreserved:true};
}
export function* selectDiscovery(p:Principal,data:unknown):Operation<any>{
  const input=z.object({eventId:z.uuid(),projectId:z.enum(['riverside','northside']),phrase:z.string().trim().min(1).max(500),material:materialInput,product:productInput.omit({materialKey:true}),additionalPhrases:z.array(z.string().trim().min(1).max(500)).max(8).default([])}).strict().parse(data);
  if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,input.projectId)).length)throw new ApiError(404,'Project not found.');
  const fingerprint=`${input.eventId}/${digest(JSON.stringify(input)).slice(0,32)}`;
  const prior=(yield* query('SELECT id FROM selection_events WHERE id=@p0',input.eventId))[0];
  if(prior){if(!(yield* query("SELECT id FROM audit_events WHERE tenant=@p0 AND actor=@p1 AND action='discovery.fingerprint' AND target=@p2",p.tenant,p.oid,fingerprint)).length)throw new ApiError(409,'Discovery identifier already used for another selection.');return {unchanged:true};}
  const today=new Date().toISOString().slice(0,10);
  const count=(yield* query("SELECT COUNT(*) AS count FROM audit_events WHERE tenant=@p0 AND actor=@p1 AND action='catalog.discovery_selected' AND at LIKE @p2",p.tenant,p.oid,`${today}%`))[0];
  if(Number(count.count)>=20)throw new ApiError(429,'The daily provisional discovery limit has been reached.');
  // Treat source specifications as provisional claims, never verified product facts.
  const writer={...p,roles:[...p.roles,'Admin']};
  const material=yield* createMaterial(writer,{...input.material,origin:'ai_discovery',verification:'provisional'});
  const m=yield* materialById(p,material.id);
  const product=yield* addProduct(writer,{...input.product,materialKey:m.external_key,origin:'ai_discovery',verification:'provisional'});
  const selected=yield* selectMaterial(p,{eventId:input.eventId,projectId:input.projectId,materialId:material.id,productId:product.id,phrase:input.phrase});
  const factText=JSON.stringify(input.material.attributes).toLowerCase(),numbers=new Set(factText.match(/\d+(?:[./-]\d+)*/g)??[]);
  const phrases=[...new Set(input.additionalPhrases)];
  const allowedWords=new Set((describeMaterial(input.material).description.toLowerCase()+' '+Object.values(input.material.attributes).join(' ').toLowerCase()+' of the a an for with in inch inches ft foot feet sch schedule adjustable stock stick span spread').match(/[a-z]+/g)??[]);
  for(const phrase of phrases){
    if((phrase.toLowerCase().match(/[a-z]+/g)??[]).some(word=>!allowedWords.has(word)))throw new ApiError(400,'Generated phrase introduces unsupported terminology.');
    if(/https?:\/\/|<\/?[a-z]/i.test(phrase)||(phrase.match(/\d+(?:[./-]\d+)*/g)??[]).some(n=>!numbers.has(n)))throw new ApiError(400,'Generated phrase contains unsupported numeric facts or markup.');
    yield* addPhrase(p,material.id,phrase,'ai_generated',null,input.material.sourceUrl);
  }
  yield* audit(p,'discovery.fingerprint',fingerprint);yield* audit(p,'catalog.discovery_selected',input.eventId);return {materialId:material.id,productId:product.id,selected,provisional:true};
}
export function* catalogAction(p:Principal,action:string,data:any):Operation<any>{
  switch(action){
    case 'select-discovery':return yield* selectDiscovery(p,data);
    case 'material':return yield* createMaterial(p,data);
    case 'product':return yield* addProduct(p,data);
    case 'translation':return yield* addTranslation(p,data);
    case 'selection':return yield* selectMaterial(p,data);
    case 'review-material':{admin(p);const input=z.object({id:z.uuid(),approval:z.literal('I verified the defining specifications')}).strict().parse(data);yield* materialById(p,input.id);if(!(yield* query('SELECT material_id FROM catalog_profiles WHERE material_id=@p0 AND tenant=@p1',input.id,p.tenant)).length)throw new ApiError(409,'Legacy identity needs structured review before verification.');yield* query("UPDATE catalog_profiles SET verification='reviewed' WHERE material_id=@p0 AND tenant=@p1",input.id,p.tenant);yield* audit(p,'catalog.material_reviewed',input.id);return {reviewed:true};}
    case 'review-product':{admin(p);const input=z.object({materialId:z.uuid(),productId:z.uuid(),approval:z.literal('I verified this product matches the material specification')}).strict().parse(data);yield* productForMaterial(p,input.materialId,input.productId);yield* query("UPDATE manufacturer_products SET verification='reviewed' WHERE tenant=@p0 AND id=@p1",p.tenant,input.productId);yield* audit(p,'catalog.product_reviewed',input.productId);return {reviewed:true};}
    case 'priority':return yield* setPriority(p,data);
    case 'policy':return yield* setPolicy(p,data);
    case 'validate-lines':{
      const body=z.object({projectId:z.enum(['riverside','northside']),lines:z.array(z.object({id:z.uuid(),candidate:z.object({id:z.string()}).nullable(),purchasing:purchaseSchema.optional()}).passthrough()).max(500)}).parse(data);
      if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,body.projectId)).length)throw new ApiError(404,'Project not found.');
      const issues:{lineId:string;message:string}[]=[];for(const line of body.lines){try{yield* validatePurchase(p,body.projectId,line.candidate?.id??null,line.purchasing);}catch(error){if(!(error instanceof ApiError))throw error;issues.push({lineId:line.id,message:error.message});}}return {issues,ready:issues.length===0};
    }
    case 'details':return yield* materialDetails(p,z.uuid().parse(data.id),z.enum(['riverside','northside']).optional().parse(data.projectId));
    case 'translations':return yield* translationsForAdmin(p,z.uuid().parse(data.id));
    case 'reject-translation':return yield* rejectTranslation(p,z.uuid().parse(data.id));
    case 'image-reference':return yield* addImageReference(p,data);
    case 'preview':return yield* previewBulk(p,z.string().max(800000).parse(data.csv));
    case 'apply':return yield* applyBulk(p,z.uuid().parse(data.id),z.string().parse(data.approval));
    case 'rollback':return yield* rollbackBulk(p,z.uuid().parse(data.id));
    case 'disable-policy':{admin(p);const id=z.uuid().parse(data.id);if(!(yield* query('SELECT id FROM job_restrictions WHERE tenant=@p0 AND id=@p1',p.tenant,id)).length)throw new ApiError(404,'Restriction not found.');yield* query('UPDATE job_restrictions SET enabled=0 WHERE tenant=@p0 AND id=@p1',p.tenant,id);yield* audit(p,'job.restriction_disabled',id);return {disabled:true};}
    case 'overview':admin(p);return {manufacturers:yield* query('SELECT * FROM manufacturers WHERE tenant=@p0',p.tenant),policies:yield* query('SELECT * FROM job_restrictions WHERE tenant=@p0',p.tenant),batches:yield* query('SELECT id,state,report,created_at FROM catalog_batches WHERE tenant=@p0',p.tenant),imageReferences:yield* query('SELECT * FROM image_references WHERE tenant=@p0',p.tenant)};
    default:throw new ApiError(404,'Unknown catalog operation.');
  }
}
