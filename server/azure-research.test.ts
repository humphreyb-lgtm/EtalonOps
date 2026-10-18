import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pdfSourceText} from './research-pdf';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AzureResponsesResearch,configuredResearch,type LiveResearchItem} from './azure-research';
import {publicSourceUrl,publicSourceIp,sourceText} from './research-source';
import {researchPolicy,researchCost,checkResearchPricing} from './research-policy';
import {Store} from './store';
import {createApp} from './app';
const source={url:'https://example.com/product',text:'Fictional source, not manufacturer evidence.',imageUrls:['https://example.com/product.png']};
const item:LiveResearchItem={externalKey:'test-live-research',category:'general',productUnit:'EA',attributes:{type:'Fictional research widget',specification:'Synthetic specifications only.'},manufacturer:'Fictional Research Maker',partNumber:'LIVE-TEST-001',title:'Fictional widget',sourceUrl:source.url,verificationBasis:'Synthetic source evidence for tests only.',phrases:['fictional research widget'],imageUrl:source.imageUrls[0]};
const results={scope:'Test',coverageNotes:'Synthetic page only, no completeness claim.',items:[item]};
const response=(change:Record<string,unknown>={})=>({status:'completed',model:'gpt-5.4-mini-2026-03-17',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(results)}]}],usage:{input_tokens:500,output_tokens:1000},...change});
test('Responses research uses the selected Azure API with no tools, storage, redirects or automatic retries',async()=>{
 let calls=0;const transport:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://pilot.openai.azure.com/openai/responses?api-version=2025-04-01-preview');const body=JSON.parse(String(init?.body));assert.equal(body.model,'gpt-5.4-mini');assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.max_output_tokens,8000);assert.deepEqual(body.reasoning,{effort:'low'});assert.equal(init?.redirect,'error');assert.equal((init?.headers as any)['api-key'],'fictional-key-used-only-for-tests');return new Response(JSON.stringify(response()));};
 const provider=new AzureResponsesResearch('https://pilot.openai.azure.com','gpt-5.4-mini','fictional-key-used-only-for-tests',transport);const value=await provider.research('Test',[source]);assert.equal(value.results.items.length,1);assert.equal(value.costMicroUsd,researchCost(500,1000));assert.equal(calls,1);
 for(const bad of [response({status:'incomplete'}),response({model:'gpt-5.4'}),response({usage:{input_tokens:500,output_tokens:9000}}),response({output:[{type:'web_search_call'}]}),response({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...results,items:[{...item,sourceUrl:'https://example.com/invented'}]})}]}]})]){let attempts=0;const model=new AzureResponsesResearch('https://pilot.openai.azure.com','gpt-5.4-mini','fictional-key-used-only-for-tests',async()=>{attempts++;return new Response(JSON.stringify(bad));});await assert.rejects(()=>model.research('Test',[source]),/valid source-backed/);assert.equal(attempts,1);}
 const absent=new AzureResponsesResearch('https://pilot.openai.azure.com','gpt-5.4-mini','fictional-key-used-only-for-tests',async()=>new Response(JSON.stringify(response({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...results,items:[]})}]}]}))));assert.equal((await absent.research('Test',[source])).results.items.length,0);
 assert.equal(configuredResearch({}),undefined);assert.throws(()=>configuredResearch({ETALONOPS_RESEARCH_ENABLED:'true'}));assert.throws(()=>checkResearchPricing(new Date('2026-11-19')));assert.ok(researchCost(researchPolicy.maxBodyBytes+2048,8000)<researchPolicy.reservationMicroUsd);
});
test('source parsing removes executable content and network validation rejects internal targets',()=>{
 for(const url of ['http://example.com','https://127.0.0.1/','https://user:secret@example.com','https://example.com:444/','https://service.internal','https://localhost'])assert.throws(()=>publicSourceUrl(url));
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.2','100.64.0.1','::1','0.0.0.0','224.0.0.1'])assert.equal(publicSourceIp(ip),false);assert.equal(publicSourceIp('8.8.8.8'),true);
 const parsed=sourceText(source.url,'<script>doEvil()</script><style>invisible</style><h1>Widget &amp; brackets</h1><img src="/product.png"><script type="application/ld+json">{"name":"source widget"}</script>');assert.ok(parsed.text.includes('Widget & brackets'));assert.ok(!parsed.text.includes('doEvil'));assert.deepEqual(parsed.imageUrls,source.imageUrls);
});
test('research HTTP reserves before calling, reuses saved results, binds selection to stored evidence and stages images unpublished',async()=>{
 const store=new Store(':memory:');let calls=0;let fail=false;const server=createApp(store,{mode:'local'},{research:{async research(){calls++;if(fail)throw Error('fictional provider failure');return {results,inputTokens:500,outputTokens:1000,costMicroUsd:researchCost(500,1000)};}},researchSourceLoader:async()=>source}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address() as import('node:net').AddressInfo,base='http://127.0.0.1:'+address.port;
 const post=async(path:string,data:unknown,token?:string)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
 try{
  const admin=await(await post('/api/dev/session',{identity:'admin'})).json(),foreman=await(await post('/api/dev/session',{identity:'foreman-one'})).json();const input={requestId:randomUUID(),scope:'Fictional research',sourceUrls:[source.url],searchPhrase:'original researched widget'};
  assert.equal((await post('/api/research/run',input)).status,401);assert.equal((await post('/api/research/run',input,foreman.token)).status,403);assert.equal(calls,0);
  const first=await post('/api/research/run',input,admin.token);assert.equal(first.status,200);const session=await first.json();assert.equal(calls,1);const again=await(await post('/api/research/run',{...input,requestId:randomUUID()},admin.token)).json();assert.equal(again.cached,true);assert.equal(calls,1);
  assert.equal((await post('/api/research/select',{researchId:session.id,index:0,eventId:randomUUID(),projectId:'riverside',item:{...item,partNumber:'FORGED'}},admin.token)).status,400);
  const selection={researchId:session.id,index:0,eventId:randomUUID(),projectId:'riverside'};const selected=await post('/api/research/select',selection,admin.token);assert.equal(selected.status,200,await selected.clone().text());const product=await selected.json();assert.equal(product.candidate.products[0].partNumber,item.partNumber);assert.equal(product.candidate.verification,'provisional');assert.equal((await post('/api/research/select',selection,admin.token)).status,200);
  const staged=await(await post('/api/research/stage',{researchId:session.id,indices:[0]},admin.token)).json();assert.equal(staged.items.filter((row:any)=>row.kind==='image').length,1);assert.ok(staged.items.every((row:any)=>row.state==='unpublished'));
  fail=true;assert.equal((await post('/api/research/run',{...input,scope:'New scope',requestId:randomUUID()},admin.token)).status,502);const usage=await(await fetch(base+'/api/admin/research/usage',{headers:{Authorization:'Bearer '+admin.token}})).json();assert.equal(usage.requests,2);assert.equal(usage.reservedUsd,(150000+researchCost(500,1000))/1e6);assert.equal(usage.heldUsd,0.15);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.db.close();}
});

test('manufacturer PDF text is extracted in a bounded worker and invalid PDFs are rejected',async()=>{
 const content='BT /F1 12 Tf 20 100 Td (Synthetic manufacturer specification 15.75 inches) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 assert.match(await pdfSourceText(Buffer.from(pdf)),/15\.75 inches/);await assert.rejects(()=>pdfSourceText(Buffer.from('not a PDF')),/PDF/);
});

test('dollar reservations survive a database restart and cannot be reused',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'etalonops-research-ledger-')),path=join(directory,'ledger.sqlite'),p={tenant:'restart-test',oid:'admin',roles:['Admin']},requestId=randomUUID();
 try{const first=new Store(path);first.paidResearch(p,'reserve',{requestId});first.db.close();const restarted=new Store(path);try{assert.equal(restarted.paidResearch(p,'usage',{}).reservedUsd,0.15);assert.throws(()=>restarted.paidResearch(p,'reserve',{requestId}),/already reserved/);}finally{restarted.db.close();}}finally{await rm(directory,{recursive:true,force:true});}
});
