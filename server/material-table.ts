import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import {catalogPage,materialDetails,materialInput,createMaterial,correctCatalog,describeMaterial,type Operation} from './catalog-v2';
const withHash=(record:any)=>({...record,editHash:createHash('sha256').update(JSON.stringify([record.externalKey,record.description,record.productUnit,record.attributes,record.sourceUrl,record.verificationBasis,record.active,record.verification])).digest('hex')});
export function* materialTable(p:Principal,action:string,data:unknown):Operation<any>{
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');
 if(action==='material-table-row'){const {id}=z.object({id:z.uuid()}).strict().parse(data);return withHash(yield* materialDetails(p,id));}
 if(action==='material-table-page'){const input=z.object({text:z.string().max(200).default(''),page:z.number().int().positive().default(1)}).strict().parse(data);const page=yield* catalogPage(p,{...input,section:'materials',pageSize:25});const records=[];for(const row of page.records)records.push(withHash(yield* materialDetails(p,String(row.id).toLowerCase())));return {...page,records};}
 const editable=z.object({category:materialInput.shape.category,attributes:materialInput.shape.attributes,productUnit:materialInput.shape.productUnit,sourceUrl:materialInput.shape.sourceUrl,verificationBasis:materialInput.shape.verificationBasis}).strict();
 const input=z.object({id:z.uuid().optional(),editHash:z.string().optional(),material:editable,reason:z.string().trim().min(10).max(2000),expectedHash:z.string().optional(),approval:z.string().optional()}).strict().parse(data);
 const material={...input.material,externalKey:'pending',origin:'admin_reviewed' as const,verification:'provisional' as const};const built=describeMaterial(material);material.externalKey='MAT-'+built.identity.slice(0,32);
 if(input.id){const current=yield* materialDetails(p,input.id);if(input.editHash!==withHash(current).editHash)throw new ApiError(409,'This material changed after you opened it. Discard this row and refresh materials before editing again.');if(current.attributes.category){const attributes=Object.fromEntries(Object.entries(current.attributes).filter(([key])=>!['category','recordOrigin'].includes(key))) as Record<string,string|number>;const original=describeMaterial({...material,externalKey:current.externalKey,category:current.attributes.category,productUnit:current.productUnit,attributes});if(original.identity===built.identity)material.externalKey=current.externalKey;}
  const correction={id:input.id,material,reason:input.reason};const preview=yield* correctCatalog(p,'material',correction);if(action==='material-table-preview')return preview;if(input.approval!=='Save this material')throw new ApiError(400,'Review the material before saving.');return yield* correctCatalog(p,'material',{...correction,expectedHash:input.expectedHash,approval:'I reviewed the correction and historical impact'},true);
 }
 const prior=yield* createMaterial(p,material,true);if(prior.id){const target=yield* materialDetails(p,prior.id);if(!target.active)throw new ApiError(409,'This material already exists as a retired record. Review it in Catalog and imports.');}
 const previewHash=createHash('sha256').update(JSON.stringify({material,prior,reason:input.reason})).digest('hex');if(action==='material-table-preview')return {mode:prior.id?'existing':'new',previewHash,description:built.description,existingId:prior.id??null,impact:{savedLines:0,products:0,images:0,activeRules:0}};
 if(input.approval!=='Save this material'||input.expectedHash!==previewHash)throw new ApiError(409,'Material review changed. Review again before saving.');return yield* createMaterial(p,material);
}
