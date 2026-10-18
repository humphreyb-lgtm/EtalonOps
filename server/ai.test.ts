import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from './store';
import { createApp } from './app';
import { aiLimits,checkAIReservation,aiPeriod } from './ai-policy';
import { AzureDirectModel,lookupInput,prepareAI,validateModelReply,configuredModel,type AIProvider } from './ai-provider';
const user={tenant:'test',oid:'one',roles:['Foreman']};
const input=()=>lookupInput.parse({projectId:'riverside',sessionId:randomUUID(),turnId:randomUUID(),description:'black 6-32 screws',quantity:'10',requestedUnit:'EA',choice:'other',turns:[{author:'assistant',text:'What length do you need?'},{author:'user',text:'One inch long.'}]});
const reply={model:'gpt-4.1-mini-2025-04-14',inputTokens:700,outputTokens:80,result:{question:null,summary:'Black 6-32 screws, 1 inch long.',description:'Black 6-32 screws, 1 inch long.',missingFields:[]}};
test('AI requests are schema/byte bounded, source-only, model-pinned and cannot invent dimensions',()=>{
  const prepared=prepareAI(input());
  const body=JSON.parse(prepared.body);assert.equal(body.max_tokens,600);assert.equal(body.messages[0].role,'system');assert.equal(body.messages[1].role,'user');
  const result=validateModelReply(prepared,reply);assert.equal(result.question,null);assert.equal(result.discoveryAvailable,false);
  assert.throws(()=>validateModelReply(prepared,{...reply,model:'gpt-4.1'}));
  assert.throws(()=>validateModelReply(prepared,{...reply,result:{...reply.result,description:'8-32 screws, 2 inch long'}}));
  assert.throws(()=>validateModelReply(prepared,{...reply,result:{...reply.result,summary:'<img src=x>'}}));
  assert.throws(()=>validateModelReply(prepared,{...reply,result:{...reply.result,description:'Black 6-32 screws, 1 mm long.'}}));
  assert.throws(()=>validateModelReply(prepared,{...reply,result:{...reply.result,productId:'invented'}}));
  assert.throws(()=>prepareAI({...input(),turns:Array.from({length:12},()=>({author:'user' as const,text:'中'.repeat(2000)}))}));
  const repeat=validateModelReply(prepared,{...reply,result:{...reply.result,question:'What length do you need?',missingFields:['length']}});
  assert.equal(repeat.question,null);
  const missing=prepareAI({...input(),description:'6-32 screws',turns:[]});
  const dynamic=validateModelReply(missing,{...reply,result:{summary:'6-32 screws',description:'6-32 screws',question:'What length should the screws be?',missingFields:['length']}});
  assert.equal(dynamic.question,'What length should the screws be?');
  assert.equal(configuredModel({ETALONOPS_AI_ENABLED:'false'}),undefined);
  assert.throws(()=>configuredModel({ETALONOPS_AI_ENABLED:'true'}));
  assert.throws(()=>new AzureDirectModel('http://127.0.0.1','model'));
});
test('monthly session/turn/daily limits and request deduplication are deterministic',()=>{
  const session=randomUUID(),turn=randomUUID(),now=new Date();
  const target=checkAIReservation([],user,session,turn,now);
  const rows=[{actor:user.oid,target,at:now.toISOString()}];
  assert.throws(()=>checkAIReservation(rows,user,session,turn,now),/already reserved/);
  assert.throws(()=>checkAIReservation(rows,{...user,oid:'other'},session,randomUUID(),now),/not found/);
  const two=[...rows,{...rows[0],target:`${aiPeriod(now)}/${session}/${randomUUID()}`}];
  assert.throws(()=>checkAIReservation(two,user,session,randomUUID(),now),/two AI turns/);
  const full=Array.from({length:200},(_,i)=>({actor:`owner-${i}`,target:`${aiPeriod(now)}/${randomUUID()}/${randomUUID()}`,at:now.toISOString()}));
  assert.throws(()=>checkAIReservation(full,user,randomUUID(),randomUUID(),now),/session limit/);
  const daily=Array.from({length:20},()=>({actor:user.oid,target:`${aiPeriod(now)}/${randomUUID()}/${randomUUID()}`,at:now.toISOString()}));
  assert.throws(()=>checkAIReservation(daily,user,randomUUID(),randomUUID(),now),/daily/);
  assert.equal(aiLimits.monthlyRequests,400);
});
test('direct Azure client sends one managed-identity request and rejects refusals/truncation without retries',async()=>{
  let calls=0;
  const credential={getToken:async()=>({token:'non-secret-test-token',expiresOnTimestamp:Date.now()+60000})};
  const transport:typeof fetch=async(url,init)=>{calls++;assert.match(String(url),/^https:\/\/pilot\.openai\.azure\.com\/openai\/deployments\/mini\/chat\/completions/);assert.equal(init?.redirect,'error');assert.ok(init?.signal);return new Response(JSON.stringify({model:reply.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply.result)}}],usage:{prompt_tokens:700,completion_tokens:80}}),{status:200});};
  const client=new AzureDirectModel('https://pilot.openai.azure.com','mini',credential,transport);
  assert.equal((await client.interpret(prepareAI(input()))).model,reply.model);assert.equal(calls,1);
  for(const response of [new Response('{}',{status:429}),new Response(JSON.stringify({choices:[{finish_reason:'length',message:{}}]})),new Response('x'.repeat(33000))]){
    let attempts=0;const bad=new AzureDirectModel('https://pilot.openai.azure.com','mini',credential,async()=>{attempts++;return response;});
    await assert.rejects(()=>bad.interpret(prepareAI(input())),/AI is unavailable/);assert.equal(attempts,1);
  }
});
test('persistent reservations survive restarts and parallel requests cannot exceed two session turns',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'etalonops-ai-budget-'));const path=join(directory,'usage.sqlite');const store=new Store(path);store.member(user,'riverside');const session=randomUUID();
  const outcomes=await Promise.allSettled(Array.from({length:4},async()=>store.reserveAI(user,'riverside',session,randomUUID())));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(store.aiUsage({...user,roles:['Admin']}).requests,2);
  assert.throws(()=>store.aiUsage(user),/Administrator/);store.db.close();
  const restarted=new Store(path);assert.equal(restarted.aiUsage({...user,roles:['Admin']}).requests,2);restarted.db.close();await rm(directory,{recursive:true,force:true});
});
test('AI HTTP checks membership and reserves usage before one provider call, including failures',async()=>{
  const store=new Store(':memory:');let calls=0;let fail=false;
  const provider:AIProvider={async interpret(){calls++;if(fail)throw new Error('simulated provider failure');return reply;}};
  const server=createApp(store,{mode:'local'},{ai:provider}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  const session=async(identity:string)=>(await(await fetch(base+'/api/dev/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity})})).json()).token;
  try{
    const token=await session('foreman-one'),headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    const body=input(),post=()=>fetch(base+'/api/lookup/clarify',{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal((await post()).status,200);assert.equal(calls,1);
    assert.equal((await post()).status,409);assert.equal(calls,1);
    fail=true;body.turnId=randomUUID();assert.equal((await post()).status,502);assert.equal(calls,2);
    body.turnId=randomUUID();assert.equal((await post()).status,429);assert.equal(calls,2);
    assert.equal((await fetch(base+'/api/admin/ai/usage',{headers})).status,403);
    const admin=await session('admin');const usage=await(await fetch(base+'/api/admin/ai/usage',{headers:{Authorization:`Bearer ${admin}`}})).json();assert.equal(usage.requests,2);
    assert.ok(store.db.prepare("SELECT id FROM audit_events WHERE action='ai.failed'").get());
  }finally{await new Promise<void>(r=>server.close(()=>r()));store.db.close();}
});

test('Azure API-key authentication is server-only, single-attempt and never leaks provider errors',async()=>{
 const apiKey='fictional-test-key-not-a-real-secret';let calls=0;
 const transport:typeof fetch=async(url,init)=>{calls++;assert.match(String(url),/^https:\/\/pilot\.openai\.azure\.com\//);const headers=init?.headers as Record<string,string>;assert.equal(headers['api-key'],apiKey);assert.equal(headers.Authorization,undefined);assert.equal(init?.redirect,'error');return new Response(JSON.stringify({model:reply.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply.result)}}],usage:{prompt_tokens:700,completion_tokens:80}}));};
 const model=new AzureDirectModel('https://pilot.openai.azure.com','mini',{apiKey},transport);
 assert.equal((await model.interpret(prepareAI(input()))).model,reply.model);assert.equal(calls,1);
 const bad=new AzureDirectModel('https://pilot.openai.azure.com','mini',{apiKey},async()=>{throw Error('provider error containing '+apiKey);});
 await assert.rejects(()=>bad.interpret(prepareAI(input())),error=>error instanceof Error&&!error.message.includes(apiKey)&&/unavailable/.test(error.message));
 assert.throws(()=>new AzureDirectModel('https://pilot.openai.azure.com','mini',{apiKey:'bad key'}),/secure server environment/);
 // A key alone cannot bypass model/pricing activation guards or turn on discovery.
 assert.throws(()=>configuredModel({ETALONOPS_AI_ENABLED:'true',ETALONOPS_AZURE_OPENAI_API_KEY:apiKey}));
 assert.equal(configuredModel({ETALONOPS_AI_ENABLED:'false',ETALONOPS_AZURE_OPENAI_API_KEY:apiKey}),undefined);
});
