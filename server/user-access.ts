import {foremanRoster} from './mrf-foreman';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError,type Principal } from './contracts';
import type { Operation,RecordRow } from './catalog-v2';
function* q(text:string,...values:unknown[]):Operation<RecordRow[]>{return yield {text,values};}
const oid=z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/).transform(value=>value.toLowerCase());
const project=z.enum(['riverside','northside']);
const input=z.object({oid,displayName:z.string().trim().min(1).max(200),active:z.boolean(),roleLimit:z.enum(['Admin','Foreman']).nullable(),projects:z.array(project).max(2).refine(a=>new Set(a).size===a.length),version:z.number().int().nonnegative(),reason:z.string().trim().min(10).max(2000)}).strict();
function* row(p:Principal,id:string):Operation<RecordRow|undefined>{return (yield* q('SELECT * FROM application_users WHERE tenant=@p0 AND oid=@p1',p.tenant,id))[0];}
function* projects(p:Principal,id:string):Operation<string[]>{return (yield* q('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 ORDER BY project',p.tenant,id)).map(r=>String(r.project));}
function view(r:RecordRow,assigned:string[]){return {oid:r.oid,displayName:r.display_name,active:Boolean(r.active),roleLimit:r.role_limit,entraAdmin:Boolean(r.entra_admin),version:Number(r.version),createdAt:r.created_at,seenAt:r.seen_at,projects:assigned};}
function admin(p:Principal){if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');}
export function* admitUser(p:Principal,localBootstrap=false):Operation<Principal>{
 p={...p,oid:p.oid.toLowerCase()};
 let user=yield* row(p,p.oid);const now=new Date().toISOString(),isAdmin=p.roles.includes('Admin');
 if(!user){
  yield* q('INSERT INTO application_users(tenant,oid,display_name,active,role_limit,entra_admin,version,created_at,seen_at) VALUES(@p0,@p1,@p2,1,NULL,@p3,1,@p4,@p4)',p.tenant,p.oid,p.displayName??p.oid,Number(isAdmin),now);
  if(localBootstrap)for(const id of ['riverside','northside'])if(!(yield* q('SELECT project FROM memberships WHERE tenant=@p0 AND owner=@p1 AND project=@p2',p.tenant,p.oid,id)).length)yield* q('INSERT INTO memberships(tenant,owner,project) VALUES(@p0,@p1,@p2)',p.tenant,p.oid,id);
  user=(yield* row(p,p.oid))!;
 }
 if(!user.active)throw new ApiError(403,'Your EtalonOps access is deactivated. Contact an administrator.');
 if(Boolean(user.entra_admin)!==isAdmin||!user.seen_at||String(user.seen_at)<new Date(Date.now()-15*60*1000).toISOString())yield* q('UPDATE application_users SET entra_admin=@p0,seen_at=@p1 WHERE tenant=@p2 AND oid=@p3',Number(isAdmin),now,p.tenant,p.oid);
 const roles=user.role_limit==='Foreman'?['Foreman']:p.roles;
 if(user.role_limit==='Admin'&&!isAdmin)throw new ApiError(403,'Microsoft administrator assignment is required for this account.');
 return {...p,roles};
}
export function* userAccess(p:Principal,action:string,data:unknown):Operation<any>{
 if(action==='foremen'){const {projectId}=z.object({projectId:z.enum(['riverside','northside'])}).strict().parse(data);return yield* foremanRoster(p,projectId);}
 admin(p);
 if(action==='list'){
  const v=z.object({page:z.number().int().min(1).max(100000).default(1),text:z.string().trim().max(200).default('')}).strict().parse(data);
  const pattern='%'+v.text.toLowerCase().replace(/[!%_]/g,c=>'!'+c)+'%';const where="tenant=@p0 AND (LOWER(display_name) LIKE @p1 ESCAPE '!' OR LOWER(oid) LIKE @p1 ESCAPE '!')";
  const total=Number((yield* q(`SELECT COUNT(*) AS total FROM application_users WHERE ${where}`,p.tenant,pattern))[0].total),pages=Math.max(1,Math.ceil(total/25)),page=Math.min(v.page,pages);
  const rows=yield* q(`SELECT * FROM (SELECT *,ROW_NUMBER() OVER(ORDER BY display_name,oid) AS n FROM application_users WHERE ${where}) u WHERE n>@p2 AND n<=@p3 ORDER BY n`,p.tenant,pattern,(page-1)*25,page*25);
  const assignments=rows.length?yield* q('SELECT owner,project FROM memberships WHERE tenant=@p0 AND owner IN ('+rows.map((_,i)=>'@p'+(i+1)).join(',')+') ORDER BY owner,project',p.tenant,...rows.map(r=>r.oid)):[];
  const records=rows.map(r=>view(r,assignments.filter(a=>String(a.owner).toLowerCase()===String(r.oid).toLowerCase()).map(a=>String(a.project))));return {records,total,page,pages};
 }
 if(action==='detail'||action==='history'){
  const v=z.object({oid,page:z.number().int().min(1).max(100000).default(1)}).strict().parse(data);const user=yield* row(p,v.oid);if(!user)throw new ApiError(404,'User not found.');
  if(action==='detail')return view(user,yield* projects(p,v.oid));
  const total=Number((yield* q('SELECT COUNT(*) AS total FROM user_access_changes WHERE tenant=@p0 AND oid=@p1',p.tenant,v.oid))[0].total),pages=Math.max(1,Math.ceil(total/25)),page=Math.min(v.page,pages);
  const records=yield* q('SELECT * FROM (SELECT *,ROW_NUMBER() OVER(ORDER BY created_at DESC,id) AS n FROM user_access_changes WHERE tenant=@p0 AND oid=@p1) h WHERE n>@p2 AND n<=@p3 ORDER BY n',p.tenant,v.oid,(page-1)*25,page*25);
  return {records:records.map(({n,before_json,after_json,...r})=>({...r,before:JSON.parse(before_json)?.registered===false?null:JSON.parse(before_json),after:JSON.parse(after_json)})),total,page,pages};
 }
 if(action!=='save')throw new ApiError(404,'User operation not found.');
 const v=input.parse(data),prior=yield* row(p,v.oid);if((prior&&Number(prior.version)!==v.version)||(!prior&&v.version!==0))throw new ApiError(409,'User access changed elsewhere. Reload the user before saving.');
 if(v.roleLimit==='Admin'&&!prior?.entra_admin)throw new ApiError(400,'Assign the Admin application role in Microsoft first, then have the user sign in. This screen cannot grant Microsoft roles.');
 if(v.oid===p.oid.toLowerCase()&&(!v.active||v.roleLimit==='Foreman'))throw new ApiError(409,'You cannot deactivate or demote your own administrator access.');
 const removesAdmin=prior?.active&&prior.entra_admin&&prior.role_limit!=='Foreman'&&(!v.active||v.roleLimit==='Foreman');
 if(removesAdmin&&Number((yield* q("SELECT COUNT(*) AS total FROM application_users WHERE tenant=@p0 AND active=1 AND entra_admin=1 AND (role_limit IS NULL OR role_limit='Admin')",p.tenant))[0].total)<=1)throw new ApiError(409,'Keep at least one active administrator.');
 const before=prior?view(prior,yield* projects(p,v.oid)):null,now=new Date().toISOString();
 if(prior)yield* q('UPDATE application_users SET display_name=@p0,active=@p1,role_limit=@p2,version=version+1 WHERE tenant=@p3 AND oid=@p4',v.displayName,Number(v.active),v.roleLimit,p.tenant,v.oid);
 else yield* q('INSERT INTO application_users(tenant,oid,display_name,active,role_limit,entra_admin,version,created_at) VALUES(@p0,@p1,@p2,@p3,@p4,0,1,@p5)',p.tenant,v.oid,v.displayName,Number(v.active),v.roleLimit,now);
 yield* q('DELETE FROM memberships WHERE tenant=@p0 AND owner=@p1',p.tenant,v.oid);
 for(const id of v.projects)yield* q('INSERT INTO memberships(tenant,owner,project) VALUES(@p0,@p1,@p2)',p.tenant,v.oid,id);
 const after=view((yield* row(p,v.oid))!,v.projects);
 yield* q('INSERT INTO user_access_changes(id,tenant,oid,before_json,after_json,reason,actor,created_at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)',randomUUID(),p.tenant,v.oid,JSON.stringify(before??{registered:false}),JSON.stringify(after),v.reason,p.oid,now);
 return after;
}
