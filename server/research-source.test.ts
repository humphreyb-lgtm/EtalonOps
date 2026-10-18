import {test} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import dns from 'node:dns/promises';
import {syncBuiltinESMExports} from 'node:module';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {fetchResearchSource,sourceText} from './research-source';

test('manufacturer source loading decodes gzip/Brotli, enforces decoded limits and reports HTTP access errors without live network',async t=>{
 let bytes=Buffer.alloc(0),encoding='gzip',status=200;
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
 t.mock.method(https,'get',(_url:unknown,_options:unknown,callback:(response:any)=>void)=>{const request=new EventEmitter() as any;request.destroy=(error?:Error)=>{if(error)queueMicrotask(()=>request.emit('error',error));request.emit('close');return request;};queueMicrotask(()=>{const response=Readable.from([bytes]) as any;response.statusCode=status;response.headers={'content-type':'text/html','content-encoding':encoding};response.once('close',()=>request.emit('close'));callback(response);});return request;});syncBuiltinESMExports();
 try{for(const method of ['gzip','br']){encoding=method;const html='<h1>Manufacturer product details</h1><img src="/product.png">';bytes=method==='gzip'?gzipSync(html):brotliCompressSync(html);const source=await fetchResearchSource('https://maker.example/product');assert.match(source.text,/Manufacturer product details/);assert.deepEqual(source.imageUrls,['https://maker.example/product.png']);}
 encoding='gzip';bytes=gzipSync('X'.repeat(2_100_000));await assert.rejects(()=>fetchResearchSource('https://maker.example/large'),/extracted size limit/);
 status=403;bytes=gzipSync('Forbidden');await assert.rejects(()=>fetchResearchSource('https://maker.example/blocked'),/HTTP 403/);
 }finally{t.mock.restoreAll();syncBuiltinESMExports();}
});
test('JSON-LD product images are observed for manual review without adopting unrelated structured image claims',()=>{
 const source=sourceText('https://maker.example/product','<script type="application/ld+json">{"@type":"Product","name":"Synthetic part","image":"https://cdn.example/part.jpg"}</script>');assert.deepEqual(source.imageUrls,['https://cdn.example/part.jpg']);
});
