import { draftFilters } from './draft-list';
import { catalogExportRoutes } from './catalog-export';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createAuth, type AuthOptions } from './auth';
import { ApiError, draftBody, type Principal } from './contracts';
import { aiRoutes } from './ai-routes';
import type { AIProvider } from './ai-provider';
import { imageRoutes } from './image-routes';
import type { ImageAssets } from './image-assets';
import { parseCatalog } from './catalog';
import type { Repository } from './repository';

export function createApp(store: Repository, authOptions: AuthOptions, services: { images?: ImageAssets; ai?: AIProvider } = {}) {
  const app = express(), auth = createAuth(authOptions), local = authOptions.mode === 'local';
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use((req, _res, next) => {
    if (local) {
      const host = req.hostname;
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return next(new ApiError(403, 'Local development API requires a loopback hostname.'));
      const origin = req.get('origin');
      if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):(5173|5174|4173|3001|3002)$/.test(origin)) return next(new ApiError(403, 'Origin not allowed.'));
    }
    next();
  });
  app.use(rateLimit({ windowMs: 60_000, limit: 1800, handler:(_req,res)=>{res.status(429).json({error:'Too many requests. Wait a minute before retrying.'});}, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', async (_req, res) => { await store.health(); res.json({ status: 'ok', engine: store.engine, microsoftSignIn: !local, release:'catalog-readiness-v9' }); });
  if (local) app.post('/api/dev/session', async (req, res) => {
    const { identity } = z.object({ identity: z.string() }).strict().parse(req.body);
    const token = await auth.issueLocal(identity);
    const principal = await auth.verify(token);
    await store.admit(principal,true);
    res.json({ token, identity, warning: 'Local test session only. Not Microsoft sign-in.' });
  });
  app.use('/api', async (req, res, next) => {
    try {
      const header = req.get('authorization');
      if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Sign in to access the API.');
      res.locals.principal = await store.admit(await auth.verify(header.slice(7)));
      next();
    } catch (error) { next(error); }
  });
  app.use('/api',rateLimit({windowMs:60_000,limit:600,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:(_req,res)=>`${res.locals.principal.tenant}/${res.locals.principal.oid}`,handler:(_req,res)=>{res.status(429).json({error:'Account request limit reached. Wait a minute before retrying.'});}}));
  const principal = (res: express.Response): Principal => res.locals.principal;
  catalogExportRoutes(app,store);
  imageRoutes(app,store,services.images);
  aiRoutes(app,store,services.ai);
  app.post('/api/admin/users/:action',async(req,res)=>res.json(await store.users(principal(res),req.params.action,req.body)));
  app.post('/api/submissions/:action',async(req,res)=>res.json(await store.submissions(principal(res),req.params.action,req.body)));
  app.post('/api/catalog/:action',async(req,res)=>res.json(await store.catalogCommand(principal(res),z.string().parse(req.params.action),req.body)));
  app.get('/api/me', async (_req, res) => res.json({ ...principal(res), mode: authOptions.mode }));
  app.get('/api/materials', async (req, res) => {
    const query = z.string().trim().min(1).max(2000).parse(req.query.q);
    res.json({ matches: await store.search(principal(res), query,z.enum(['riverside','northside']).optional().parse(req.query.projectId)) });
  });
  app.get('/api/projects/:project/draft', async (req, res) => res.json({ draft: await store.getProjectDraft(principal(res), req.params.project) }));
  app.get('/api/projects/:project/drafts',async(req,res)=>res.json(await store.listDrafts(principal(res),z.enum(['riverside','northside']).parse(req.params.project),z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page),draftFilters.parse({text:req.query.text,deliveryFrom:req.query.deliveryFrom,deliveryTo:req.query.deliveryTo}))));
  app.get('/api/drafts/:id', async (req, res) => res.json({ draft: await store.getDraft(principal(res), req.params.id) }));
  app.post('/api/drafts', async (req, res) => {
    const body = draftBody.parse(req.body);
    if (!local && body.lines.some(line => line.source.endsWith('_fixture'))) throw new ApiError(400, 'Demo fixtures cannot be saved in the cloud pilot.');
    res.status(201).json({ draft: await store.saveDraft(principal(res), body) });
  });
  app.put('/api/drafts/:id', async (req, res) => {
    const body = draftBody.parse(req.body);
    if (!local && body.lines.some(line => line.source.endsWith('_fixture'))) throw new ApiError(400, 'Demo fixtures cannot be saved in the cloud pilot.');
    res.json({ draft: await store.saveDraft(principal(res), body, req.params.id) });
  });
  app.get('/api/admin/imports', async (_req, res) => res.json({ batches: await store.listImports(principal(res)) }));
  app.post('/api/admin/imports/preview', async (req, res) => {
    const { csv } = z.object({ csv: z.string().max(800000) }).strict().parse(req.body);
    if(parseCatalog(csv).rows.some(row=>row.dataset_kind==='reviewed'))throw new ApiError(400,'Use structured imports for new real catalog materials so identity and manufacturer relationships are preserved.');
    const preview = await store.previewImport(principal(res), csv);
    res.json({ ...preview, records: parseCatalog(csv).rows });
  });
  app.post('/api/admin/imports/:id/apply', async (req, res) => {
    const { approval } = z.object({ approval: z.string() }).strict().parse(req.body);
    if(!local)throw new ApiError(400,'Use structured catalog imports for the cloud pilot.');
    res.json(await store.applyImport(principal(res), req.params.id, approval, local));
  });
  app.post('/api/admin/imports/:id/rollback', async (req, res) => res.json(await store.rollbackImport(principal(res), req.params.id)));
  app.get('/api/admin/catalog-snapshot.json', async (_req,res) => {
    const snapshot=await store.catalogCommand(principal(res),'export-snapshot',{});
    res.set('Cache-Control','no-store').type('application/json').attachment('etalonops-catalog-snapshot.json').send(JSON.stringify(snapshot,null,2));
  });
  app.get('/api/admin/catalog.csv', async (_req, res) => res.type('text/csv').attachment('etalonops-catalog.csv').send(await store.exportCsv(principal(res))));
  app.post('/api/admin/memberships', async (req, res) => {
    const p = principal(res); await store.requireAdmin(p);
    const body = z.object({ objectId: z.string().min(1).max(100), projectId: z.enum(['riverside', 'northside']) }).strict().parse(req.body);
    await store.member({ ...p, oid: body.objectId }, body.projectId); await store.audit(p, 'membership.granted', body.objectId); res.status(204).end();
  });
  app.use((_req, _res, next) => next(new ApiError(404, 'Not found.')));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid request.', fields: error.issues.map(issue => issue.path.join('.')) }); return; }
    if (error && typeof error === 'object' && 'number' in error) console.error('Database operation failed', { number: Number(error.number) });
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500;
    res.status(status === 413 ? 413 : status === 400 ? 400 : 500).json({ error: status === 413 ? 'Request too large.' : status === 400 ? 'Invalid JSON.' : 'The operation failed. Your on-screen draft has not been discarded.' });
  });
  return app;
}
