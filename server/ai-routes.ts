import type express from 'express';
import { ApiError,type Principal } from './contracts';
import type { Repository } from './repository';
import { lookupInput,prepareAI,validateModelReply,type AIProvider } from './ai-provider';
import { aiLimits } from './ai-policy';
export function aiRoutes(app:express.Express,store:Repository,provider?:AIProvider){
  app.get('/api/lookup/status',(_req,res)=>res.json({enabled:Boolean(provider),discoveryAvailable:false,limits:aiLimits}));
  app.get('/api/admin/ai/usage',async(_req,res)=>res.json({...await store.aiUsage(res.locals.principal),enabled:Boolean(provider)}));
  app.post('/api/lookup/clarify',async(req,res)=>{
    const p:Principal=res.locals.principal;
    if(!provider)throw new ApiError(503,'Live AI is disabled. Your clarification details can still be kept with Use My Description.');
    const input=lookupInput.parse(req.body),prepared=prepareAI(input);
    await store.reserveAI(p,input.projectId,input.sessionId,input.turnId);
    try{
      const reply=await provider.interpret(prepared);
      const validated=validateModelReply(prepared,reply);
      await store.audit(p,'ai.used',`${input.turnId}:${reply.inputTokens}:${reply.outputTokens}`);
      res.json(validated);
    }catch(error){await store.audit(p,'ai.failed',input.turnId);if(error instanceof ApiError)throw error;throw new ApiError(502,'AI is unavailable. Your details are retained; use My Description.');}
  });
}
