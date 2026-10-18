import {z} from 'zod';
import {createHash} from 'node:crypto';
import {type Operation,manufacturerIdentity,createMaterial,describeMaterial} from './catalog-v2';
import {type Principal} from './contracts';
import type {InboxItem} from './catalog-inbox';
const norm=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function* publicationPlan(p:Principal,id:string,version:number,items:InboxItem[],selected:string[],parse:(item:InboxItem)=>any):Operation<any>{
 const existing=yield {text:'SELECT id,external_key,active FROM materials WHERE tenant=@p0 ORDER BY id',values:[p.tenant]};
 const products=yield {text:'SELECT p.id,p.material_id,p.normalized_part,p.active,m.normalized FROM manufacturer_products p JOIN manufacturers m ON m.id=p.manufacturer_id AND m.tenant=p.tenant WHERE p.tenant=@p0 ORDER BY p.id',values:[p.tenant]};
 const byId=new Map(items.map(row=>[row.id,row])),parsed=new Map<string,any>(),failures=new Map<string,string>(),resolved=new Map<string,string>(),memo=new Map<string,Set<string>>();
 const message=(e:unknown)=>e instanceof z.ZodError?e.issues.slice(0,3).map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):e instanceof Error?e.message:'Invalid record.';
 function value(row:InboxItem){if(!parsed.has(row.id))parsed.set(row.id,parse(row));return parsed.get(row.id);}
 function* materialFor(key:string):Operation<{ids:Set<string>;target:string}>{
  const rows=items.filter(row=>row.kind==='material'&&row.state==='unpublished'&&norm(row.fields.externalKey??'')===norm(key));
  if(rows.length){const identities=rows.map(row=>describeMaterial(value(row)).identity);if(new Set(identities).size>1)throw Error(`Material key ${key} has conflicting specification rows.`);const ids=yield* visit(rows[0]);return {ids,target:resolved.get(rows[0].id)!};}
  const row=existing.find(row=>norm(row.external_key)===norm(key)&&row.active);if(!row)throw Error(`Required material ${key} is missing, deleted or needs review.`);return {ids:new Set(),target:String(row.id).toLowerCase()};
 }
 function* visit(row:InboxItem):Operation<Set<string>>{
  if(memo.has(row.id))return new Set(memo.get(row.id));if(failures.has(row.id))throw Error(failures.get(row.id));
  try{
   const v=value(row),ids=new Set<string>([row.id]);
   if(row.kind==='material'){const result=yield* createMaterial(p,v,true);const target=result.id?String(result.id).toLowerCase():'new:'+describeMaterial(v).identity;if(result.id&&!existing.some(m=>String(m.id).toLowerCase()===target&&m.active))throw Error('Matching material is retired; review it before publishing.');resolved.set(row.id,target);}
   else{
    const material=yield* materialFor(v.materialKey);for(const dep of material.ids)ids.add(dep);resolved.set(row.id,material.target);
    if(row.kind==='product'){
     const prior=products.find(product=>manufacturerIdentity(product.normalized)===manufacturerIdentity(v.manufacturer)&&product.normalized_part===norm(v.partNumber));if(prior&&(!prior.active||String(prior.material_id).toLowerCase()!==material.target))throw Error(`Manufacturer part ${v.manufacturer} ${v.partNumber} conflicts with a different or retired catalog product.`);
     const peers=items.filter(item=>item.kind==='product'&&item.state==='unpublished'&&manufacturerIdentity(item.fields.manufacturer??'')===manufacturerIdentity(v.manufacturer)&&norm(item.fields.partNumber??'')===norm(v.partNumber));
     for(const peer of peers){if(peer.id===row.id)continue;const linked=yield* materialFor(value(peer).materialKey);if(linked.target!==material.target)throw Error('One manufacturer part is assigned to different material specifications.');}
    }
    if(row.kind==='image'&&v.manufacturer){const prior=products.find(product=>manufacturerIdentity(product.normalized)===manufacturerIdentity(v.manufacturer)&&product.normalized_part===norm(v.partNumber)&&product.active&&String(product.material_id).toLowerCase()===material.target);if(!prior){const product=items.find(item=>item.kind==='product'&&item.state==='unpublished'&&manufacturerIdentity(item.fields.manufacturer??'')===manufacturerIdentity(v.manufacturer)&&norm(item.fields.partNumber??'')===norm(v.partNumber));if(!product)throw Error(`Required manufacturer product ${v.manufacturer} ${v.partNumber} is missing or deleted.`);const dep=yield* visit(product);if(resolved.get(product.id)!==material.target)throw Error('Image manufacturer product belongs to a different material.');for(const required of dep)ids.add(required);}}
   }
   memo.set(row.id,ids);return new Set(ids);
  }catch(e){const error=message(e);failures.set(row.id,error);throw Error(error);}
 }
 const ready=new Set<string>(),held:{id:string;sheet:string;row:number;reason:string}[]=[],selectedReady:string[]=[];
 for(const itemId of selected){const row=byId.get(itemId)!;try{const closure=yield* visit(row);selectedReady.push(itemId);for(const item of closure)ready.add(item);}catch(e){held.push({id:itemId,sheet:row.sheet,row:row.row,reason:message(e)});}}
 const readyIds=[...ready].sort(),dependencies=readyIds.filter(item=>!selected.includes(item));
 const signature=JSON.stringify({id,version,selected:[...selected].sort(),readyIds,held,resolved:[...resolved].sort(([a],[b])=>a.localeCompare(b))});
 return {planHash:createHash('sha256').update(signature).digest('hex'),readyIds,selectedReady: selectedReady.length,held,dependencies:dependencies.map(id=>{const row=byId.get(id)!;return {id,sheet:row.sheet,row:row.row,kind:row.kind,key:row.fields.externalKey??row.fields.materialKey};}),selectedCount:selected.length};
}
