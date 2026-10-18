import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { Store } from './store';
import { createApp } from './app';
import { catalogStreamValidator } from '../src/catalog-stream';

test('streamed export is admin-only, paged, tenant-isolated and independently checksum verified',async()=>{
 const store=new Store(':memory:');const server=createApp(store,{mode:'local'}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
 const directory=mkdtempSync(join(tmpdir(),'catalog-stream-'));
 async function session(identity:string){return(await(await fetch(base+'/api/dev/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity})})).json()).token;}
 try{
  const token=await session('admin'),foreman=await session('foreman-one'),headers={Authorization:`Bearer ${token}`};
  const p=await(await fetch(base+'/api/me',{headers})).json();
  await store.catalogCommand(p,'material',{externalKey:'stream-test',category:'general',attributes:{type:'Synthetic stream fixture',specification:'Fictional test only'},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/spec',verificationBasis:'Synthetic source, not a real product.'});
  for(let offset=0;offset<10001;offset+=2000){
   const csv=stringify(Array.from({length:Math.min(2000,10001-offset)},(_,j)=>{const i=offset+j;return {kind:'translation',data_json:JSON.stringify({materialKey:'stream-test',phrase:`stream phrase ${i}${i===0?' ½':''}`,origin:'ai_import',sourceUrl:'https://example.invalid/dataset'})};}),{header:true});
   const preview=store.catalogCommand(p,'preview',{csv});store.catalogCommand(p,'apply',{id:preview.id,approval:'I reviewed this batch'});
  }
  assert.throws(()=>store.catalogCommand(p,'export-snapshot',{}),/exceeds 10,000/);
  await store.catalogCommand({...p,tenant:'other-tenant'},'material',{externalKey:'foreign-secret',category:'general',attributes:{type:'Foreign record',specification:'Not visible to other tenants'},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/spec',verificationBasis:'Synthetic source, not a real product.'});
  const path='/api/admin/catalog-stream.jsonl';for(const auth of [undefined,foreman])assert.equal((await fetch(base+path,{headers:auth?{Authorization:`Bearer ${auth}`}:{}})).status,auth?403:401);
  const response=await fetch(base+path,{headers});assert.equal(response.status,200);assert.match(response.headers.get('content-type')??'',/application\/x-ndjson/);assert.equal(response.headers.get('cache-control'),'no-store');
  const text=await response.text(),lines=text.trimEnd().split('\n'),rows=lines.map(line=>JSON.parse(line));
  assert.equal(rows[0].format,'etalonops-catalog-stream');assert.equal(rows.filter(row=>row.type==='record'&&row.table==='translations').length,10001);assert.equal(text.includes('foreign-secret'),false);
  const footer=rows.at(-1);assert.equal(footer.type,'complete');assert.equal(footer.recordCount,rows.length-2);assert.equal(footer.sha256,createHash('sha256').update(lines.slice(0,-1).join('\n')+'\n').digest('hex'));
  const bytes=new TextEncoder().encode(text),validator=catalogStreamValidator();for(let i=0;i<bytes.length;i+=65521)validator.push(bytes.slice(i,i+65521));assert.equal(validator.finish(),footer.recordCount);
  const file=join(directory,'catalog.jsonl');writeFileSync(file,bytes);assert.match(execFileSync('python3',['scripts/verify-catalog-export.py',file],{encoding:'utf8'}),/Catalog export verified/);
  const tampered=text.replace('stream phrase 0','stream phrase X');writeFileSync(file,tampered);assert.throws(()=>execFileSync('python3',['scripts/verify-catalog-export.py',file],{stdio:'pipe'}),/Command failed/);
  const truncated=catalogStreamValidator();truncated.push(new TextEncoder().encode(lines.slice(0,-1).join('\n')+'\n'));assert.throws(()=>truncated.finish(),/incomplete/);
  const original=store.catalogCommand.bind(store);let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
  store.catalogCommand=(principal,action,data)=>action==='export-page'&&(data as {table:string}).table==='materials'?blocked.then(()=>original(principal,action,data)):original(principal,action,data);
  const first=await fetch(base+path,{headers});assert.equal((await fetch(base+path,{headers})).status,429);release();await first.text();store.catalogCommand=original;
  store.catalogCommand=(principal,action,data)=>{if(action==='export-page'&&(data as {table:string}).table==='translations')throw new Error('Synthetic export interruption');return original(principal,action,data);};
  await assert.rejects(async()=>{const broken=await fetch(base+path,{headers});await broken.text();});store.catalogCommand=original;
  const retry=await fetch(base+path,{headers});assert.equal(retry.status,200);await retry.arrayBuffer();
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.db.close();rmSync(directory,{recursive:true,force:true});}
});
