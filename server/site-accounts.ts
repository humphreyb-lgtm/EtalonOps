import {createHash,randomBytes,randomUUID,scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import {manager} from './workforce';
import type {Operation,RecordRow} from './catalog-v2';
let activeHashes=0;const hashQueue:(()=>void)[]=[];
const scrypt=(password:string,salt:string,length:number,_options:unknown)=>new Promise<Buffer>((resolve,reject)=>{
 const begin=()=>{activeHashes++;rawScrypt(password,salt,length,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>{activeHashes--;hashQueue.shift()?.();if(error)reject(error);else resolve(key);});};
 if(activeHashes<2)begin();else if(hashQueue.length<8)hashQueue.push(begin);else reject(new ApiError(429,'Sign-in is busy. Wait a moment and try again.'));
}),now=()=>new Date().toISOString();
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const secretToken=()=>randomBytes(32).toString('base64url');
export const passwordSchema=z.string().min(12,'Use at least 12 characters.').max(128,'Use no more than 128 characters.').refine(p=>!['passwordpassword','123456789012','abcdefghijkl'].includes(p.toLowerCase()),'Choose a less common password.');
export async function hashPassword(password:string){passwordSchema.parse(password);const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}) as Buffer;return `scrypt$32768$${salt}$${key.toString('hex')}`;}
export async function checkPassword(password:string,stored:string|null){const parts=stored?.split('$'),valid=parts?.length===4&&parts[0]==='scrypt'&&parts[1]==='32768'&&/^[0-9a-f]{32}$/.test(parts[2])&&/^[0-9a-f]{128}$/.test(parts[3]);const salt=valid?parts![2]:'00000000000000000000000000000000',expected=valid?Buffer.from(parts![3],'hex'):Buffer.alloc(64);const actual=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}) as Buffer;return timingSafeEqual(actual,expected)&&Boolean(valid);}
function* q(text:string,...values:unknown[]):Operation<RecordRow[]>{return yield {text,values};}
function* record(p:Principal,target:string,action:string):Operation<void>{yield* q('INSERT INTO user_access_changes(id,tenant,oid,before_json,after_json,reason,actor,created_at) VALUES(@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)',randomUUID(),p.tenant,target,'{}',JSON.stringify({action}),action,p.oid,now());}
export function* accountAction(tenant:string,action:string,data:any,p?:Principal):Operation<any>{
 if(action==='credential')return (yield* q('SELECT c.*,u.active FROM site_credentials c JOIN application_users u ON u.tenant=c.tenant AND u.oid=c.oid WHERE c.tenant=@p0 AND c.email=@p1',tenant,data.email))[0]??null;
 if(action==='attempt'){
  yield* q('DELETE FROM account_limits WHERE tenant=@p0 AND expires_at<=@p1',tenant,now());
  const current=(yield* q('SELECT * FROM account_limits WHERE tenant=@p0 AND email=@p1',tenant,data.email))[0];if(current&&String(current.expires_at)>now()&&Number(current.attempts)>=15)throw new ApiError(429,'Too many attempts. Wait 15 minutes before trying again.');
  if(current&&String(current.expires_at)>now())yield* q('UPDATE account_limits SET attempts=attempts+1 WHERE tenant=@p0 AND email=@p1',tenant,data.email);else{yield* q('DELETE FROM account_limits WHERE tenant=@p0 AND email=@p1',tenant,data.email);yield* q('INSERT INTO account_limits(tenant,email,attempts,expires_at) VALUES(@p0,@p1,1,@p2)',tenant,data.email,new Date(Date.now()+15*60*1000).toISOString());}return {ok:true};
 }
 if(action==='session-create'){
  const row=(yield* q('SELECT c.*,u.active FROM site_credentials c JOIN application_users u ON u.tenant=c.tenant AND u.oid=c.oid WHERE c.tenant=@p0 AND c.oid=@p1',tenant,data.oid))[0];if(!row?.active||row.password_hash!==data.expectedHash)throw new ApiError(401,'Email or password is incorrect.');
  yield* q('DELETE FROM account_limits WHERE tenant=@p0 AND email=@p1',tenant,row.email);yield* q('DELETE FROM account_sessions WHERE tenant=@p0 AND (expires_at<@p1 OR oid=@p2)',tenant,now(),row.oid);yield* q('INSERT INTO account_sessions(tenant,token_hash,oid,credential_version,expires_at) VALUES(@p0,@p1,@p2,@p3,@p4)',tenant,data.hash,row.oid,row.version,new Date(Date.now()+8*60*60*1000).toISOString());return {ok:true};
 }
 if(action==='session'){
  const r=(yield* q('SELECT s.oid,u.display_name FROM account_sessions s JOIN site_credentials c ON c.tenant=s.tenant AND c.oid=s.oid AND c.version=s.credential_version JOIN application_users u ON u.tenant=s.tenant AND u.oid=s.oid WHERE s.tenant=@p0 AND s.token_hash=@p1 AND s.expires_at>@p2 AND u.active=1',tenant,data.hash,now()))[0];if(!r)throw new ApiError(401,'Sign in to continue.');return {tenant,oid:String(r.oid),roles:['Foreman'],displayName:String(r.display_name)};
 }
 if(action==='logout'){yield* q('DELETE FROM account_sessions WHERE tenant=@p0 AND token_hash=@p1',tenant,data.hash);return {ok:true};}
 if(action==='issue-link'){
  if(!p)throw new ApiError(403,'Administrator required.');const m=yield* manager(p),v=z.object({oid:z.string().min(1).max(64),kind:z.enum(['invite','reset']),email:z.email().max(254).optional(),hash:z.string().length(64)}).strict().parse(data);const user=(yield* q('SELECT u.*,p.company_id FROM application_users u LEFT JOIN user_profiles p ON p.tenant=u.tenant AND p.oid=u.oid WHERE u.tenant=@p0 AND u.oid=@p1',tenant,v.oid))[0];
  if(!user||(!m.root&&(user.company_id??'main')!==m.company))throw new ApiError(404,'User not found.');if(!user.active)throw new ApiError(400,'Activate the user before issuing a link.');if(user.entra_admin)throw new ApiError(400,'Microsoft administrators must use Microsoft account recovery.');
  const credential=(yield* q('SELECT * FROM site_credentials WHERE tenant=@p0 AND oid=@p1',tenant,v.oid))[0];if(!credential){if(v.kind!=='invite'||!v.email)throw new ApiError(400,'Invite this user with an email address first.');const email=v.email.toLowerCase();if((yield* q('SELECT oid FROM site_credentials WHERE tenant=@p0 AND email=@p1',tenant,email)).length)throw new ApiError(409,'This email already has a site account.');yield* q('INSERT INTO site_credentials(tenant,oid,email,password_hash,version) VALUES(@p0,@p1,@p2,NULL,1)',tenant,v.oid,email);}else if(v.kind==='invite'&&credential.password_hash)throw new ApiError(409,'Account is already registered; use password reset.');
  yield* q('DELETE FROM account_tokens WHERE tenant=@p0 AND oid=@p1',tenant,v.oid);yield* q('INSERT INTO account_tokens(tenant,token_hash,oid,kind,expires_at) VALUES(@p0,@p1,@p2,@p3,@p4)',tenant,v.hash,v.oid,v.kind,new Date(Date.now()+(v.kind==='invite'?72*60:30)*60*1000).toISOString());yield* record(p,v.oid,v.kind==='invite'?'Site invitation issued':'Password reset link issued');return {email:String(credential?.email??v.email).toLowerCase()};
 }
 if(action==='revoke-invitation'){
  if(!p)throw new ApiError(403,'Administrator required.');const m=yield* manager(p),u=(yield* q('SELECT company_id FROM user_profiles WHERE tenant=@p0 AND oid=@p1',tenant,data.oid))[0];if(!u||(!m.root&&u.company_id!==m.company))throw new ApiError(404,'User not found.');yield* q('DELETE FROM account_tokens WHERE tenant=@p0 AND oid=@p1',tenant,data.oid);yield* record(p,data.oid,'Outstanding invitation and reset links revoked');return {ok:true};
 }
 if(action==='token-info'||action==='password-set'){
  const r=(yield* q('SELECT t.*,u.display_name,u.active,c.email FROM account_tokens t JOIN application_users u ON u.tenant=t.tenant AND u.oid=t.oid JOIN site_credentials c ON c.tenant=t.tenant AND c.oid=t.oid WHERE t.tenant=@p0 AND t.token_hash=@p1 AND t.expires_at>@p2',tenant,data.hash,now()))[0];if(!r?.active||!['invite','reset'].includes(r.kind))throw new ApiError(400,'This link has expired or was already used. Request a new link.');
  if(action==='token-info')return {name:r.display_name,email:r.email,kind:r.kind};
  yield* q('UPDATE site_credentials SET password_hash=@p0,version=version+1 WHERE tenant=@p1 AND oid=@p2',data.passwordHash,tenant,r.oid);yield* q('DELETE FROM account_tokens WHERE tenant=@p0 AND oid=@p1',tenant,r.oid);yield* q('DELETE FROM account_sessions WHERE tenant=@p0 AND oid=@p1',tenant,r.oid);yield* q('DELETE FROM account_limits WHERE tenant=@p0 AND email=@p1',tenant,r.email);yield* record({tenant,oid:r.oid,roles:['Foreman']},r.oid,r.kind==='invite'?'Site account registered':'Password reset completed');return {ok:true};
 }
 if(action==='self-reset'){
  const c=(yield* q('SELECT c.oid FROM site_credentials c JOIN application_users u ON u.tenant=c.tenant AND u.oid=c.oid WHERE c.tenant=@p0 AND c.email=@p1 AND u.active=1 AND c.password_hash IS NOT NULL',tenant,data.email))[0];if(!c)return {found:false};yield* q('DELETE FROM account_tokens WHERE tenant=@p0 AND oid=@p1',tenant,c.oid);yield* q('INSERT INTO account_tokens(tenant,token_hash,oid,kind,expires_at) VALUES(@p0,@p1,@p2,@p3,@p4)',tenant,data.hash,c.oid,'reset',new Date(Date.now()+30*60*1000).toISOString());return {found:true};
 }
 throw new ApiError(404,'Account operation not found.');
}
