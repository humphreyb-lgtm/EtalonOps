import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {discoverAzure,bingRequestMicroUsd} from './research-discovery';
import {researchNumericFields,researchTextFields,decodeResearchOutput} from './research-output';
import {Store} from './store';
import {createApp} from './app';
const source={url:'https://maker.example/conduit',text:'Fictional official source text.',imageUrls:[]};
const attrs={diameterIn:1,lengthIn:120,material:'PVC',type:'conduit',schedule:'40'};
const item={externalKey:'fictional-pvc-1-10',category:'conduit' as const,productUnit:'STICK' as const,attributes:attrs,manufacturer:'Fictional One',partNumber:'P100',title:'1 inch Schedule 40 PVC conduit',sourceUrl:source.url,verificationBasis:'Fictional source evidence, not a real product.',phrases:['1 inch pvc sch 40']};
const wire={coverageNotes:'End connection not documented.',items:[{...Object.fromEntries(Object.entries(item).filter(([k])=>!['sourceUrl','attributes'].includes(k))),sourceIndex:0,imageIndex:null,attributes:Object.fromEntries([...researchNumericFields,...researchTextFields].map(k=>[k,(attrs as any)[k]??null])),additionalDefiningAttributes:[]}]};
test('partial extraction preserves confirmed conduit specs and flags endConnection',()=>{
 const result=decodeResearchOutput(wire,'Fictional conduit',[source]);assert.equal(result.items.length,1);assert.deepEqual(result.items[0].missingFields,['endConnection']);assert.equal(result.items[0].attributes.lengthIn,120);
});
test('bounded Azure discovery accounts reported Bing requests, not tool-call count, and only trusts cited URLs',async()=>{
 let count=0;const value={status:'completed',model:'gpt-5.4-mini',usage:{input_tokens:500,output_tokens:100},tool_usage:{web_search:{num_requests:2}},output:[{type:'web_search_call',status:'completed',action:{sources:[{url:source.url}]}},{type:'message',content:[{type:'output_text',text:'Official source found.',annotations:[{type:'url_citation',url:'https://127.0.0.1/private'},{type:'url_citation',url:source.url}]}]}]};
 const transport:typeof fetch=async(_url,init)=>{count++;const body=JSON.parse(String(init?.body));assert.equal(body.max_tool_calls,1);assert.equal(body.store,false);assert.equal(body.tool_choice,'required');return new Response(JSON.stringify(value));};
 const result=await discoverAzure('https://pilot.openai.azure.com','gpt-5.4-mini','fictional-key-for-test-only',transport,'Fictional One P100',[]);assert.deepEqual(result.urls,[source.url]);assert.equal(result.searchMicroUsd,2*bingRequestMicroUsd);assert.equal(count,1);
 delete (value as any).tool_usage;await assert.rejects(()=>discoverAzure('https://pilot.openai.azure.com','gpt-5.4-mini','fictional-key-for-test-only',transport,'Part',[]),/billable Bing/);
});
test('assistant discovers without a URL, saves partial review, reopens privately and uses cache without extra calls',async()=>{
 const store=new Store(':memory:');let discovery=0,extraction=0;
 const server=createApp(store,{mode:'local'},{research:{discoveryEnabled:true,async discover(){discovery++;return {urls:[source.url],notes:'Official source found.',inputTokens:100,outputTokens:100,bingRequests:1,modelMicroUsd:578,searchMicroUsd:14000,costMicroUsd:14578};},async research(){extraction++;return {results:decodeResearchOutput(wire,'Fictional One P100',[source]),inputTokens:200,outputTokens:200,costMicroUsd:1155};}},researchSourceLoader:async()=>({...source})}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 const post=async(path:string,data:unknown,token?:string)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
 try{const session=await(await post('/api/dev/session',{identity:'admin'})).json(),headers={Authorization:'Bearer '+session.token},input={requestId:randomUUID(),scope:'Fictional One P100'};
 const first=await post('/api/research/run',input,session.token);assert.equal(first.status,200,await first.clone().text());const result=await first.json();assert.equal(result.usage.bingRequests,1);assert.equal(result.usage.estimatedUsd,.015733);assert.equal(result.results.items.length,1);
 const cached=await(await post('/api/research/run',{...input,requestId:randomUUID()},session.token)).json();assert.equal(cached.cached,true);assert.equal(discovery,1);assert.equal(extraction,1);
 const history=await(await fetch(base+'/api/research/history',{headers})).json();assert.equal(history.length,1);
 const saved=await(await fetch(base+'/api/research/saved/'+result.id,{headers})).json();assert.deepEqual(saved.results.items[0].missingFields,['endConnection']);
 const staged=await post('/api/research/stage',{researchId:result.id,indices:[0]},session.token);assert.equal(staged.status,200,await staged.clone().text());
 assert.equal((await post('/api/research/select',{researchId:result.id,index:0,eventId:randomUUID(),projectId:'riverside'},session.token)).status,400);
 const foreman=await(await post('/api/dev/session',{identity:'foreman-one'})).json();assert.equal((await fetch(base+'/api/research/saved/'+result.id,{headers:{Authorization:'Bearer '+foreman.token}})).status,403);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.db.close();}
});

test('PDF research selects the requested part near the end of a catalog instead of only its opening pages',async()=>{
 const {pdfSourceText}=await import('./research-pdf');const objects:string[]=[];const add=(text:string)=>{objects.push(text);return objects.length;};
 const catalog=add(''),pages=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),kids:number[]=[];
 for(let n=1;n<=70;n++){const text=n===69?'A52BA12 1 inch Schedule 40 PVC conduit bell end 10 feet':'Synthetic manufacturer catalog page '+n;const stream=`BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;const content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));}
 objects[catalog-1]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;objects[pages-1]=`<< /Type /Pages /Kids [${kids.map(id=>id+' 0 R').join(' ')}] /Count 70 >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;}const start=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const text=await pdfSourceText(Buffer.from(pdf),'CANTEX A52BA12');assert.match(text,/Page 69:.*A52BA12.*bell end/);assert.ok(text.length<24500);
});

