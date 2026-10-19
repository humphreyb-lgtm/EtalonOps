import {ApiError,type Principal} from './contracts';
import type {Operation} from './catalog-v2';
export function* foremanRoster(p:Principal,project:string):Operation<any>{
 const membership=yield {text:'SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',values:[p.tenant,p.oid,project]};if(!membership.length)throw new ApiError(404,'Project not found.');
 const rows=yield {text:'SELECT u.oid,u.display_name FROM application_users u JOIN memberships m ON m.tenant=u.tenant AND m.owner=u.oid WHERE u.tenant=@p0 AND m.project=@p1 AND u.active=1 ORDER BY u.display_name,u.oid',values:[p.tenant,project]};return {selfId:p.oid,users:rows.map(row=>({id:String(row.oid).toLowerCase(),name:String(row.display_name)}))};
}
export function* resolveForeman(p:Principal,project:string,id:string):Operation<{id:string;name:string}>{
 id=id.toLowerCase();const users=yield {text:'SELECT u.oid,u.display_name,u.active,m.project FROM application_users u LEFT JOIN memberships m ON m.tenant=u.tenant AND m.owner=u.oid AND m.project=@p2 WHERE u.tenant=@p0 AND u.oid=@p1',values:[p.tenant,id,project]};const user=users[0];
 // Legacy callers default to themselves; live authenticated users are registered by admission.
 if(!user&&id===p.oid.toLowerCase())return {id,name:p.displayName??p.oid};
 if(!user||!user.active||!user.project)throw new ApiError(400,'Choose an active registered foreman assigned to this job.');return {id,name:String(user.display_name)};
}
