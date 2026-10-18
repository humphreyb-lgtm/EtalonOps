import {createHash} from 'node:crypto';
import {z} from 'zod';
import {researchResults} from '../src/catalog-research';
import {ApiError,type Principal} from './contracts';
import {type Operation,materialInput,productInput,translationInput,describeMaterial,createMaterial,addProduct,previewBulk,applyBulk,parseExtendedCsv} from './catalog-v2';
const requestSchema=z.object({results:researchResults,previewHash:z.string().optional(),approval:z.string().optional()}).strict();
const csv=(kind:string,rows:readonly unknown[])=>'kind,data_json\n'+rows.map(row=>`${kind},"${JSON.stringify(row).replaceAll('"','""')}"`).join('\n');
export function* researchAction(p:Principal,data:unknown,apply=false):Operation<any>{
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');
 const input=requestSchema.parse(data),materials=new Map<string,any>(),products:any[]=[],phrases=new Map<string,any>(),summaries:any[]=[],identities=new Map<string,string>(),parts=new Set<string>();
 for(const item of input.results.items){
  const material=materialInput.parse({externalKey:item.externalKey,category:item.category,productUnit:item.productUnit,attributes:item.attributes,sourceUrl:item.sourceUrl,verificationBasis:item.verificationBasis,origin:'ai_discovery',verification:'provisional'}),built=describeMaterial(material);
  const sameKey=materials.get(item.externalKey.toLowerCase());if(sameKey&&describeMaterial(sameKey).identity!==built.identity)throw new ApiError(409,'One material key has conflicting specifications.');
  const existing=yield* createMaterial(p,material,true);
  let materialKey=identities.get(built.identity)??material.externalKey;
  if(existing.id){const row=(yield {text:'SELECT external_key FROM materials WHERE tenant=@p0 AND id=@p1',values:[p.tenant,existing.id]})[0];materialKey=String(row.external_key);}
  identities.set(built.identity,materialKey);materials.set(item.externalKey.toLowerCase(),material);
  const product=productInput.parse({materialKey,manufacturer:item.manufacturer,partNumber:item.partNumber,title:item.title,sourceUrl:item.sourceUrl,verification:'provisional',origin:'ai_discovery'});
  const partKey=JSON.stringify([product.manufacturer.toLowerCase(),product.partNumber.toLowerCase()]);if(parts.has(partKey))throw new ApiError(409,'A manufacturer part appears more than once.');parts.add(partKey);
  const prior=(yield {text:'SELECT p.id,p.material_id FROM manufacturer_products p JOIN manufacturers m ON p.manufacturer_id=m.id AND p.tenant=m.tenant WHERE p.tenant=@p0 AND m.normalized=@p1 AND p.normalized_part=@p2',values:[p.tenant,product.manufacturer.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(),product.partNumber.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()]})[0];
  if(prior&&(!existing.id||String(prior.material_id).toLowerCase()!==String(existing.id).toLowerCase()))throw new ApiError(409,'Manufacturer part is linked to different specifications; use reviewed corrections.');
  if(existing.id)yield* addProduct(p,product,true);
  products.push(product);
  for(const phrase of item.phrases){const value=translationInput.parse({materialKey,phrase,sourceUrl:item.sourceUrl,origin:'ai_generated'});phrases.set(JSON.stringify([materialKey.toLowerCase(),phrase.toLowerCase().replace(/\s+/g,' ').trim()]),value);}
  summaries.push({manufacturer:product.manufacturer,partNumber:product.partNumber,description:built.description,materialKey,materialAction:existing.id?'Link existing material':'Create or share material',productAction:prior?'Keep existing manufacturer product':'Link manufacturer product'});
 }
 const phraseCheck=parseExtendedCsv(csv('translation',[...phrases.values()]));if(phraseCheck.errors.length)throw new ApiError(400,JSON.stringify(phraseCheck.errors));
 const previewHash=createHash('sha256').update(JSON.stringify({results:input.results,summaries})).digest('hex');
 if(!apply)return {previewHash,summaries,phrases:phrases.size,verification:'provisional'};
 if(input.approval!=='I reviewed these products and sources'||input.previewHash!==previewHash)throw new ApiError(409,'Preview changed or review confirmation missing. Preview again before adding.');
 // One repository transaction encloses all three audited, idempotent import batches.
 const batches=[];const canonical=new Map<string,any>();for(const material of materials.values()){const identity=describeMaterial(material).identity;if(!canonical.has(identity))canonical.set(identity,material);}
 for(const [kind,rows] of [['material',[...canonical.values()]],['product',products],['translation',[...phrases.values()]]] as const){const batch=yield* previewBulk(p,csv(kind,rows));if(batch.report.errors.length)throw new ApiError(409,JSON.stringify(batch.report.errors));const result=yield* applyBulk(p,batch.id,'I reviewed this batch');batches.push({kind,id:batch.id,...result});}
 return {batches,products:products.length,verification:'provisional'};
}
