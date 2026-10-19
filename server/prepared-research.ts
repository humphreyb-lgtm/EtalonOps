import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {ApiError,type Principal} from './contracts';
import {type Operation} from './catalog-v2';
import {inboxAction,type InboxItem} from './catalog-inbox';
import {materialColumns} from './catalog-spreadsheet';
import {publicSourceUrl} from './research-source';
import {separateResearchDetails} from '../src/research-attributes';
const text=z.string().max(8000),name=z.string().trim().min(1).max(500);
const url=z.string().max(2000).transform(value=>publicSourceUrl(value).href);
const ids=z.array(z.string().min(1).max(80)).max(50);
const detail=z.lazy(()=>z.union([z.string().max(8000),z.number().finite(),z.boolean(),z.null(),z.array(detail).max(100),z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,79}$/),detail)])) as z.ZodType<unknown>;
const evidence=z.object({sourceIds:ids,note:text}).strict();
export const preparedResearch=z.object({schemaVersion:z.literal('etalonops-research-v1'),request:z.string().trim().min(1).max(2000),coverageNotes:text,sources:z.array(z.object({id:z.string().min(1).max(80),url,title:name,publisher:name,sourceType:z.enum(['manufacturer','distributor','other'])}).strict()).max(100),items:z.array(z.object({reviewStatus:z.enum(['needs_review','ready_for_admin_review']),material:z.object({description:name,category:z.enum(['conduit','bracket','box','general']),productUnit:z.enum(['EA','FT','STICK','BOX','ROLL','PAIR']).nullable(),unitBasis:text.nullable(),attributes:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),z.union([z.string().max(2000),z.number().finite(),z.null()])),attributeEvidence:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),evidence),verificationBasis:text,sourceIds:ids}).strict(),manufacturer:z.object({name:name.max(200),officialWebsite:url.nullable(),parentCompany:name.nullable(),sourceIds:ids}).strict(),product:z.object({partNumber:name.max(200),title:name,productPageUrl:url.nullable(),details:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),detail),sourceIds:ids}).strict(),translations:z.array(name).max(100),images:z.array(z.object({url,sourcePageUrl:url,imageType:z.enum(['product','representative']),caption:text,sourceIds:ids}).strict()).max(10),missingInformation:z.array(text).max(100),warnings:z.array(text).max(100)}).strict()).max(25)}).strict();
// Compact external research contract; the original response remains downloadable.
const compact=z.object({schemaVersion:z.literal('etalonops-catalog-v1'),items:z.array(z.object({manufacturer:name,partNumber:name,description:name,category:z.enum(['conduit','bracket','box','general']),unit:z.enum(['EA','FT','STICK','BOX','ROLL','PAIR']).nullable().optional(),attributes:z.record(z.string(),z.union([z.string(),z.number().finite()])),productUrl:url,imageUrl:url.nullable().optional(),translations:z.array(name).max(100),sources:z.array(url).max(20).optional(),notes:z.string().max(2000).optional()}).strict()).min(1).max(25)}).strict();
function expandCompact(raw:unknown){
 if((raw as any)?.schemaVersion!=='etalonops-catalog-v1')return raw;
 const data=compact.parse(raw);const sources=data.items.flatMap((item,index)=>[item.productUrl,...item.sources??[]].map((link,n)=>({id:`S${index}-${n}`,url:link,title:item.description,publisher:item.manufacturer,sourceType:'other'})));
 return {schemaVersion:'etalonops-research-v1',request:'Externally prepared catalog products',coverageNotes:'',sources,items:data.items.map((item,index)=>({reviewStatus:'needs_review',material:{description:item.description,category:item.category,productUnit:item.unit??null,unitBasis:null,attributes:item.attributes,attributeEvidence:{},verificationBasis:'External research; administrator review required.',sourceIds:[`S${index}-0`]},manufacturer:{name:item.manufacturer,officialWebsite:null,parentCompany:null,sourceIds:[`S${index}-0`]},product:{partNumber:item.partNumber,title:item.description,productPageUrl:item.productUrl,details:{},sourceIds:[`S${index}-0`]},translations:item.translations,images:item.imageUrl?[{url:item.imageUrl,sourcePageUrl:item.productUrl,imageType:'representative',caption:'External product image for administrator review.',sourceIds:[`S${index}-0`]}]:[],missingInformation:[],warnings:item.notes?[item.notes]:[]}))};
}
export function parsePreparedResearch(json:string){
 if(Buffer.byteLength(json)>300000)throw new ApiError(413,'Paste research JSON smaller than 300 KB.');
 let raw:unknown;try{raw=JSON.parse(json.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new ApiError(400,'Paste a complete JSON object. Your pasted text has been retained.');}
 let nodes=0;function bounded(value:unknown,depth=0){if(++nodes>50000||depth>12)throw new ApiError(400,'Research JSON is nested too deeply or contains too many values.');if(value&&typeof value==='object')for(const nested of Object.values(value))bounded(nested,depth+1);}bounded(raw);
 const input=preparedResearch.parse(expandCompact(raw));if(!input.items.length)throw new ApiError(400,'The research contains no products to import. Your text has been retained.');
 const sources=new Map(input.sources.map(source=>[source.id,source]));if(sources.size!==input.sources.length)throw new ApiError(400,'Source identifiers must be unique.');
 function checkIds(values:string[]){for(const id of values)if(!sources.has(id))throw new ApiError(400,'Unknown source reference: '+id);}
 const items:InboxItem[]=[],notices:string[]=[];const materials=new Set<string>(),products=new Set<string>(),phrases=new Set<string>();
 const append=(kind:InboxItem['kind'],fields:Record<string,string>)=>items.push({id:randomUUID(),kind,sheet:'ChatGPT '+kind,row:items.length+2,fields:{kind,...fields},state:'unpublished'});
 for(const [index,item] of input.items.entries()){
  if(!item.material.productUnit&&(item.material.category==='bracket'||item.material.category==='box'||/\b(fitting|hardware|bracket|hanger|support|screw|nut|washer)\b/i.test(String(item.material.attributes.type??''))))item.material.productUnit='EA';
  for(const values of [item.material.sourceIds,item.manufacturer.sourceIds,item.product.sourceIds,...Object.values(item.material.attributeEvidence).map(value=>value.sourceIds),...item.images.map(image=>image.sourceIds)])checkIds(values);
  const sourceUrl=item.product.productPageUrl??sources.get(item.product.sourceIds[0]??item.material.sourceIds[0])?.url;
  if(!sourceUrl)throw new ApiError(400,'Product '+(index+1)+' needs an evidence URL or a valid source reference.');
  const attributes=Object.fromEntries(Object.entries(item.material.attributes).filter(([,value])=>value!==null)) as Record<string,string|number>;
  const separated=separateResearchDetails({externalKey:'pending',category:item.material.category,productUnit:item.material.productUnit??'EA',attributes,manufacturer:item.manufacturer.name,partNumber:item.product.partNumber,title:item.product.title,sourceUrl,verificationBasis:item.material.verificationBasis||'External research; source evidence needs administrator review.',phrases:item.translations,productDetails:{}});
  // This is a pending reference, never a substitute for canonical identity matching at publication.
  const signature=JSON.stringify({category:item.material.category,unit:item.material.productUnit,attributes:separated.attributes});const materialKey='RESEARCH-'+createHash('sha256').update(signature).digest('hex').slice(0,24);
  if(!materials.has(materialKey)){const fields:Record<string,string>={externalKey:materialKey,category:item.material.category,productUnit:item.material.productUnit??'',sourceUrl,verification:'provisional',origin:'ai_import',verificationBasis:item.material.verificationBasis.slice(0,2000)||'External research; source evidence needs administrator review.'};
   for(const [field,value] of Object.entries(separated.attributes))fields[(materialColumns as readonly string[]).includes(field)?field:'attribute.'+field]=String(value);append('material',fields);materials.add(materialKey);}
  const details:Record<string,string|number>={...separated.productDetails};for(const [field,value] of Object.entries(item.product.details)){if(value===null)continue;details[field]=typeof value==='string'||typeof value==='number'?value:JSON.stringify(value);}
  if(item.manufacturer.officialWebsite)details.manufacturerWebsite=item.manufacturer.officialWebsite;if(item.manufacturer.parentCompany)details.manufacturerParentCompany=item.manufacturer.parentCompany;
  if(item.material.unitBasis)details.orderingUnitBasis=item.material.unitBasis;
  const partKey=JSON.stringify([item.manufacturer.name.toLowerCase().trim(),item.product.partNumber.toLowerCase().trim()]);if(products.has(partKey))throw new ApiError(400,'A manufacturer part appears more than once. Keep one researched record per part.');products.add(partKey);
  append('product',{materialKey,manufacturer:item.manufacturer.name,partNumber:item.product.partNumber,title:item.product.title,sourceUrl,verification:'provisional',origin:'ai_import',details:JSON.stringify(details)});
  for(const phrase of [...item.translations,item.product.partNumber,item.manufacturer.name+' '+item.product.partNumber]){const key=materialKey+'/'+phrase.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');if(phrases.has(key))continue;phrases.add(key);append('translation',{materialKey,phrase,sourceUrl,origin:'ai_generated'});}
  for(const image of item.images)append('image',{materialKey,manufacturer:item.manufacturer.name,partNumber:item.product.partNumber,sourceUrl:image.url,rightsBasis:('Owner-managed image use; externally researched '+image.imageType+' image. Evidence: '+image.sourcePageUrl+'; '+image.caption).slice(0,2000)});
  if(!item.material.productUnit)notices.push(item.product.partNumber+': choose the catalog ordering unit before publication.');if(!item.images.length)notices.push(item.product.partNumber+': no image supplied; add one separately if needed.');
  // Verbose source caveats stay in the original research rather than flooding review.
  for(const note of [...item.missingInformation,...item.warnings])if(/conflict|contradict|mismatch/i.test(note))notices.push(item.product.partNumber+': '+note);
 }
 if(items.length>2000)throw new ApiError(413,'This research creates too many review rows. Import fewer products.');
 return {input,items,notices,originalJson:JSON.stringify(raw),summary:{products:input.items.length,materials:materials.size,translations:items.filter(item=>item.kind==='translation').length,images:items.filter(item=>item.kind==='image').length,missingUnits:input.items.filter(item=>!item.material.productUnit).length,notices}};
}
export function* preparedResearchAction(p:Principal,data:unknown,stage=false):Operation<any>{
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');const {json}=z.object({json:z.string().max(300000)}).strict().parse(data);const parsed=parsePreparedResearch(json);
 if(!stage)return parsed.summary;
 const batch=yield* inboxAction(p,'inbox-stage',{filename:'ChatGPT research — '+parsed.input.request.slice(0,160),research:{scope:parsed.input.request,coverageNotes:(parsed.input.coverageNotes+'\n'+parsed.notices.join('\n')).slice(0,4000),searchPhrase:'',originalJson:parsed.originalJson},items:parsed.items});return {...batch,preparedSummary:parsed.summary};
}
