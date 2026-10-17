import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createAuth, type AuthOptions } from './auth';
import { ApiError, draftBody, type Principal } from './contracts';
import type { Repository } from './repository';

export function createApp(store: Repository, authOptions: AuthOptions) {
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
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', async (_req, res) => { await store.health(); res.json({ status: 'ok', engine: store.engine, microsoftSignIn: false }); });
  if (local) app.post('/api/dev/session', async (req, res) => {
    const { identity } = z.object({ identity: z.string() }).strict().parse(req.body);
    const token = await auth.issueLocal(identity);
    const principal = await auth.verify(token);
    await store.member(principal, 'riverside'); await store.member(principal, 'northside');
    res.json({ token, identity, warning: 'Local test session only. Not Microsoft sign-in.' });
  });
  app.use('/api', async (req, res, next) => {
    try {
      const header = req.get('authorization');
      if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Sign in to access the API.');
      res.locals.principal = await auth.verify(header.slice(7));
      next();
    } catch (error) { next(error); }
  });
  const principal = (res: express.Response): Principal => res.locals.principal;
  app.get('/api/me', async (_req, res) => res.json({ ...principal(res), mode: authOptions.mode }));
  app.get('/api/materials', async (req, res) => {
    const query = z.string().trim().min(1).max(200).parse(req.query.q);
    res.json({ matches: await store.search(principal(res), query) });
  });
  app.get('/api/projects/:project/draft', async (req, res) => res.json({ draft: await store.getProjectDraft(principal(res), req.params.project) }));
  app.get('/api/drafts/:id', async (req, res) => res.json({ draft: await store.getDraft(principal(res), req.params.id) }));
  app.post('/api/drafts', async (req, res) => res.status(201).json({ draft: await store.saveDraft(principal(res), draftBody.parse(req.body)) }));
  app.put('/api/drafts/:id', async (req, res) => res.json({ draft: await store.saveDraft(principal(res), draftBody.parse(req.body), req.params.id) }));
  app.post('/api/admin/imports/preview', async (req, res) => {
    const { csv } = z.object({ csv: z.string().max(800000) }).strict().parse(req.body);
    res.json(await store.previewImport(principal(res), csv));
  });
  app.post('/api/admin/imports/:id/apply', async (req, res) => {
    const { approval } = z.object({ approval: z.string() }).strict().parse(req.body);
    res.json(await store.applyImport(principal(res), req.params.id, approval, local));
  });
  app.post('/api/admin/imports/:id/rollback', async (req, res) => res.json(await store.rollbackImport(principal(res), req.params.id)));
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
