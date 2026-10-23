import {materialFacets,couplingPhrases} from '../src/search-facets';
import {searchGuidance} from '../src/search-guidance';
import {explicitBrand,structuredSearchPhrase} from './search-language';
import {searchConstraints} from './search-constraints';
import {cmsCommand} from './cms';
import {appearanceCommand} from './appearance';
import {manualReview} from './manual-review';
import {designCommand} from './global-design';
import {compareSpecifications} from './specification-search';
import {matchesPhysicalSearch,sizeQueryWithoutRadius} from './material-search-constraints';
import {familyDescription,familyIdentityFields} from './material-family';
import {materialFamilies} from '../src/material-families';
import {materialWorkbookAction} from './material-workbook';
import {designerCommand} from './document-templates';
import {templateCommand} from './pdf-template';
import {selectImage} from '../src/image-selection';
import {validateMaterialCategory} from './material-categories';
import {materialTable} from './material-table';
import {preparedResearchAction} from './prepared-research';
import {isProductDetail} from '../src/research-attributes';
import {productDetailsSchema} from '../src/catalog-research';
import {inboxAction} from './catalog-inbox';
import {researchAction,stageResearch} from './catalog-research';
import { spreadsheetRecord } from './catalog-spreadsheet';
import { catalogReadiness } from './catalog-readiness';
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
export const phraseKey = (value: string) => key(searchWords(value)).replace(/[″"]/g,' inch ').replace(/\s+/g,' ').trim();
const name = z.string().trim().min(1).max(200);
const reference = z.string().trim().min(1).max(100);
const https = z.url().max(2000).refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}},'Use a public HTTPS evidence URL.');
const verification = z.enum(['provisional','reviewed']);
const attributeValue = z.union([z.string().trim().min(1).max(2000),z.number().finite().nonnegative()]);
export const materialInput = z.object({externalKey:reference,details:productDetailsSchema.optional(),displayDescription:z.string().trim().min(1).max(2000).nullable().optional(),category:z.string().regex(/^[a-z][a-z0-9-]{0,59}$/),attributes:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),attributeValue).refine(v=>Object.keys(v).length>0&&Object.keys(v).length<=25),productUnit:z.enum(['EA','FT','STICK','BOX','ROLL','PAIR']),verification,origin:z.enum(['admin_reviewed','ai_import','ai_discovery']).default('admin_reviewed'),sourceUrl:z.union([https,z.literal('')]),verificationBasis:z.string().trim().min(10).max(2000)}).strict().refine(value=>Boolean(value.sourceUrl)||value.origin==='admin_reviewed','AI-origin materials require a source URL.');
export type MaterialInput=z.infer<typeof materialInput>;
export const productInput=z.object({materialKey:reference,manufacturer:name,partNumber:name,title:z.string().trim().min(1).max(500),details:productDetailsSchema.optional(),sourceUrl:https,verification,origin:z.enum(['admin_reviewed','ai_import','ai_discovery']).default('admin_reviewed')}).strict();
export const translationInput=z.object({materialKey:reference,phrase:z.string().trim().min(1).max(500),origin:z.enum(['admin_reviewed','ai_import','ai_generated']),sourceUrl:https.optional()}).strict().superRefine((v,c)=>{if(v.origin!=='admin_reviewed'&&!v.sourceUrl)c.addIssue({code:'custom',message:'AI phrases need source evidence.'});});
export const imageReferenceInput=z.object({materialKey:reference,manufacturer:name.optional(),partNumber:name.optional(),sourceUrl:https,rightsBasis:z.string().trim().min(10).max(2000)}).strict().refine(v=>Boolean(v.manufacturer)===Boolean(v.partNumber),'Manufacturer and part number must be supplied together.');
export { purchaseSchema, type Purchasing } from './purchasing';
import { purchaseSchema, type Purchasing } from './purchasing';
export const policyInput=z.object({id:z.uuid().optional(),projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),materialKey:reference.nullable(),category:z.enum(['conduit','bracket','box','general']).nullable(),enabled:z.boolean().default(false),manufacturerIds:z.array(z.uuid()).max(100),productIds:z.array(z.uuid()).max(100)}).strict().refine(v=>!(v.materialKey&&v.category),'Choose material or category scope, not both.').refine(v=>v.manufacturerIds.length+v.productIds.length>0,'An allow list cannot be empty.');
export function materialIdentity(category:string,productUnit:string,attributes:Record<string,unknown>){
 const physical=familyIdentityFields(category,attributes);
 const canonical=Object.fromEntries(Object.entries(attributes).filter(([field])=>(!physical||physical.has(field))&&!['familyId','configurationStatus','nominalSpacing','category','recordOrigin'].includes(field)&&!isProductDetail(category,field)).sort(([x],[y])=>x.localeCompare(y)).map(([field,value])=>{
  let normalized=typeof value==='string'?key(value):value;
  if(field==='endConnection'&&typeof normalized==='string'){const end=normalized.replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();normalized=['bell','bell end','belled','belled end'].includes(end)?'bell end':['plain','plain end'].includes(end)?'plain end':end;}
  if(field==='material'&&typeof normalized==='string'&&['pvc','polyvinyl chloride','polyvinylchloride'].includes(normalized))normalized='pvc';
  return [field,normalized];
 }));return digest(JSON.stringify({category:['hardware-fasteners','drill-bits','consumables'].includes(category)?'general':category,productUnit,attributes:canonical}));
}
export function describeMaterial(input:MaterialInput){
  const a=input.attributes;
  if(a.configurationStatus&&a.configurationStatus!=='confirmed')throw new ApiError(400,'Unconfirmed configurations cannot enter the active catalog.');
  if(Object.keys(a).some(field=>/manufacturer|brand|vendor|partnumber|source|verification|price|usage|image/i.test(field)))throw new ApiError(400,'Brands, part numbers and administrative metadata belong outside material specifications.');
  const positive=(field:string)=>{if(typeof a[field]!=='number'||Number(a[field])<=0)throw new ApiError(400,`Positive numeric ${field} in inches is required.`);return a[field];};
  const required=(field:string)=>{if(typeof a[field]!=='string'||!String(a[field]).trim())throw new ApiError(400,`${field} is required.`);return String(a[field]).trim();};
  let description:string;
  const familyText=familyDescription(input.category,a);
  if(familyText)description=familyText;
  else if(input.category==='conduit'){
    const type=required('type').toLowerCase();if(!['pipe','conduit'].includes(type))throw new ApiError(400,'Specify pipe or conduit explicitly.');
    description=`${positive('diameterIn')} in. ${required('material')} ${type}, Schedule ${required('schedule')}, ${positive('lengthIn')} in. Length, ${required('endConnection')}`;
  }else if(input.category==='bracket'){
    const min=positive('minSpanIn'),max=positive('maxSpanIn');if(Number(min)>Number(max))throw new ApiError(400,'Minimum span cannot exceed maximum span.');
    description=`Telescoping Support Bracket, ${min}–${max} in. Adjustable Span, ${required('mounting')}, ${required('material')}`;
    if(a.nominalSpacing)description+=`, ${a.nominalSpacing} Nominal Spacing`;
  }else if(input.category==='box')description=`${required('type')} Box, ${positive('widthIn')} × ${positive('heightIn')} × ${positive('depthIn')} in., ${required('material')}, ${required('knockouts')}`;
  else description=`${required('type')}, ${required('specification')}`;
  return {description,identity:materialIdentity(input.category,input.productUnit,a)};
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
  admin(p);const input=materialInput.parse(data),built=describeMaterial(input);yield* validateMaterialCategory(p,input);
  if(input.origin!=='admin_reviewed'&&input.verification==='reviewed')throw new ApiError(400,'AI-origin material records must enter as provisional.');
  let existing=(yield* query('SELECT material_id FROM catalog_profiles WHERE tenant=@p0 AND identity_key=@p1',p.tenant,built.identity))[0];
  if(!existing){const profiles=yield* query('SELECT p.material_id,p.attributes FROM catalog_profiles p JOIN materials m ON m.id=p.material_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND m.product_uom=@p1',p.tenant,input.productUnit);const matches=profiles.filter(row=>{const attributes=JSON.parse(row.attributes);return attributes.category===input.category&&materialIdentity(input.category,input.productUnit,attributes)===built.identity;});if(matches.length>1)throw new ApiError(409,'Several existing materials share these specifications. Resolve duplicate material records before importing.');existing=matches[0];}
  const byKey=(yield* query('SELECT id FROM materials WHERE tenant=@p0 AND LOWER(external_key)=LOWER(@p1)',p.tenant,input.externalKey))[0];
  if(existing){if(byKey&&String(byKey.id).toLowerCase()!==String(existing.material_id).toLowerCase())throw new ApiError(409,'External key conflicts with another material.');const material=(yield* query('SELECT details FROM materials WHERE tenant=@p0 AND id=@p1',p.tenant,existing.material_id))[0],stored=JSON.parse(material.details),before=stored.catalogDetails??{},merged={...before};let enriched=false;for(const [field,value] of Object.entries(input.details??{})){if(Object.hasOwn(merged,field)&&merged[field]!==value)throw new ApiError(409,'Existing material detail '+field+' differs; review before replacing it.');if(!Object.hasOwn(merged,field)){merged[field]=value;enriched=true;}}if(enriched&&!dry){yield* query('UPDATE materials SET details=@p0 WHERE tenant=@p1 AND id=@p2',JSON.stringify({...stored,catalogDetails:merged}),p.tenant,existing.material_id);yield* audit(p,'catalog.material_enriched',String(existing.material_id));}return {id:String(existing.material_id).toLowerCase(),unchanged:!enriched};}
  if(byKey)throw new ApiError(409,'Existing external key requires reviewed correction; no automatic merge.');
  // Legacy materials are not blindly merged based on wording. Identical descriptions
  // require an explicit profile review before adding another record.
  if((yield* query('SELECT id FROM materials WHERE tenant=@p0 AND description=@p1 AND active=1',p.tenant,built.description)).length)throw new ApiError(409,'Matching legacy description requires identity review.');
  if(dry)return {description:input.displayDescription??built.description};
  let batch=(yield* query('SELECT id FROM import_batches WHERE tenant=@p0 AND hash=@p1',p.tenant,digest('catalog-v2-materials')))[0];
  if(!batch){batch={id:randomUUID()};yield* query("INSERT INTO import_batches(id,tenant,hash,state,[file],report) VALUES(@p0,@p1,@p2,'applied',@p3,@p4)",batch.id,p.tenant,digest('catalog-v2-materials'),'',JSON.stringify({rows:0,errors:[],kind:'structured'}));}
  const id=randomUUID();
  const displayDescription=input.displayDescription??built.description;
  const row={schema_version:'1',external_key:input.externalKey,description:displayDescription,aliases_json:JSON.stringify([...new Set([built.description,displayDescription])]),requested_uom:input.productUnit,product_uom:input.productUnit,manufacturer:'',manufacturer_part_number:'',specifications_json:JSON.stringify(Object.entries(input.attributes).map(([k,v])=>`${k}: ${v}`)),conversion_basis_json:'null',source_url:input.sourceUrl,verification_basis:input.verificationBasis,dataset_kind:'reviewed'};
  yield* query('INSERT INTO materials(id,tenant,external_key,description,product_uom,details,dataset_kind,batch_id,active) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,1)',id,p.tenant,input.externalKey,displayDescription,input.productUnit,JSON.stringify({catalogDetails:input.details??{},displayDescription:input.displayDescription??null,row,specs:JSON.parse(row.specifications_json),category:input.category==='conduit'?'conduit':'general'}),'reviewed',batch.id);
  yield* query('INSERT INTO catalog_profiles(material_id,tenant,identity_key,attributes,verification,high_use) VALUES(@p0,@p1,@p2,@p3,@p4,0)',id,p.tenant,built.identity,JSON.stringify({category:input.category,...input.attributes,recordOrigin:input.origin}),input.verification);
  yield* audit(p,input.origin==='admin_reviewed'?'catalog.material_created':'catalog.material_ai_created',id);return {id,description:displayDescription,unchanged:false};
}
// Brand spelling and legal suffix variations are not new manufacturers. Ambiguous aliases require review.
export function manufacturerIdentity(value:string){return key(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/(?:\s+(?:inc|incorporated|corp|corporation|llc|ltd|limited))+$/,'').trim();}
export function* manufacturerByName(p:Principal,name:string):Operation<any>{
 const exact=(yield* query('SELECT * FROM manufacturers WHERE tenant=@p0 AND normalized=@p1',p.tenant,key(name)))[0];if(exact)return exact;
 const matches=(yield* query('SELECT * FROM manufacturers WHERE tenant=@p0',p.tenant)).filter(row=>manufacturerIdentity(row.name)===manufacturerIdentity(name));
 if(matches.length>1)throw new ApiError(409,'Manufacturer name matches several existing records. Resolve the duplicate manufacturer records before importing.');return matches[0];
}
export function* addProduct(p:Principal,data:unknown,dry=false):Operation<any>{
  admin(p);const input=productInput.parse(data);if(input.origin!=='admin_reviewed'&&input.verification==='reviewed')throw new ApiError(400,'AI-origin products must enter as provisional.');const material=yield* materialByKey(p,input.materialKey);
  let maker=yield* manufacturerByName(p,input.manufacturer);
  const prior=maker?(yield* query('SELECT * FROM manufacturer_products WHERE tenant=@p0 AND manufacturer_id=@p1 AND normalized_part=@p2',p.tenant,maker.id,key(input.partNumber)))[0]:null;
  if(prior){if(String(prior.material_id).toLowerCase()!==String(material.id).toLowerCase())throw new ApiError(409,'Manufacturer part number is already linked to another material.');const details={...JSON.parse(prior.details_json??'{}')};let enriched=false;for(const [field,value] of Object.entries(input.details??{})){if(Object.hasOwn(details,field)&&details[field]!==value)throw new ApiError(409,'Existing product detail '+field+' differs; review the product before replacing it.');if(!Object.hasOwn(details,field)){details[field]=value;enriched=true;}}if(enriched&&!dry){yield* query('UPDATE manufacturer_products SET details_json=@p0 WHERE tenant=@p1 AND id=@p2',JSON.stringify(details),p.tenant,prior.id);yield* audit(p,'catalog.product_enriched',String(prior.id));}return {id:String(prior.id).toLowerCase(),unchanged:!enriched};}
  if(dry)return {};
  if(!maker){maker={id:randomUUID()};yield* query('INSERT INTO manufacturers(id,tenant,name,normalized) VALUES(@p0,@p1,@p2,@p3)',maker.id,p.tenant,input.manufacturer,key(input.manufacturer));}
  const id=randomUUID();yield* query('INSERT INTO manufacturer_products(id,tenant,material_id,manufacturer_id,part_number,normalized_part,title,source_url,verification,details_json,active) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,1)',id,p.tenant,material.id,maker.id,input.partNumber,key(input.partNumber),input.title,input.sourceUrl,input.verification,JSON.stringify(input.details??{}));
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
  const input=z.object({eventId:z.uuid(),projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),materialId:z.uuid(),productId:z.uuid().nullable(),phrase:z.string().trim().min(1).max(500)}).strict().parse(data);
  if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,input.projectId)).length)throw new ApiError(404,'Project not found.');
  const material=yield* materialById(p,input.materialId);if(!material.active)throw new ApiError(409,'Material is inactive.');
  const existing=(yield* query('SELECT * FROM selection_events WHERE id=@p0',input.eventId))[0];
  if(existing){if(existing.tenant!==p.tenant||existing.actor!==p.oid||String(existing.material_id).toLowerCase()!==input.materialId||existing.phrase!==input.phrase||existing.project!==input.projectId||(existing.product_id?String(existing.product_id).toLowerCase():null)!==input.productId)throw new ApiError(409,'Selection identifier is already used.');return {unchanged:true};}
  if(input.productId)yield* productForMaterial(p,input.materialId,input.productId);
  yield* query('INSERT INTO selection_events(id,tenant,actor,project,material_id,product_id,phrase,created_at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)',input.eventId,p.tenant,p.oid,input.projectId,input.materialId,input.productId,input.phrase,new Date().toISOString());
  const selectedProfile=(yield* query('SELECT attributes FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,input.materialId))[0];
  const selectedComparison=compareSpecifications(input.phrase,selectedProfile?JSON.parse(selectedProfile.attributes):{},material.description);
  const translation=selectedComparison.missing.length||selectedComparison.conflicts.length?{skipped:true,reason:'Requested specifications need verification'}:yield* addPhrase(p,input.materialId,input.phrase,'user_selection');yield* audit(p,'catalog.selected',input.eventId);return {translation,unchanged:false};
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
  const storedDetails=JSON.parse(material.details),evidence=storedDetails.row??{},attributes=profile?JSON.parse(profile.attributes):{};
  let generatedDescription=material.description;
  if(attributes.category)try{generatedDescription=describeMaterial({externalKey:material.external_key,category:attributes.category,productUnit:material.product_uom,attributes:Object.fromEntries(Object.entries(attributes).filter(([key])=>!['category','recordOrigin'].includes(key))) as Record<string,string|number>,sourceUrl:evidence.source_url??'',verificationBasis:evidence.verification_basis??'',verification:profile?.verification??'provisional',origin:'admin_reviewed'}).description;}catch{/* Legacy records retain their existing description until structured review. */}

  return {id,details:storedDetails.catalogDetails??{},externalKey:material.external_key,description:material.description,generatedDescription,displayDescription:storedDetails.displayDescription??null,active:Boolean(material.active),productUnit:material.product_uom,sourceUrl:evidence.source_url??'',verificationBasis:evidence.verification_basis??'',attributes:profile?JSON.parse(profile.attributes):{},verification:profile?.verification??'reviewed',highUse:Boolean(profile?.high_use),preferredProductId:profile?.preferred_product_id?String(profile.preferred_product_id).toLowerCase():null,products:products.map(product=>({id:String(product.id).toLowerCase(),manufacturerId:String(product.manufacturer_id).toLowerCase(),manufacturer:product.manufacturer,partNumber:product.part_number,title:product.title,sourceUrl:product.source_url,details:JSON.parse(product.details_json??'{}'),verification:product.verification,allowed:product.allowed}))};
}
export function* setPriority(p:Principal,data:unknown):Operation<any>{
  admin(p);const input=z.object({materialId:z.uuid(),highUse:z.boolean(),preferredProductId:z.uuid().nullable()}).strict().parse(data);const m=yield* materialById(p,input.materialId);
  if(input.preferredProductId)yield* productForMaterial(p,input.materialId,input.preferredProductId);
  const exists=(yield* query('SELECT material_id FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,input.materialId))[0];
  if(!exists)yield* query('INSERT INTO catalog_profiles(material_id,tenant,identity_key,attributes,verification,high_use) VALUES(@p0,@p1,@p2,@p3,@p4,0)',m.id,p.tenant,digest(`legacy:${m.id}`),'{}','reviewed');
  yield* query('UPDATE catalog_profiles SET high_use=@p0,preferred_product_id=@p1 WHERE tenant=@p2 AND material_id=@p3',Number(input.highUse),input.preferredProductId,p.tenant,input.materialId);yield* audit(p,'catalog.priority_changed',input.materialId);return {updated:true};
}
export function* setPolicy(p:Principal,data:unknown):Operation<any>{
  admin(p);const input=policyInput.parse(data);input.manufacturerIds=input.manufacturerIds.map(id=>id.toLowerCase());input.productIds=input.productIds.map(id=>id.toLowerCase());let materialId:string|null=null;if(input.materialKey)materialId=String((yield* materialByKey(p,input.materialKey)).id).toLowerCase();
  for(const id of input.manufacturerIds)if(!(yield* query('SELECT id FROM manufacturers WHERE tenant=@p0 AND id=@p1',p.tenant,id)).length)throw new ApiError(400,'Unknown manufacturer.');
  for(const id of input.productIds){
    const product=(yield* query('SELECT material_id,manufacturer_id FROM manufacturer_products WHERE tenant=@p0 AND id=@p1 AND active=1',p.tenant,id))[0];
    if(!product)throw new ApiError(400,'Unknown product.');
    if(materialId&&String(product.material_id).toLowerCase()!==materialId)throw new ApiError(400,'Restricted part belongs to another material.');
    if(input.manufacturerIds.length&&!input.manufacturerIds.map(value=>value.toLowerCase()).includes(String(product.manufacturer_id).toLowerCase()))throw new ApiError(400,'Restricted part is outside the selected manufacturer list.');
  }
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
  if(materialId&&!(yield* materialById(p,materialId)).active)throw new ApiError(400,'This catalog material was retired or corrected. Select its active replacement before purchasing.');
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
  if(input.manufacturer){const maker=yield* manufacturerByName(p,input.manufacturer);const row=maker?(yield* query('SELECT p.id FROM manufacturer_products p WHERE p.tenant=@p0 AND p.material_id=@p1 AND p.manufacturer_id=@p2 AND p.normalized_part=@p3 AND p.active=1',p.tenant,m.id,maker.id,key(input.partNumber!)))[0]:undefined;if(!row)throw new ApiError(400,'Image manufacturer product not found.');productId=String(row.id).toLowerCase();}
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
  // Group once per request instead of rescanning every relationship for each material.
  const profilesByMaterial=new Map(profiles.map(row=>[String(row.material_id).toLowerCase(),row]));
  const phrasesByMaterial=new Map<string,string[]>(),productsByMaterial=new Map<string,RecordRow[]>();
  for(const row of aliases){const id=String(row.material_id).toLowerCase();const values=phrasesByMaterial.get(id)??[];values.push(row.phrase);phrasesByMaterial.set(id,values);}
  for(const row of products){const id=String(row.material_id).toLowerCase();const values=productsByMaterial.get(id)??[];values.push(row);productsByMaterial.set(id,values);}
  const countsByMaterial=new Map(counts.map(row=>[String(row.material_id).toLowerCase(),Number(row.uses)]));
  const rulesByMaterial=new Map<string,{category:string|null;makers:Set<string>;products:Set<string>}[]>();
  for(const row of policies){const id=row.material_id?String(row.material_id).toLowerCase():'*';const values=rulesByMaterial.get(id)??[];values.push({category:row.category,makers:new Set(JSON.parse(row.manufacturer_ids)),products:new Set(JSON.parse(row.product_ids))});rulesByMaterial.set(id,values);}
  const queryWords=searchWords(input.replace(/\bbrand\s+only\b/gi,''));
  const brand=explicitBrand(input);
  const requestedMakers=[...new Set(products.map(product=>product.manufacturer_normalized))].filter(maker=>(brand||String(maker).toLowerCase()!=='unistrut')&&new RegExp(`(?:^|[^a-z0-9])${String(maker).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^a-z0-9])`,'i').test(input));
  const results=materials.map(material=>{
    const id=String(material.id).toLowerCase(),details=JSON.parse(material.details),profile=profilesByMaterial.get(id),attributes=profile?JSON.parse(profile.attributes):{};
    let choices=[...(productsByMaterial.get(id)??[])];
    if(requestedMakers.length)choices=choices.filter(product=>requestedMakers.includes(product.manufacturer_normalized));
    if(requestedMakers.length&&!choices.length)return null;
    if(brand){choices=choices.filter(product=>String(product.manufacturer).toLowerCase().includes(brand));if(!choices.length)return null;}
    const applicable=[...(rulesByMaterial.get('*')??[]),...(rulesByMaterial.get(id)??[])].filter(rule=>!rule.category||rule.category===(attributes.category??details.category));
    for(const rule of applicable)choices=choices.filter(product=>(!rule.makers.size||rule.makers.has(String(product.manufacturer_id).toLowerCase()))&&(!rule.products.size||rule.products.has(String(product.id).toLowerCase())));
    if(applicable.length&&!choices.length)return null;
    const facets=materialFacets(attributes,material.description);
    const phraseList=[...couplingPhrases(attributes),structuredSearchPhrase(attributes),material.description,...JSON.parse(details.row.aliases_json),...(phrasesByMaterial.get(id)??[])];
    // Convert only a structured length for retrieval, never a requested quantity/UOM.
    if(attributes.lengthIn)phraseList.push(`${attributes.diameterIn} inch ${attributes.material} ${attributes.type} schedule ${attributes.schedule} ${Number(attributes.lengthIn)/12} ft`);
    for(const product of choices)phraseList.push(`${product.manufacturer} ${product.part_number} ${product.title} ${material.description}`);
    let q=queryWords;
    const span=q.match(/(?:for\s+(?:a\s+)?)?(\d+(?:\.\d+)?)[ -]*(?:inch|in\b|["″])[ -]*(?:span|spread)/i);
    if(span&&attributes.minSpanIn!=null&&attributes.maxSpanIn!=null){if(Number(span[1])<Number(attributes.minSpanIn)||Number(span[1])>Number(attributes.maxSpanIn))return null;q=q.replace(span[0],'').trim();}
    const comparison=compareSpecifications(q,attributes,material.description);
    const physical=searchConstraints(input,attributes);
    comparison.missing.push(...physical.missing);
    const guidance=searchGuidance(input);if(guidance&&!brand)comparison.missing.push(guidance);
    if(comparison.conflicts.length||physical.conflicts.length)return null;
    let rank=/^unistrut$|^strut$/i.test(input.trim())&&facets.family?.includes('Unistrut')?85:/^pvc$/i.test(input.trim())&&facets.family?.includes('PVC')?85:0;for(const phrase of new Set(phraseList))rank=Math.max(rank,score(q,searchWords(phrase)));
    const schedule=q.match(/\bsch(?:edule)?\s*(\d+)\b/i)?.[1],expectedSchedule=attributes.schedule??material.description.match(/\bsch(?:edule)?\s*(\d+)\b/i)?.[1];
    if(!matchesPhysicalSearch(input,attributes))return null;
    if(comparison.retrieval&&/[a-z]/i.test(comparison.retrieval)){for(const phrase of new Set(phraseList))rank=Math.max(rank,Math.min(90,score(comparison.retrieval,searchWords(phrase))));}
    const diameter=/\b(?:diameter|dia)\b/i.test(q)?undefined:sizeQueryWithoutRadius(q).match(/\b(\d+(?:\.\d+|\/\d+)?)\s*(?:inch|in\b|["″])/i)?.[1];
    const mappedTerminology=(phrasesByMaterial.get(id)??[]).some(phrase=>score(q,searchWords(phrase))>=90);
    if(!mappedTerminology&&((/\bpipe\b/i.test(q)&&attributes.type==='conduit')||(/\bconduit\b/i.test(q)&&attributes.type==='pipe')))rank=0;
    if((schedule&&expectedSchedule&&String(schedule)!==String(expectedSchedule))||(diameter&&attributes.diameterIn&&Number(diameter)!==Number(attributes.diameterIn)))rank=0;
    choices.sort((a,b)=>Number(key(input).includes(key(b.part_number)))-Number(key(input).includes(key(a.part_number)))||Number(String(b.id).toLowerCase()===String(profile?.preferred_product_id).toLowerCase())-Number(String(a.id).toLowerCase()===String(profile?.preferred_product_id).toLowerCase()));
    const useCount=countsByMaterial.get(id)??0;
    return {id,searchFacets:facets,description:material.description,productUnit:material.product_uom,specs:details.specs,category:details.category,source:material.dataset_kind==='fixture'?'verified_fixture':'verified',verification:profile?.verification??'reviewed',score:rank,highUse:Boolean(profile?.high_use)||useCount>=10,useCount,matchStatus:comparison.missing.length?'needs_verification':'matches_requirements',missingSpecifications:comparison.missing,reason:comparison.missing.length?'Needs verification: '+comparison.missing.join('; '):'Matches requested specifications',preferredProductId:profile?.preferred_product_id?String(profile.preferred_product_id).toLowerCase():null,products:choices.map(product=>({id:String(product.id).toLowerCase(),manufacturer:product.manufacturer,partNumber:product.part_number,verification:product.verification})),provenance:{sourceUrl:details.row.source_url,verificationBasis:details.row.verification_basis,datasetKind:material.dataset_kind}};
  }).filter((row):row is NonNullable<typeof row>=>Boolean(row&&row.score>=85));
  return results.sort((a,b)=>Number(a.matchStatus==='needs_verification')-Number(b.matchStatus==='needs_verification')||b.score-a.score||Number(b.highUse)-Number(a.highUse)||Math.min(b.useCount,100)-Math.min(a.useCount,100)||a.description.localeCompare(b.description));
}
const importKinds=['material','product','translation','image'] as const;
export function parseExtendedCsv(csv:string){
  const errors:{row:number;message:string}[]=[],records:{kind:typeof importKinds[number];data:unknown;row:number}[]=[];let rowCount=0;
  try{
    let legacy=false;
    const rows:Record<string,string>[]=parse(csv,{bom:true,columns:(header:string[])=>{const columns=header.map(value=>value.trim());if(columns.some(value=>!value)||new Set(columns).size!==columns.length)throw new Error('Use nonempty, unique template column headers.');legacy=columns.length===2&&columns.includes('kind')&&columns.includes('data_json');if(!columns.includes('kind')||(!legacy&&columns.includes('data_json')))throw new Error('Use the Excel-friendly column templates and save as CSV UTF-8 (Comma delimited). Legacy kind,data_json files are also supported.');return columns;},skip_empty_lines:true,max_record_size:20000});
    const nonempty=(row:Record<string,string>)=>Object.values(row).some(value=>value.trim());
    rowCount=rows.filter(nonempty).length;
    if(!rowCount||rowCount>2000)throw new Error('Use 1–2000 rows per staged file.');
    const seen=new Set<string>(),identities=new Map<string,number>();
    rows.forEach((row,i)=>{if(!nonempty(row))return;try{const kind=z.enum(importKinds).parse(row.kind.trim().toLowerCase()),schema={material:materialInput,product:productInput,translation:translationInput,image:imageReferenceInput}[kind],data=schema.parse(legacy?JSON.parse(row.data_json):spreadsheetRecord(kind,row));const identifier=JSON.stringify([kind,data]);if(seen.has(identifier))throw new Error('Duplicate row.');
      const value=data as any;let identifiers:string[]=[];
      if(kind==='material')identifiers=['material-key:'+value.externalKey.toLowerCase(),'material-spec:'+describeMaterial(value).identity];
      if(kind==='product')identifiers=['product:'+JSON.stringify([key(value.manufacturer),key(value.partNumber)])];
      if(kind==='translation')identifiers=['translation:'+JSON.stringify([value.materialKey.toLowerCase(),phraseKey(value.phrase),value.origin])];
      if(kind==='image')identifiers=['image:'+JSON.stringify([value.materialKey.toLowerCase(),key(value.manufacturer??''),key(value.partNumber??''),value.sourceUrl])];
      const duplicate=identifiers.find(identity=>identities.has(identity));if(duplicate)throw new Error(`Repeated catalog identity conflicts with row ${identities.get(duplicate)}. Keep one record per material specification, manufacturer part, or translation origin.`);
      seen.add(identifier);for(const identity of identifiers)identities.set(identity,i+2);records.push({kind,data,row:i+2});}catch(error){errors.push({row:i+2,message:error instanceof z.ZodError?'Invalid fields: '+error.issues.slice(0,3).map(issue=>`${issue.path.join('.')||'record'}: ${issue.message}`).join('; '):error instanceof Error?error.message:'Invalid JSON.'});}});
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
  const input=z.object({eventId:z.uuid(),projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),phrase:z.string().trim().min(1).max(500),material:materialInput,product:productInput.omit({materialKey:true}),additionalPhrases:z.array(z.string().trim().min(1).max(500)).max(8).default([])}).strict().parse(data);
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
const correctionBase={reason:z.string().trim().min(10).max(2000),expectedHash:z.string().regex(/^[a-f\d]{64}$/).optional(),approval:z.string().optional()};
const materialCorrection=z.object({id:z.uuid(),material:materialInput,...correctionBase}).strict();
const productCorrection=z.object({id:z.uuid(),product:productInput,...correctionBase}).strict();
const mergeCorrection=z.object({sourceId:z.uuid(),targetId:z.uuid(),specifications:materialInput,phrases:z.array(z.string().trim().min(1).max(500)).max(100).default([]),...correctionBase}).strict();
function* materialImpact(p:Principal,id:string):Operation<any>{
 const count=(rows:RecordRow[])=>Number(rows[0].total);
 return {savedLines:count(yield* query('SELECT COUNT(*) AS total FROM draft_lines l JOIN drafts d ON d.id=l.draft_id WHERE d.tenant=@p0 AND l.material_id=@p1',p.tenant,id)),products:count(yield* query('SELECT COUNT(*) AS total FROM manufacturer_products WHERE tenant=@p0 AND material_id=@p1 AND active=1',p.tenant,id)),activeRules:count(yield* query('SELECT COUNT(*) AS total FROM job_restrictions WHERE tenant=@p0 AND material_id=@p1 AND enabled=1',p.tenant,id)),images:count(yield* query('SELECT COUNT(*) AS total FROM image_associations WHERE tenant=@p0 AND material_id=@p1',p.tenant,id))};
}
function* revision(p:Principal,kind:string,entity:string,replacement:string|null,before:unknown,after:unknown,reason:string,requestKey:string):Operation<string>{
 const id=randomUUID();yield* query('INSERT INTO catalog_revisions(id,tenant,kind,entity_id,replacement_id,before_json,after_json,reason,actor,created_at,request_key) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10)',id,p.tenant,kind,entity,replacement,JSON.stringify(before),JSON.stringify(after),reason,p.oid,new Date().toISOString(),requestKey);yield* audit(p,'catalog.correction_applied',id);return id;
}
export function* correctCatalog(p:Principal,kind:'material'|'product'|'merge',data:unknown,apply=false):Operation<any>{
 admin(p);const input:any=({material:materialCorrection,product:productCorrection,merge:mergeCorrection}[kind]).parse(data);
 const requestKey=digest(JSON.stringify({kind,input}));
 if(apply){const prior=(yield* query('SELECT id,replacement_id FROM catalog_revisions WHERE tenant=@p0 AND request_key=@p1',p.tenant,requestKey))[0];if(prior)return {id:String(prior.id).toLowerCase(),replacementId:prior.replacement_id?String(prior.replacement_id).toLowerCase():null,unchanged:true};}
 let before:any,after:any,impact:any,mode:string;
 if(kind==='material'){
  yield* validateMaterialCategory(p,input.material);
  const m=yield* materialById(p,input.id);if(!m.active)throw new ApiError(409,'Retired materials are historical records. Correct their active replacement instead.');
  const profile=(yield* query('SELECT * FROM catalog_profiles WHERE tenant=@p0 AND material_id=@p1',p.tenant,input.id))[0];
  const built=describeMaterial(input.material);mode=profile&&materialIdentity(input.material.category,m.product_uom,JSON.parse(profile.attributes))===built.identity?'metadata':'replacement';
  if(mode==='metadata'&&input.material.externalKey!==m.external_key)throw new ApiError(400,'Keep the stable key for a metadata correction.');
  if(mode==='replacement'&&key(input.material.externalKey)===key(m.external_key))throw new ApiError(400,'A specification change needs a new stable material key; the old key is retained for history.');
  const origin=profile?JSON.parse(profile.attributes).recordOrigin??'admin_reviewed':'admin_reviewed';
  const previousDetails=JSON.parse(m.details),oldAttributes=profile?JSON.parse(profile.attributes):{};
  const ordered=(value:Record<string,unknown>)=>JSON.stringify(Object.entries(value).filter(([key])=>!['category','recordOrigin'].includes(key)).sort(([a],[b])=>a.localeCompare(b)));
  const descriptionOnly=mode==='metadata'&&input.material.displayDescription!==undefined&&input.material.category===oldAttributes.category&&input.material.productUnit===m.product_uom&&ordered(input.material.attributes)===ordered(oldAttributes)&&input.material.sourceUrl===(previousDetails.row?.source_url??'')&&input.material.verificationBasis===(previousDetails.row?.verification_basis??'');
  const override=input.material.displayDescription!==undefined?input.material.displayDescription:mode==='metadata'?(previousDetails.displayDescription??null):null;
  before={material:m,profile:profile??null};after={...input.material,origin,displayDescription:override,verification:descriptionOnly?(profile?.verification??'provisional'):'provisional',description:override??built.description,descriptionOnly};impact=yield* materialImpact(p,input.id);
  let existing=(yield* query('SELECT material_id FROM catalog_profiles WHERE tenant=@p0 AND identity_key=@p1',p.tenant,built.identity))[0];
  if(!existing){const profiles=yield* query('SELECT p.material_id,p.attributes FROM catalog_profiles p JOIN materials m ON m.id=p.material_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND m.product_uom=@p1',p.tenant,input.material.productUnit);const matches=profiles.filter(row=>{const attributes=JSON.parse(row.attributes);return attributes.category===input.material.category&&materialIdentity(input.material.category,input.material.productUnit,attributes)===built.identity;});if(matches.length>1)throw new ApiError(409,'Several existing materials share these specifications. Resolve duplicate material records before importing.');existing=matches[0];}
  if(existing&&String(existing.material_id).toLowerCase()!==input.id.toLowerCase()){after.existingTarget=yield* materialById(p,String(existing.material_id).toLowerCase());if(!after.existingTarget.active)throw new ApiError(409,'The matching canonical material is retired. Review it separately before correcting this item.');}
 }else if(kind==='product'){
  const product=(yield* query('SELECT p.*,m.name AS manufacturer FROM manufacturer_products p JOIN manufacturers m ON m.id=p.manufacturer_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND p.id=@p1',p.tenant,input.id))[0];if(!product)throw new ApiError(404,'Product not found.');if(!product.active)throw new ApiError(409,'Retired products are historical records.');
  const material=yield* materialById(p,String(product.material_id).toLowerCase());if(!material.active||material.external_key!==input.product.materialKey)throw new ApiError(400,'This editor retains the current material relationship. Review a wrong material mapping separately.');
  mode=key(product.manufacturer)===key(input.product.manufacturer)&&key(product.part_number)===key(input.product.partNumber)?'metadata':'replacement';before={product};after={...input.product,origin:'admin_reviewed',verification:'provisional'};impact=yield* materialImpact(p,String(material.id).toLowerCase());
  if(mode==='replacement'){
   const existing=(yield* query('SELECT p.* FROM manufacturer_products p JOIN manufacturers m ON m.id=p.manufacturer_id AND m.tenant=p.tenant WHERE p.tenant=@p0 AND m.normalized=@p1 AND p.normalized_part=@p2',p.tenant,key(input.product.manufacturer),key(input.product.partNumber)))[0];
   if(existing){if(!existing.active)throw new ApiError(409,'The matching manufacturer product is retired. Review it separately.');if(String(existing.material_id).toLowerCase()!==String(material.id).toLowerCase())throw new ApiError(409,'Manufacturer part number is already linked to another material.');after.existingTarget=existing;}
  }
 }else{
  if(input.sourceId.toLowerCase()===input.targetId.toLowerCase())throw new ApiError(400,'Choose two different materials.');
  const source=yield* materialById(p,input.sourceId),target=yield* materialById(p,input.targetId);if(!source.active||!target.active)throw new ApiError(409,'Choose two active materials.');
  const profiles=yield* query('SELECT * FROM catalog_profiles WHERE tenant=@p0 AND (material_id=@p1 OR material_id=@p2)',p.tenant,input.sourceId,input.targetId);
  const sourceProfile=profiles.find(row=>String(row.material_id).toLowerCase()===input.sourceId.toLowerCase()),targetProfile=profiles.find(row=>String(row.material_id).toLowerCase()===input.targetId.toLowerCase()),identity=describeMaterial(input.specifications).identity;
  if(!targetProfile||targetProfile.verification!=='reviewed'||targetProfile.identity_key!==identity)throw new ApiError(409,'The retained material must have the independently reviewed defining specifications.');
  if(source.product_uom!==target.product_uom||(sourceProfile&&JSON.parse(sourceProfile.attributes).category&&sourceProfile.identity_key!==identity))throw new ApiError(409,'Meaningfully different specifications or units cannot be merged.');
  impact=yield* materialImpact(p,input.sourceId);if(impact.products||impact.activeRules)throw new ApiError(409,'Review linked manufacturer products and disable source-specific active restrictions before retiring a duplicate. Nothing was moved.');
  const sourceDetails=JSON.parse(source.details),available=new Set<string>([source.description,...JSON.parse(sourceDetails.row.aliases_json)]);
  for(const phrase of input.phrases)if(!available.has(phrase)&&!(yield* query('SELECT id FROM translations WHERE tenant=@p0 AND material_id=@p1 AND phrase=@p2 AND active=1',p.tenant,input.sourceId,phrase)).length)throw new ApiError(400,'Copy only phrases recorded on the duplicate.');
  before={source,target,sourceProfile:sourceProfile??null,targetProfile};after={targetId:input.targetId,phrases:input.phrases,specifications:input.specifications};mode='retire-duplicate';
 }
 const previewHash=digest(JSON.stringify({kind,before,after,impact,reason:input.reason}));
 if(!apply)return {kind,mode,previewHash,before,after,impact,description:after.description,descriptionOnly:after.descriptionOnly??false,requiresReview:true};
 if(input.approval!=='I reviewed the correction and historical impact')throw new ApiError(400,'Explicit correction review is required.');
 if(input.expectedHash!==previewHash)throw new ApiError(409,'The catalog or correction changed. Preview it again; nothing was changed.');
 let replacement:string|null=null;
 if(kind==='material'){
  if(mode==='replacement'){
   yield* query('UPDATE materials SET active=0 WHERE tenant=@p0 AND id=@p1',p.tenant,input.id);
   const {description,existingTarget,descriptionOnly,...material}=after;const created=yield* createMaterial(p,material);replacement=created.id;
  }else{
   const old=JSON.parse(before.material.details),row={...old.row,description:after.description,source_url:after.sourceUrl,verification_basis:after.verificationBasis,specifications_json:JSON.stringify(Object.entries(after.attributes).map(([k,v])=>`${k}: ${v}`))};
   yield* query('UPDATE materials SET description=@p0,details=@p1 WHERE tenant=@p2 AND id=@p3',after.description,JSON.stringify({...old,displayDescription:after.displayDescription,row,specs:JSON.parse(row.specifications_json)}),p.tenant,input.id);
   yield* query("UPDATE catalog_profiles SET attributes=@p0,verification=@p1 WHERE tenant=@p2 AND material_id=@p3",JSON.stringify({category:after.category,...after.attributes,recordOrigin:after.origin}),after.verification,p.tenant,input.id);
  }
 }else if(kind==='product'){
  if(mode==='replacement'){
   const {existingTarget,...product}=after;const result=yield* addProduct(p,product);replacement=result.id;const activeTarget=(yield* query('SELECT active FROM manufacturer_products WHERE tenant=@p0 AND id=@p1',p.tenant,replacement))[0];if(!activeTarget?.active)throw new ApiError(409,'The matching manufacturer product is retired. Review it separately.');if(replacement===input.id.toLowerCase())throw new ApiError(409,'The corrected product identity still resolves to the original.');
   yield* query('UPDATE manufacturer_products SET active=0 WHERE tenant=@p0 AND id=@p1',p.tenant,input.id);
   yield* query('UPDATE catalog_profiles SET preferred_product_id=@p0 WHERE tenant=@p1 AND material_id=@p2 AND preferred_product_id=@p3',null,p.tenant,before.product.material_id,input.id);
  }else yield* query("UPDATE manufacturer_products SET title=@p0,source_url=@p1,details_json=@p2,verification='provisional' WHERE tenant=@p3 AND id=@p4",after.title,after.sourceUrl,after.details?JSON.stringify(after.details):(before.product.details_json??'{}'),p.tenant,input.id);
 }else{
  replacement=input.targetId;yield* query('UPDATE materials SET active=0 WHERE tenant=@p0 AND id=@p1',p.tenant,input.sourceId);
  for(const phrase of input.phrases)yield* addPhrase(p,input.targetId,phrase,'admin_reviewed',null,input.specifications.sourceUrl);
 }
 const id=yield* revision(p,kind,input.id??input.sourceId,replacement,before,after,input.reason,requestKey);
 return {id,replacementId:replacement,mode,unchanged:false};
}

export function* catalogPage(p:Principal,data:unknown):Operation<any>{
  admin(p);
  const input=z.object({section:z.enum(['materials','translations','policies','images','batches','manufacturers','revisions']),page:z.number().int().min(1).max(100000).default(1),pageSize:z.number().int().min(1).max(100).default(25),text:z.string().trim().max(200).default(''),materialId:z.uuid().optional(),includeInactive:z.boolean().default(false),ruleScope:z.enum(['all','global']).default('all'),manufacturerIds:z.array(z.uuid()).max(100).optional(),ruleId:z.uuid().optional(),entityId:z.uuid().optional()}).strict().parse(data);
  let table='',columns='*',where='tenant=@p0',order='id';const values:unknown[]=[p.tenant];
  switch(input.section){
    case 'materials':table='materials';columns='id,external_key,description,product_uom,active';if(!input.includeInactive)where+=' AND active=1';if(input.text){const pattern='%'+input.text.toLowerCase().replace(/[!%_]/g,c=>'!'+c)+'%';values.push(pattern);where+=" AND (LOWER(description) LIKE @p1 ESCAPE '!' OR LOWER(external_key) LIKE @p1 ESCAPE '!')";}order='external_key,id';break;
    case 'translations':if(!input.materialId)throw new ApiError(400,'Choose a material first.');yield* materialById(p,input.materialId);table='translations';values.push(input.materialId);where+=' AND material_id=@p1';order='created_at DESC,id';break;
    case 'policies':table='job_restrictions';if(input.ruleScope==='global')where+=' AND material_id IS NULL';if(input.materialId){yield* materialById(p,input.materialId);values.push(input.materialId);where+=' AND material_id=@p'+(values.length-1);}if(input.ruleId){values.push(input.ruleId);where+=' AND id=@p'+(values.length-1);}order='project,id';break;
    case 'manufacturers':table='manufacturers';columns='id,name';order='normalized,id';if(input.manufacturerIds){if(!input.manufacturerIds.length)where+=' AND 1=0';else{where+=' AND id IN ('+input.manufacturerIds.map(id=>{values.push(id);return '@p'+(values.length-1);}).join(',')+')';}}else if(input.text){values.push('%'+input.text.toLowerCase().replace(/[!%_]/g,c=>'!'+c)+'%');where+=" AND LOWER(name) LIKE @p1 ESCAPE '!'";}break;
    case 'revisions':table='catalog_revisions';columns='id,kind,entity_id,replacement_id,reason,actor,created_at';order='created_at DESC,id';if(input.entityId){values.push(input.entityId);where+=' AND (entity_id=@p1 OR replacement_id=@p1 OR entity_id IN (SELECT id FROM manufacturer_products WHERE tenant=@p0 AND material_id=@p1))';}break;
    case 'images':table='image_references';break;
    case 'batches':table='catalog_batches';columns='id,state,report,created_at';where+=" AND state IN ('preview','applied','rolled_back')";order='created_at DESC,id';break;
  }
  const total=Number((yield* query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`,...values))[0].total);
  const pages=Math.max(1,Math.ceil(total/input.pageSize)),page=Math.min(input.page,pages),start=(page-1)*input.pageSize;
  const low=values.length;values.push(start,start+input.pageSize);
  const records=yield* query(`SELECT * FROM (SELECT ${columns},ROW_NUMBER() OVER(ORDER BY ${order}) AS page_row FROM ${table} WHERE ${where}) paged WHERE page_row>@p${low} AND page_row<=@p${low+1} ORDER BY page_row`,...values);
  return {records:records.map(({page_row,...row})=>row),total,page,pageSize:input.pageSize,pages};
}
export function* batchDetails(p:Principal,data:unknown):Operation<any>{
  admin(p);const input=z.object({id:z.uuid(),page:z.number().int().min(1).default(1),includeSource:z.boolean().default(false)}).strict().parse(data);
  const row=(yield* query('SELECT * FROM catalog_batches WHERE tenant=@p0 AND id=@p1',p.tenant,input.id))[0];if(!row)throw new ApiError(404,'Import not found.');
  if(JSON.parse(row.report).workflow==='unpublished-import-v1')throw new ApiError(400,'Open this import in Administration → Workbook imports.');
  const parsed=parseExtendedCsv(row.csv),pages=Math.max(1,Math.ceil(parsed.records.length/25)),page=Math.min(input.page,pages);
  return {id:String(row.id).toLowerCase(),state:row.state,report:JSON.parse(row.report),...(input.includeSource?{sourceCsv:row.csv}:{}),records:parsed.records.slice((page-1)*25,page*25),page,pages};
}
export const catalogExportTables=['material_categories','materials','aliases','catalog_profiles','manufacturers','manufacturer_products','translations','selection_events','job_restrictions','catalog_batches','image_references','image_associations','import_batches','catalog_revisions'] as const;
export function* catalogExportPage(p:Principal,data:unknown):Operation<any>{
  admin(p);
  const input=z.object({table:z.enum(catalogExportTables),pageSize:z.number().int().min(1).max(500).default(250),cursor:z.object({id:z.uuid(),normalized:z.string().min(1).max(200).optional()}).strict().optional()}).strict().parse(data);
  const alias=input.table==='aliases',profile=input.table==='catalog_profiles';
  if(input.cursor&&Boolean(input.cursor.normalized)!==alias)throw new ApiError(400,'Invalid export cursor for this table.');
  const source=alias?'aliases a INNER JOIN materials m ON m.id=a.material_id':input.table;
  const id=alias?'a.material_id':profile?'material_id':'id',columns=alias?'a.*,m.tenant':'*',scope=alias?'m.tenant':'tenant';
  const sortId=`LOWER(CAST(${id} AS VARCHAR(36)))`;
  const values:unknown[]=[p.tenant];let where=`${scope}=@p0`;
  if(input.cursor){values.push(input.cursor.id);where+=alias?` AND (${sortId}>@p1 OR (${sortId}=@p1 AND a.normalized>@p2))`:` AND ${sortId}>@p1`;if(alias)values.push(input.cursor.normalized);}
  const limit=values.length;values.push(input.pageSize);
  const rows=yield* query(`SELECT * FROM (SELECT ${columns},ROW_NUMBER() OVER(ORDER BY ${sortId}${alias?',a.normalized':''}) AS export_row FROM ${source} WHERE ${where}) export_page WHERE export_row<=@p${limit} ORDER BY export_row`,...values);
  const records=rows.map(({export_row,...row})=>row),last=records.at(-1);
  return {records,nextCursor:records.length===input.pageSize?{id:String(last![alias||profile?'material_id':'id']).toLowerCase(),...(alias?{normalized:last!.normalized}:{})}:null};
}
// A versioned review snapshot preserves inactive records and their provenance.
// It is intentionally distinct from staged imports and database/blob recovery.
export function* exportCatalogSnapshot(p:Principal):Operation<any>{
  admin(p);
  const tables:Record<string,RecordRow[]>={};
  let count=0;
  for(const table of catalogExportTables){
    const source=table==='aliases'?'aliases a INNER JOIN materials m ON m.id=a.material_id':table;
    const scope=table==='aliases'?'m.tenant':'tenant';
    const columns=table==='aliases'?'a.*,m.tenant':'*';
    const size=Number((yield* query(`SELECT COUNT(*) AS total FROM ${source} WHERE ${scope}=@p0`,p.tenant))[0].total);
    count+=size;
    if(count>10000)throw new ApiError(413,'Catalog snapshot exceeds 10,000 records. Request a paged export before expanding this catalog.');
    tables[table]=yield* query(`SELECT ${columns} FROM ${source} WHERE ${scope}=@p0`,p.tenant);
  }
  const snapshot={format:'etalonops-catalog-snapshot',version:1,exportedAt:new Date().toISOString(),tenant:p.tenant,recordCount:count,includesInactive:true,imageFilesIncluded:false,tables};
  if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>20000000)throw new ApiError(413,'Catalog snapshot exceeds 20 MB. Request a paged export.');
  yield* audit(p,'catalog.snapshot_exported',String(count));
  return snapshot;
}
export function* catalogAction(p:Principal,action:string,data:any):Operation<any>{
 if(action.startsWith('manual-'))return yield* manualReview(p,action,data);
 if(action.startsWith('cms-'))return yield* cmsCommand(p,action,data);
 if(action.startsWith('appearance-'))return yield* appearanceCommand(p,action,data);
 if(action.startsWith('design-'))return yield* designCommand(p,action,data);
 if(action==='material-families')return {families:materialFamilies};
 if(action.startsWith('material-workbook-'))return yield* materialWorkbookAction(p,action,data);
  if(['material-table-page','material-table-row','material-table-preview','material-table-save','material-categories','material-category-save'].includes(action))return yield* materialTable(p,action,data);
  if(action.startsWith('designer-'))return yield* designerCommand(p,action,data);
  if(action.startsWith('inbox-'))return yield* inboxAction(p,action,data);
  switch(action){
    case 'prepared-preview':return yield* preparedResearchAction(p,data);
    case 'prepared-stage':return yield* preparedResearchAction(p,data,true);
    case 'research-stage':return yield* stageResearch(p,data);
    case 'research-preview':return yield* researchAction(p,data);
    case 'research-apply':return yield* researchAction(p,data,true);
    case 'external-image':{const input=z.object({materialId:z.uuid(),productId:z.uuid().nullable()}).parse(data);const material=yield* materialById(p,input.materialId);if(!material.active)throw new ApiError(404,'Material not found.');const rows=yield* query("SELECT i.id,i.source_url,i.product_id FROM image_references i LEFT JOIN manufacturer_products p ON p.id=i.product_id AND p.tenant=i.tenant AND p.material_id=i.material_id WHERE i.tenant=@p0 AND i.material_id=@p1 AND i.status='approved' AND (i.product_id IS NULL OR p.active=1)",p.tenant,input.materialId);const match=selectImage(rows,input.productId);return {url:match?.source_url??null};}
    case 'export-page':return yield* catalogExportPage(p,data);
    case 'preview-material-correction':return yield* correctCatalog(p,'material',data);
    case 'apply-material-correction':return yield* correctCatalog(p,'material',data,true);
    case 'preview-product-correction':return yield* correctCatalog(p,'product',data);
    case 'apply-product-correction':return yield* correctCatalog(p,'product',data,true);
    case 'preview-duplicate-retirement':return yield* correctCatalog(p,'merge',data);
    case 'apply-duplicate-retirement':return yield* correctCatalog(p,'merge',data,true);
    case 'revision-details':{admin(p);const id=z.uuid().parse(data.id);const row=(yield* query('SELECT * FROM catalog_revisions WHERE tenant=@p0 AND id=@p1',p.tenant,id))[0];if(!row)throw new ApiError(404,'Revision not found.');return {...row,before:JSON.parse(row.before_json),after:JSON.parse(row.after_json)};}
    case 'page':return yield* catalogPage(p,data);
    case 'batch-details':return yield* batchDetails(p,data);
    case 'export-snapshot':return yield* exportCatalogSnapshot(p);
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
      const body=z.object({projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),lines:z.array(z.object({id:z.uuid(),candidate:z.object({id:z.string()}).nullable(),purchasing:purchaseSchema.optional()}).passthrough()).max(500)}).parse(data);
      if(!(yield* query('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,body.projectId)).length)throw new ApiError(404,'Project not found.');
      const issues:{lineId:string;message:string}[]=[];for(const line of body.lines){try{yield* validatePurchase(p,body.projectId,line.candidate?.id??null,line.purchasing);}catch(error){if(!(error instanceof ApiError))throw error;issues.push({lineId:line.id,message:error.message});}}return {issues,ready:issues.length===0};
    }
    case 'details':return yield* materialDetails(p,z.uuid().parse(data.id),z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/).optional().parse(data.projectId));
    case 'translations':return yield* translationsForAdmin(p,z.uuid().parse(data.id));
    case 'reject-translation':return yield* rejectTranslation(p,z.uuid().parse(data.id));
    case 'image-reference':return yield* addImageReference(p,data);
    case 'preview':return yield* previewBulk(p,z.string().max(800000).parse(data.csv));
    case 'apply':return yield* applyBulk(p,z.uuid().parse(data.id),z.string().parse(data.approval));
    case 'rollback':return yield* rollbackBulk(p,z.uuid().parse(data.id));
    case 'disable-policy':{admin(p);const id=z.uuid().parse(data.id);if(!(yield* query('SELECT id FROM job_restrictions WHERE tenant=@p0 AND id=@p1',p.tenant,id)).length)throw new ApiError(404,'Restriction not found.');yield* query('UPDATE job_restrictions SET enabled=0 WHERE tenant=@p0 AND id=@p1',p.tenant,id);yield* audit(p,'job.restriction_disabled',id);return {disabled:true};}
    case 'readiness':return yield* catalogReadiness(p,data);
    case 'pdf-template-get':case 'pdf-template-save':return yield* templateCommand(p,action,data);
    case 'overview':admin(p);return {manufacturers:yield* query('SELECT * FROM manufacturers WHERE tenant=@p0',p.tenant),policies:yield* query('SELECT * FROM job_restrictions WHERE tenant=@p0',p.tenant),batches:yield* query("SELECT id,state,report,created_at FROM catalog_batches WHERE tenant=@p0 AND state IN ('preview','applied','rolled_back')",p.tenant),imageReferences:yield* query('SELECT * FROM image_references WHERE tenant=@p0',p.tenant)};
    default:throw new ApiError(404,'Unknown catalog operation.');
  }
}

export {query,audit,materialById,addPhrase};
