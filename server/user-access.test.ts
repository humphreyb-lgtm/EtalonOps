import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Store } from './store';
import { createApp } from './app';
test('HTTP deactivation denies an already-issued token and local sign-in cannot restore revoked project access',async()=>{
 const store=new Store(':memory:'),server=createApp(store,{mode:'local'}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const session=async(identity:string)=>{const response=await fetch(base+'/api/dev/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity})});return {response,...await response.json()};};
 try{
  const admin=await session('admin'),user=await session('foreman-one');
  const get=(path:string,token:string)=>fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});
  const command=async(action:string,data:unknown)=>fetch(base+'/api/admin/users/'+action,{method:'POST',headers:{Authorization:`Bearer ${admin.token}`,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const profile=await(await command('detail',{oid:'foreman-one'})).json();
  const change={oid:'foreman-one',displayName:'Test Foreman',active:true,roleLimit:null,projects:['northside'],version:profile.version,reason:'Revoke Riverside project access for this fixture account.'};
  assert.equal((await command('save',change)).status,200);assert.equal((await get('/api/projects/riverside/drafts',user.token)).status,404);
  const again=await session('foreman-one');assert.equal(again.response.status,200);assert.equal((await get('/api/projects/riverside/drafts',again.token)).status,404);
  const current=await(await command('detail',{oid:'foreman-one'})).json();assert.equal((await command('save',{...change,active:false,version:current.version})).status,200);
  assert.equal((await get('/api/me',user.token)).status,403);assert.equal((await session('foreman-one')).response.status,403);
  assert.equal((await get('/api/me',admin.token)).status,200);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.db.close();}
});
