import type {ProductResearchProvider} from './azure-research';
import type {ResearchSource} from './research-source';
import express from 'express';
import helmet from 'helmet';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import type { AIProvider } from './ai-provider';
import type { ImageAssets } from './image-assets';
import type { Repository } from './repository';

export function createCloudApp(store: Repository, config: { tenant: string; clientId: string }, hostname: string, services: { images?: ImageAssets; ai?: AIProvider; research?:ProductResearchProvider; researchSourceLoader?:(url:string)=>Promise<ResearchSource> } = {}) {
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // App Service's single front-end hop; rate limit still uses authenticated API guards.
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  connectSrc: ["'self'", `https://login.microsoftonline.com`], frameSrc: ['https://login.microsoftonline.com'],
  imgSrc: ["'self'", 'blob:', 'https:'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"],
} }, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.get('/runtime-config.js', (_req, res) => res.set('Cache-Control', 'no-store').type('application/javascript').send(`window.__ETALONOPS_CONFIG__=${JSON.stringify({ tenant: config.tenant, clientId: config.clientId })};`));
app.use('/api', (req, _res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.get('origin');
    const expected = `https://${hostname}`;
    if (origin && origin !== expected) { _res.status(403).json({ error: 'Origin not allowed.' }); return; }
  }
  next();
});
// Keep API middleware mounted at root so its /api paths retain their meaning.
app.use((req, res, next) => req.path.startsWith('/api/') ? api(req, res, next) : next());
const api = createApp(store, { mode: 'entra', tenant: config.tenant, audience: config.clientId }, services);
api.set('trust proxy', 1);
const index = readFileSync(resolve('dist/index.html'), 'utf8').replace('</head>', '<script src="/runtime-config.js"></script></head>');
app.use(express.static(resolve('dist'), { index: false, dotfiles: 'deny', maxAge: '1h' }));
app.get('/', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(index));
app.use((_req, res) => res.status(404).end());
return app;
}
