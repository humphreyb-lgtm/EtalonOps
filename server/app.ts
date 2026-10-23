import {normalizeImage} from './image-assets';
import {parseMaterialWorkbook} from './material-workbook';
import {materialsXlsx} from './material-workbook-xlsx';
import {documentRoutes} from './document-routes';
import {pdfRoutes} from './pdf-routes';
import {accountRoutes,managedAccountRoutes,sessionCookie} from './account-routes';
import {tokenHash} from './site-accounts';
import {researchRoutes} from './research-routes';
import type {ProductResearchProvider} from './azure-research';
import type {ResearchSource} from './research-source';
import {parseWorkbookUpload} from './catalog-workbook';
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

export function createApp(store: Repository, authOptions: AuthOptions, services: { images?: ImageAssets; ai?: AIProvider; research?:ProductResearchProvider; researchSourceLoader?:(url:string)=>Promise<ResearchSource> } = {}) {
  const app = express(), auth = createAuth(authOptions), local = authOptions.mode === 'local';
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:["'self'",'data:','blob:','https:']}}}));
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
  const cmsJson=express.json({limit:'5mb'});
  app.use((req,res,next)=>req.path.startsWith('/api/catalog/cms-')?cmsJson(req,res,next):next());
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', async (_req, res) => { await store.health(); res.json({ status: 'ok', engine: store.engine, microsoftSignIn: !local, release:'cms-suite-v49.4' }); });
  if (local) app.post('/api/dev/session', async (req, res) => {
    const { identity } = z.object({ identity: z.string() }).strict().parse(req.body);
    const token = await auth.issueLocal(identity);
    const principal = await auth.verify(token);
    await store.admit(principal,true);
    res.json({ token, identity, warning: 'Local test session only. Not Microsoft sign-in.' });
  });
  app.get('/api/public/cms',async(_req,res)=>res.json(await store.catalogCommand({tenant:authOptions.mode==='entra'?authOptions.tenant:'local-development',oid:'cms-public',roles:[]},'cms-public',{})));
  app.get('/api/cms/media/:id',async(req,res,next)=>{if(req.get('authorization')||sessionCookie(req))return next();try{const media=await store.catalogCommand({tenant:authOptions.mode==='entra'?authOptions.tenant:'local-development',oid:'cms-public',roles:[]},'cms-media-get',{id:req.params.id,public:true});res.type(media.mime).send(Buffer.from(media.content,'base64'));}catch(e){next(e);}});
  app.get('/api/public/appearance',async(_req,res)=>res.json(await store.catalogCommand({tenant:authOptions.mode==='entra'?authOptions.tenant:'local-development',oid:'appearance-reader',roles:[]},'appearance-public',{})));
  app.get('/api/public/design',async(_req,res)=>res.json(await store.catalogCommand({tenant:authOptions.mode==='entra'?authOptions.tenant:'local-development',oid:'design-reader',roles:[]},'design-get',{})));
  accountRoutes(app,store,authOptions.mode==='entra'?authOptions.tenant:'local-development',authOptions.mode==='entra');
  app.use('/api', async (req, res, next) => {
    try {
      const header = req.get('authorization');
      const cookie=sessionCookie(req);
      if(header?.startsWith('Bearer '))res.locals.principal=await store.admit(await auth.verify(header.slice(7)));
      else if(cookie){if(!['GET','HEAD'].includes(req.method)&&req.get('x-etalonops-request')!=='1')throw new ApiError(403,'Request header required.');res.locals.principal=await store.admit(await store.account(authOptions.mode==='entra'?authOptions.tenant:'local-development','session',{hash:tokenHash(cookie)}));}
      else throw new ApiError(401,'Sign in to access the API.');
      next();
    } catch (error) { next(error); }
  });
  app.use('/api',rateLimit({windowMs:60_000,limit:600,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:(_req,res)=>`${res.locals.principal.tenant}/${res.locals.principal.oid}`,handler:(_req,res)=>{res.status(429).json({error:'Account request limit reached. Wait a minute before retrying.'});}}));
  const principal = (res: express.Response): Principal => res.locals.principal;
  app.get('/api/cms/media/:id',async(req,res)=>{const media=await store.catalogCommand(principal(res),'cms-media-get',{id:req.params.id});res.type(media.mime).send(Buffer.from(media.content,'base64'));});
  app.post('/api/cms/media',(_req,res,next)=>{if(!principal(res).roles.includes('Admin'))return next(new ApiError(403,'System administrator access required.'));next();},express.raw({type:()=>true,limit:'5mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body))throw new ApiError(400,'Upload an image file.');const image=await normalizeImage(req.body);let name='Image';try{name=decodeURIComponent(req.get('x-cms-filename')??'Image').slice(0,200);}catch{throw new ApiError(400,'Invalid image filename.');}res.json(await store.catalogCommand(principal(res),'cms-media-put',{id:crypto.randomUUID(),name,mime:'image/webp',content:image.bytes.toString('base64')}));});
  managedAccountRoutes(app,store);
  catalogExportRoutes(app,store);
  imageRoutes(app,store,services.images);pdfRoutes(app,store,services.images);documentRoutes(app,store,services.images);
  aiRoutes(app,store,services.ai);
  researchRoutes(app,store,services.research,services.researchSourceLoader);
  app.get('/api/admin/material-workbook.xlsx',async(req,res)=>{const p=principal(res);if(!p.roles.includes('Admin'))throw new ApiError(403,'Administrator role required.');const data=req.query.empty==='1'?{rows:[]}:await store.catalogCommand(p,'material-workbook-export',{});res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('EtalonOps-Materials.xlsx').send(materialsXlsx(data.rows));});
  app.post('/api/admin/material-workbook',(_req,res,next)=>{if(!principal(res).roles.includes('Admin'))return next(new ApiError(403,'Administrator role required.'));next();},express.raw({type:'application/octet-stream',limit:'3mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body))throw new ApiError(400,'Upload an XLSX file.');const mode=z.enum(['preview','stage','apply']).parse(req.query.mode??'preview');let filename:string;try{filename=decodeURIComponent(req.get('x-catalog-filename')??'Materials.xlsx');}catch{throw new ApiError(400,'Invalid filename.');}if(!filename.toLowerCase().endsWith('.xlsx'))throw new ApiError(400,'Use an .xlsx workbook.');const rows=await parseMaterialWorkbook(req.body);res.json(await store.catalogCommand(principal(res),'material-workbook-'+mode,{filename,rows,...(req.get('x-preview-hash')?{previewHash:req.get('x-preview-hash')}:{})}));});
  app.post('/api/admin/catalog-upload',(_req,res,next)=>{if(!principal(res).roles.includes('Admin'))return next(new ApiError(403,'Administrator role required.'));next();},express.raw({type:'application/octet-stream',limit:'3mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body))throw new ApiError(400,'Upload the workbook as a file.');let filename:string;try{filename=decodeURIComponent(req.get('x-catalog-filename')??'');}catch{throw new ApiError(400,'Invalid filename.');}const {ignoredSheets,...payload}=await parseWorkbookUpload(filename,req.body);res.json({...await store.catalogCommand(principal(res),'inbox-stage',payload),ignoredSheets});});
  app.post('/api/admin/users/:action',async(req,res)=>res.json(await store.users(principal(res),req.params.action,req.body)));
  app.post('/api/submissions/:action',async(req,res)=>res.json(await store.submissions(principal(res),req.params.action,req.body)));
  app.post('/api/catalog/:action',async(req,res)=>res.json(await store.catalogCommand(principal(res),z.string().parse(req.params.action),req.body)));
  app.get('/api/projects/:projectId/foremen',async(req,res)=>res.json(await store.users(principal(res),'foremen',{projectId:req.params.projectId})));
  app.get('/api/jobs',async(_req,res)=>res.json(await store.users(principal(res),'assigned-jobs',{})));
  app.get('/api/me', async (_req, res) => res.json({ ...principal(res), mode: authOptions.mode }));
  app.get('/api/materials', async (req, res) => {
    const query = z.string().trim().min(1).max(2000).parse(req.query.q);
    res.json({ matches: await store.search(principal(res), query,z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/).optional().parse(req.query.projectId)) });
  });
  app.get('/api/projects/:project/draft', async (req, res) => res.json({ draft: await store.getProjectDraft(principal(res), req.params.project) }));
  app.get('/api/projects/:project/drafts',async(req,res)=>res.json(await store.listDrafts(principal(res),z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/).parse(req.params.project),z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page),draftFilters.parse({text:req.query.text,deliveryFrom:req.query.deliveryFrom,deliveryTo:req.query.deliveryTo}))));
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
  app.post('/api/admin/memberships', async (_req, res) => {
    const p = principal(res); await store.requireAdmin(p);
    throw new ApiError(409,'Use User administration to assign job roles and reporting relationships.');
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
