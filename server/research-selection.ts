import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import {researchCandidate} from '../src/catalog-research';
import {type Operation,selectDiscovery,addTranslation,addImageReference,searchCatalog,productForMaterial} from './catalog-v2';
export function* selectResearchedProduct(p:Principal,data:unknown):Operation<any>{
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required during the AI pilot.');
 const input=z.object({eventId:z.uuid(),projectId:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),phrase:z.string().trim().min(1).max(500),item:researchCandidate.extend({imageUrl:z.url().optional()})}).strict().parse(data),item=input.item;
 const selected=yield* selectDiscovery(p,{eventId:input.eventId,projectId:input.projectId,phrase:input.phrase,material:{externalKey:item.externalKey,category:item.category,attributes:item.attributes,productUnit:item.productUnit,sourceUrl:item.sourceUrl,verificationBasis:item.verificationBasis,verification:'provisional',origin:'ai_discovery'},product:{manufacturer:item.manufacturer,partNumber:item.partNumber,title:item.title,...(item.productDetails?{details:item.productDetails}:{}),sourceUrl:item.sourceUrl,verification:'provisional',origin:'ai_discovery'},additionalPhrases:[]});
 let materialId=selected.materialId,productId=selected.productId;
 if(selected.unchanged){const prior=(yield {text:'SELECT material_id,product_id FROM selection_events WHERE id=@p0 AND tenant=@p1 AND actor=@p2',values:[input.eventId,p.tenant,p.oid]})[0];materialId=String(prior.material_id).toLowerCase();productId=String(prior.product_id).toLowerCase();}
 const product=yield* productForMaterial(p,materialId,productId);
 const materialKey=(yield {text:'SELECT external_key FROM materials WHERE id=@p0 AND tenant=@p1',values:[materialId,p.tenant]})[0].external_key;
 // Preserve existing provisional phrase handling; additional phrases are potential matches, never verification.
 for(const phrase of [...new Set(item.phrases)])yield* addTranslation(p,{materialKey,phrase,sourceUrl:item.sourceUrl,origin:'ai_generated'});
 if(item.imageUrl){const image=yield* addImageReference(p,{materialKey,manufacturer:product.manufacturer,partNumber:product.part_number,sourceUrl:item.imageUrl,rightsBasis:'Owner-managed image usage for selected AI-researched product; source page: '+item.sourceUrl});yield {text:"UPDATE image_references SET status='approved' WHERE id=@p0 AND tenant=@p1 AND status='pending'",values:[image.id,p.tenant]};}
 const matches=yield* searchCatalog(p,item.partNumber,input.projectId);const candidate=matches.find((match:any)=>match.id===materialId&&match.products.some((product:any)=>product.id===productId));
 if(!candidate)throw new ApiError(409,'This product is unavailable under the current job requirements. No catalog additions from this selection were kept.');
 return {candidate,productId,provisional:true};
}
