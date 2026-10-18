import { createHash } from 'node:crypto';
import type { Express,Response } from 'express';
import type { Principal } from './contracts';
import { ApiError } from './contracts';
import type { Repository } from './repository';
import { catalogExportTables } from './catalog-v2';

async function write(res:Response,line:string){
 if(res.destroyed)throw new Error('Export connection closed.');
 if(res.write(line))return;
 await new Promise<void>((resolve,reject)=>{
  const cleanup=()=>{res.off('drain',drain);res.off('close',close);res.off('error',error);};
  const drain=()=>{cleanup();resolve();};
  const close=()=>{cleanup();reject(new Error('Export connection closed.'));};
  const error=(e:Error)=>{cleanup();reject(e);};
  res.once('drain',drain);res.once('close',close);res.once('error',error);
  if(res.destroyed)close();
 });
}
export function catalogExportRoutes(app:Express,store:Repository){
 const active=new Set<string>();
 app.get('/api/admin/catalog-stream.jsonl',async(_req,res)=>{
  const p=res.locals.principal as Principal;await store.requireAdmin(p);
  const lock=JSON.stringify([p.tenant,p.oid]);if(active.has(lock))throw new ApiError(429,'A catalog export is already running for this account.');
  active.add(lock);
  try{
   res.attachment('etalonops-catalog-stream.jsonl').type('application/x-ndjson').set('Cache-Control','no-store');
   const hash=createHash('sha256');let count=0;const tableCounts:Record<string,number>={};
   const emit=async(value:unknown)=>{const line=JSON.stringify(value)+'\n';hash.update(line,'utf8');await write(res,line);};
   await store.audit(p,'catalog.stream_started','v1');
   await emit({type:'manifest',format:'etalonops-catalog-stream',version:1,tenant:p.tenant,exportedAt:new Date().toISOString(),imageFilesIncluded:false,consistency:'paged-read',tables:catalogExportTables});
   for(const table of catalogExportTables){
    tableCounts[table]=0;let cursor:unknown=undefined;
    do{
     if(res.destroyed)return;
     const page=await store.catalogCommand(p,'export-page',{table,pageSize:table==='catalog_batches'||table==='import_batches'?1:250,...(cursor?{cursor}:{})});
     for(const row of page.records){await emit({type:'record',table,row});count++;tableCounts[table]++;}
     cursor=page.nextCursor;
    }while(cursor);
   }
   await store.audit(p,'catalog.stream_completed',String(count));
   await write(res,JSON.stringify({type:'complete',recordCount:count,tableCounts,sha256:hash.digest('hex')})+'\n');res.end();
  }catch(error){if(res.headersSent){res.destroy(error instanceof Error?error:undefined);return;}throw error;}
  finally{active.delete(lock);}
 });
}
