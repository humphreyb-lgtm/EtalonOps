import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { Store } from './store';
import { createApp } from './app';
import { FileImageAssets,normalizeImage,imageKey } from './image-assets';

const fixture=readFileSync(new URL('../db/fixtures/catalog.csv',import.meta.url),'utf8');
test('image decoder rejects SVG, corrupt, animated and oversized input; canonical output is hash checked',async()=>{
  for(const input of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),Buffer.from('not an image'),Buffer.alloc(5*1024*1024+1)]) await assert.rejects(()=>normalizeImage(input));
  const animated=await sharp(Buffer.from([255,0,0,0,255,0]),{raw:{width:1,height:2,channels:3,pageHeight:1}}).webp({loop:0,delay:[100,100]}).toBuffer();
  assert.equal((await sharp(animated,{animated:true}).metadata()).pages,2);await assert.rejects(()=>normalizeImage(animated));
  const oversizedPixels=await sharp({create:{width:4001,height:4001,channels:3,background:'#123456'}}).png().toBuffer();
  await assert.rejects(()=>normalizeImage(oversizedPixels));
  const pixels=await sharp({create:{width:32,height:24,channels:3,background:'#cc4400'}}).withMetadata({orientation:6,exif:{IFD0:{Artist:'private-test-metadata'}}}).png().toBuffer();
  const normalized=await normalizeImage(pixels);
  const outputMetadata=await sharp(normalized.bytes).metadata();assert.equal(outputMetadata.format,'webp');assert.equal(outputMetadata.exif,undefined);assert.equal(outputMetadata.orientation,undefined);assert.equal(outputMetadata.width,24);
  assert.equal((await normalizeImage(pixels)).hash,normalized.hash);
  const directory=await mkdtemp(join(tmpdir(),'etalonops-images-'));
  try{
    const assets=new FileImageAssets(directory),key=imageKey('tenant','11111111-1111-4111-8111-111111111111',normalized.hash);
    await assets.put(key,normalized.bytes);await assets.put(key,normalized.bytes);
    assert.deepEqual(await new FileImageAssets(directory).get(key),normalized.bytes);
    await assert.rejects(()=>assets.get('../control.json'));
    await assert.rejects(()=>assets.put(key,Buffer.from('changed')));
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('image HTTP workflow protects pending bytes, requires rights review, replaces/removes and remembers rejected associations',async()=>{
  const store=new Store(':memory:'),directory=await mkdtemp(join(tmpdir(),'etalonops-image-api-'));
  const p={tenant:'local-development',oid:'admin',roles:['Admin']};
  const batch=store.previewImport(p,fixture);store.applyImport(p,batch.id,'I reviewed this batch',true);
  const row=store.search(p,'1 inch pvc')[0],material={...row,id:String(row.id)};
  const foreign={...p,tenant:'foreign'};const otherBatch=store.previewImport(foreign,fixture);store.applyImport(foreign,otherBatch.id,'I reviewed this batch',true);
  const otherRow=store.search(foreign,'1 inch pvc')[0],otherMaterial={...otherRow,id:String(otherRow.id)};
  const server=createApp(store,{mode:'local'},{images:new FileImageAssets(directory)}).listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  const session=async(identity:string)=>(await(await fetch(base+'/api/dev/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity})})).json()).token;
  const image=await sharp({create:{width:30,height:30,channels:3,background:'#1144cc'}}).png().toBuffer();
  try{
    const admin=await session('admin'),foreman=await session('foreman-one');
    const upload=(id:string,token:string,bytes:Buffer)=>fetch(`${base}/api/admin/materials/${id}/images`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/png','x-image-source-url':'https://manufacturer.example/catalog','x-image-rights-basis':'Owned test image; internal test rights only.'},body:new Uint8Array(bytes)});
    const get=(path:string,token=foreman)=>fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});
    const review=(id:string,status:string,approval?:string)=>fetch(`${base}/api/admin/materials/${material.id}/images/${id}/review`,{method:'POST',headers:{Authorization:`Bearer ${admin}`,'Content-Type':'application/json'},body:JSON.stringify({status,...(approval?{approval}:{})})});
    assert.equal((await upload(material.id,foreman,image)).status,403);
    assert.equal((await upload(String(otherMaterial.id),admin,image)).status,404);
    assert.equal((await upload(material.id,admin,Buffer.from('<svg/>'))).status,400);
    const created=await upload(material.id,admin,image);assert.equal(created.status,201);
    const record=(await created.json()).image;
    assert.equal(record.status,'pending');
    assert.equal((await get(`/api/materials/${material.id}/image`)).status,404);
    assert.equal((await get(`/api/admin/materials/${material.id}/images/${record.id}/content`)).status,403);
    assert.equal((await get(`/api/admin/materials/${material.id}/images/${record.id}/content`,admin)).status,200);
    assert.equal((await review(record.id,'approved')).status,400);
    assert.equal((await review(record.id,'approved','I verified the product image and usage rights')).status,200);
    const publicImage=await get(`/api/materials/${material.id}/image`);assert.equal(publicImage.status,200);assert.match(publicImage.headers.get('cache-control')!,/no-store/);assert.match(publicImage.headers.get('content-type')!,/image\/webp/);
    assert.equal((await get(`/api/materials/${otherMaterial.id}/image`)).status,404);
    const missing=store.submitImage(p,material.id,'f'.repeat(64),{sourceUrl:'https://manufacturer.example/missing',rightsBasis:'Internal missing-asset security fixture.'});
    assert.equal((await review(missing.id,'approved','I verified the product image and usage rights')).status,409);
    assert.equal(store.listImages(p,material.id).find(i=>i.id===missing.id)!.status,'pending');
    const alternate=await sharp({create:{width:30,height:30,channels:3,background:'#229944'}}).png().toBuffer();
    const replacement=(await(await upload(material.id,admin,alternate)).json()).image;
    await review(replacement.id,'approved','I verified the product image and usage rights');
    assert.equal(store.listImages(p,material.id).find(i=>i.id===record.id)!.status,'rejected');
    assert.equal((await upload(material.id,admin,image)).status,409);
    assert.equal((await review(record.id,'approved','I verified the product image and usage rights')).status,409);
    await review(replacement.id,'rejected');assert.equal((await get(`/api/materials/${material.id}/image`)).status,404);
    assert.ok(store.db.prepare("SELECT id FROM audit_events WHERE action='image.replaced'").get());
  }finally{await new Promise<void>(r=>server.close(()=>r()));store.db.close();await rm(directory,{recursive:true,force:true});}
});

test('retained image quota is tenant scoped and rejects new associations',()=>{
  const store=new Store(':memory:'),admin={tenant:'full',oid:'admin',roles:['Admin']},other={...admin,tenant:'other'};
  for(const p of [admin,other]){const batch=store.previewImport(p,fixture);store.applyImport(p,batch.id,'I reviewed this batch',true);}
  const id=String(store.search(admin,'1 inch pvc')[0].id),otherId=String(store.search(other,'1 inch pvc')[0].id);
  const evidence={sourceUrl:'https://manufacturer.example/test',rightsBasis:'Internal quota fixture, not a real photo.'};
  const rows=store.db.prepare("INSERT INTO image_associations(id,tenant,material_id,content_hash,source_url,rights_basis,status) VALUES(?,?,?,?,?,?,'rejected')");
  store.transaction(()=>{for(let i=0;i<500;i++)rows.run(randomUUID(),admin.tenant,id,i.toString(16).padStart(64,'0'),evidence.sourceUrl,evidence.rightsBasis);});
  assert.throws(()=>store.submitImage(admin,id,'f'.repeat(64),evidence),/500 retained/);
  assert.equal(store.submitImage(other,otherId,'f'.repeat(64),evidence).status,'pending');store.db.close();
});
