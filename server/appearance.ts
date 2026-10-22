import {appearanceComponents} from '../src/appearance-components';
import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import {query,audit,type Operation} from './catalog-v2';
import {elements,properties,dimensionProperties,validProperty,reorderable,emptyAppearance} from '../src/appearance';
const shape=Object.fromEntries(Object.entries(properties).map(([key,value])=>[key,(dimensionProperties.has(key)?z.union([z.number(),z.string()]).refine(v=>validProperty(key,v),'Use a valid dimension, such as 24, 100%, 2rem or auto'):Array.isArray(value)?z.enum(value as unknown as [string,...string[]]):value==='color'?z.string().regex(/^#[0-9a-f]{6}$/i):z.number().min(key.startsWith('translate')?-(value as number):key==='lineHeight'?1:0).max(value as number)).optional()]));
const props=z.object(shape).strict();
const ids=elements.map(e=>e[0]) as [string,...string[]];
export const appearanceSchema=z.object({rules:z.record(z.string().refine(id=>ids.includes(id)||(id.startsWith('component:')&&appearanceComponents.includes(id.slice(10) as typeof appearanceComponents[number]))||/^(?:control|container):[a-zA-Z0-9_-]{1,100}:[a-zA-Z0-9_-]{1,100}$/.test(id)||/^(?:field|wrapper):[a-zA-Z][a-zA-Z0-9_-]{0,100}$/.test(id),'Unknown component'),z.object({desktop:props.optional(),tablet:props.optional(),mobile:props.optional()}).strict()),order:z.array(z.enum(reorderable)).max(reorderable.length).refine(v=>new Set(v).size===v.length,'Repeated section')}).strict();
export function* appearanceCommand(p:Principal,action:string,data:unknown):Operation<any>{
 const row=(yield* query('SELECT * FROM appearance_settings WHERE tenant=@p0',p.tenant))[0];
 const state=row?JSON.parse(row.settings):{draft:emptyAppearance(),published:emptyAppearance(),history:[]};
 if(action==='appearance-public')return {published:state.published};
 if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');
 if(action==='appearance-get')return {...state,version:row?.version??0};
 const v=z.object({version:z.number().int().min(0),settings:appearanceSchema}).strict().parse(data);
 if(!['appearance-save','appearance-publish','appearance-restore'].includes(action))throw new ApiError(404,'Unknown appearance operation.');
 if(v.version!==(row?.version??0))throw new ApiError(409,'Appearance changed elsewhere. Reload before saving.');
 state.draft=v.settings;
 if(action!=='appearance-save'){state.history=[{at:new Date().toISOString(),settings:state.published},...state.history].slice(0,10);state.published=v.settings;}
 if(row)yield* query('UPDATE appearance_settings SET settings=@p0,version=version+1 WHERE tenant=@p1',JSON.stringify(state),p.tenant);
 else yield* query('INSERT INTO appearance_settings(tenant,settings,version) VALUES(@p0,@p1,1)',p.tenant,JSON.stringify(state));
 yield* audit(p,action,p.tenant);return {...state,version:v.version+1};
}
