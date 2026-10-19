import type express from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {ApiError,type Principal} from './contracts';
import type {Repository} from './repository';
import {checkPassword,hashPassword,passwordSchema,secretToken,tokenHash} from './site-accounts';
export function sessionCookie(req:express.Request){return /(?:^|;\s*)etalonops_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.get('cookie')??'')?.[1];}
export function accountRoutes(app:express.Express,store:Repository,tenant:string,secure:boolean){
 const options={httpOnly:true,secure,sameSite:'lax' as const,path:'/api',maxAge:8*60*60*1000};
 const guard=(req:express.Request,_res:express.Response,next:express.NextFunction)=>{if(req.get('x-etalonops-request')!=='1')return next(new ApiError(403,'Use the EtalonOps sign-in page.'));next();};
 app.use('/api/auth',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,handler:(_req,res)=>res.status(429).json({error:'Too many account requests. Wait 15 minutes.'})}));
 const email=z.string().trim().toLowerCase().pipe(z.email().max(254));
 app.get('/api/auth/options',(_req,res)=>res.json({site:true,resetEmail:Boolean(process.env.ETALONOPS_MAIL_WEBHOOK_URL&&process.env.ETALONOPS_MAIL_WEBHOOK_TOKEN&&process.env.ETALONOPS_PUBLIC_ORIGIN)}));
 app.get('/api/auth/session',async(req,res)=>{const cookie=sessionCookie(req);if(!cookie)throw new ApiError(401,'Sign in to continue.');res.json(await store.admit(await store.account(tenant,'session',{hash:tokenHash(cookie)})));});
 app.post('/api/auth/login',guard,async(req,res)=>{const v=z.object({email,password:z.string().min(1).max(128)}).strict().parse(req.body);await store.account(tenant,'attempt',{email:v.email});const row=await store.account(tenant,'credential',{email:v.email});const valid=await checkPassword(v.password,row?.password_hash??null);if(!valid||!row?.active)throw new ApiError(401,'Email or password is incorrect.');const token=secretToken();await store.account(tenant,'session-create',{oid:row.oid,expectedHash:row.password_hash,hash:tokenHash(token)});res.cookie('etalonops_session',token,options);res.json(await store.admit(await store.account(tenant,'session',{hash:tokenHash(token)})));});
 app.post('/api/auth/logout',guard,async(req,res)=>{const cookie=sessionCookie(req);if(cookie)await store.account(tenant,'logout',{hash:tokenHash(cookie)});res.clearCookie('etalonops_session',{...options,maxAge:undefined});res.json({ok:true});});
 app.post('/api/auth/link-info',guard,async(req,res)=>{const v=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(req.body);res.json(await store.account(tenant,'token-info',{hash:tokenHash(v.token)}));});
 app.post('/api/auth/complete',guard,async(req,res)=>{const v=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),password:passwordSchema}).strict().parse(req.body);res.json(await store.account(tenant,'password-set',{hash:tokenHash(v.token),passwordHash:await hashPassword(v.password)}));});
 app.post('/api/auth/forgot',guard,async(req,res)=>{const v=z.object({email}).strict().parse(req.body);await store.account(tenant,'attempt',{email:v.email});const configured=Boolean(process.env.ETALONOPS_MAIL_WEBHOOK_URL&&process.env.ETALONOPS_MAIL_WEBHOOK_TOKEN&&process.env.ETALONOPS_PUBLIC_ORIGIN);if(configured){const token=secretToken(),result=await store.account(tenant,'self-reset',{email:v.email,hash:tokenHash(token)});if(result.found){try{await sendAccountMail(v.email,'reset',token);}catch{console.error('Account reset email delivery failed. No account details or token logged.');}}}res.json({message:configured?'If an active site account matches, a reset link will be sent. You can also contact your company administrator.':'Contact your company administrator for a secure password-reset link. Microsoft passwords are reset through Microsoft.'});});
}
export async function sendAccountMail(email:string,kind:'invite'|'reset',token:string){
 const endpoint=process.env.ETALONOPS_MAIL_WEBHOOK_URL,secret=process.env.ETALONOPS_MAIL_WEBHOOK_TOKEN,origin=process.env.ETALONOPS_PUBLIC_ORIGIN;
 if(!endpoint||!secret||!origin)return false;if(!endpoint.startsWith('https://')||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))throw new Error('Invalid account mail configuration.');
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({to:email,template:kind,url:`${origin}/#${kind==='invite'?'register':'reset'}=${token}`,expiresMinutes:kind==='invite'?4320:30}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new Error('Account mail delivery failed.');return true;
}
export function managedAccountRoutes(app:express.Express,store:Repository){
 app.post('/api/admin/account-link',async(req,res)=>{if(req.get('x-etalonops-request')!=='1')throw new ApiError(403,'Request header required.');const v=z.object({oid:z.string().min(1).max(64),kind:z.enum(['invite','reset']),email:z.email().max(254).optional()}).strict().parse(req.body),p=res.locals.principal as Principal,token=secretToken();const result=await store.account(p.tenant,'issue-link',{...v,hash:tokenHash(token)},p);let delivered=false;try{delivered=await sendAccountMail(result.email,v.kind,token);}catch{console.error('Account invitation email delivery failed. No account details or token logged.');}res.set('Cache-Control','no-store').json({fragment:`#${v.kind==='invite'?'register':'reset'}=${token}`,delivered,email:result.email});});
 app.post('/api/admin/revoke-account-links',async(req,res)=>{const v=z.object({oid:z.string().min(1).max(64)}).strict().parse(req.body),p=res.locals.principal as Principal;res.json(await store.account(p.tenant,'revoke-invitation',v,p));});
}