test('pre-v18 material identities are reused without rewriting specs and metadata corrections retain the material',async()=>{
 const store=new Store(':memory:'),p={tenant:'identity-upgrade',oid:'admin',roles:['Admin']};
 const material={externalKey:'before-upgrade',category:'conduit',productUnit:'STICK',attributes:{...attrs,endConnection:'plain'},sourceUrl:source.url,verificationBasis:'Synthetic upgrade evidence only.',verification:'provisional'};
 try{const first=await store.catalogCommand(p,'material',material);store.db.prepare('UPDATE catalog_profiles SET identity_key=? WHERE material_id=?').run('f'.repeat(64),first.id);
 const reused=await store.catalogCommand(p,'material',{...material,externalKey:'after-upgrade',attributes:{...material.attributes,material:'polyvinyl chloride',endConnection:'plain end'}});assert.equal(reused.id,first.id);
 const corrected=await store.catalogCommand(p,'preview-material-correction',{id:first.id,material,reason:'Check historical identity upgrade compatibility.'});assert.equal(corrected.mode,'metadata');
 }finally{store.db.close();}
});


test('multiple completed search action records share the reported Bing billing count; missing or failed actions have safe diagnostics',async()=>{
 const value={status:'completed',model:'gpt-5.4-mini',usage:{input_tokens:500,output_tokens:100},tool_usage:{web_search:{num_requests:1}},output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[{url:source.url}]}},{type:'web_search_call',status:'completed',action:{type:'open_page'}},{type:'message',content:[{type:'output_text',text:'Official source found.',annotations:[]}]}]};
 const run=()=>discoverAzure('https://pilot.openai.azure.com','gpt-5.4-mini','fictional-key-for-test-only',async()=>new Response(JSON.stringify(value)),'Fictional part',[]);
 const result=await run();assert.equal(result.bingRequests,1);assert.equal(result.searchMicroUsd,14000);assert.deepEqual(result.urls,[source.url]);
 value.output[1].status='failed';await assert.rejects(run,/2 search action records.*failed.*open_page/);
 value.output=value.output.filter(item=>item.type!=='web_search_call');await assert.rejects(run,/0 search action records.*count: 1/);
});
