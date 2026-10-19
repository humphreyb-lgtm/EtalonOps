import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {randomUUID} from 'node:crypto';
import {Store} from './store';
import {createApp} from './app';
test('site account HTTP registration login csrf logout and reset do not disclose passwords or reset tokens',async()=>{
 const store=new Store(':memory:'),app=createApp(store,{mode:'local'}),server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 async function post(path:string,body:unknown,extra:Record<string,string>={}){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-EtalonOps-Request':'1',...extra},body:JSON.stringify(body)});}
 try{const token=(await(await post('/api/dev/session',{identity:'admin'})).json()).token,auth={Authorization:`Bearer ${token}`};await post('/api/admin/users/directory',{},auth);const oid=randomUUID();assert.equal((await post('/api/admin/users/workforce-save',{oid,displayName:'Site User',companyId:'main',active:true,accessRole:'Member',details:{email:'site@example.invalid',phone:'',title:'',employeeNumber:''},assignments:[],version:0,reason:'Register a site account for HTTP checks.'},auth)).status,200);
 const issued=await(await post('/api/admin/account-link',{oid,kind:'invite',email:'site@example.invalid'},auth)).json();assert.ok(issued.fragment.startsWith('#register='));const invite=issued.fragment.split('=')[1];assert.equal((await post('/api/auth/complete',{token:invite,password:'A very strong HTTP passphrase 123'})).status,200);assert.equal((await post('/api/auth/complete',{token:invite,password:'A very strong HTTP passphrase 123'})).status,400);
 const login=await post('/api/auth/login',{email:'site@example.invalid',password:'A very strong HTTP passphrase 123'});assert.equal(login.status,200);const setCookie=login.headers.get('set-cookie')!;assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);const cookie=setCookie.split(';')[0];assert.equal((await fetch(base+'/api/me',{headers:{Cookie:cookie}})).status,200);const csrf=await fetch(base+'/api/admin/users/directory',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 assert.equal((await post('/api/admin/users/directory',{}, {Cookie:cookie})).status,403);const forgot=await(await post('/api/auth/forgot',{email:'site@example.invalid'})).json();assert.ok(!JSON.stringify(forgot).includes('token'));assert.equal((await post('/api/auth/login',{email:'site@example.invalid',password:'incorrect password'})).status,401);await post('/api/auth/logout',{}, {Cookie:cookie});assert.equal((await fetch(base+'/api/me',{headers:{Cookie:cookie}})).status,401);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.db.close();}
});
