import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import {query,audit,type Operation} from './catalog-v2';
import {defaultDesign,designRoles,fontFaces} from '../src/global-design';
const style=z.object({font:z.enum(fontFaces),size:z.number().int().min(10).max(48),weight:z.union([z.literal(400),z.literal(500),z.literal(600),z.literal(700)]),color:z.string().regex(/^#[0-9a-f]{6}$/i),lineHeight:z.number().min(1).max(2),paddingX:z.number().int().min(0).max(32),paddingY:z.number().int().min(0).max(24)}).strict();
export const designSchema=z.object(Object.fromEntries(designRoles.map(r=>[r,style])) as Record<typeof designRoles[number],typeof style>).strict();
export function* designCommand(p:Principal,action:string,data:unknown):Operation<any>{
 const current=(yield* query('SELECT * FROM design_settings WHERE tenant=@p0',p.tenant))[0];
 if(action==='design-get')return {settings:current?designSchema.parse(JSON.parse(current.settings)):defaultDesign,version:current?.version??0};
 if(action!=='design-save')throw new ApiError(404,'Unknown design operation.');
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');
 const v=z.object({version:z.number().int().min(0),settings:designSchema}).strict().parse(data);if(v.version!==(current?.version??0))throw new ApiError(409,'Design settings changed elsewhere. Reload before saving.');
 if(current)yield* query('UPDATE design_settings SET settings=@p0,version=version+1,updated_by=@p1,updated_at=@p2 WHERE tenant=@p3',JSON.stringify(v.settings),p.oid,new Date().toISOString(),p.tenant);
 else yield* query('INSERT INTO design_settings(tenant,settings,version,updated_by,updated_at) VALUES(@p0,@p1,1,@p2,@p3)',p.tenant,JSON.stringify(v.settings),p.oid,new Date().toISOString());
 yield* audit(p,'design.updated',p.tenant);return {settings:v.settings,version:v.version+1};
}
