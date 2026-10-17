import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Bundle the same React application into one offline review file. No CDN assets.
const built = await build({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false,
    cssCodeSplit: false,
    lib: { entry: 'src/main.tsx', name: 'EtalonOpsPreview', formats: ['iife'] },
    rollupOptions: { input: 'src/main.tsx', output: { inlineDynamicImports: true } },
  },
});
const files = (Array.isArray(built) ? built : [built]).flatMap(result => result.output);
const code = files.filter(file => file.type === 'chunk').map(file => file.code).join('\n');
const css = files.filter(file => file.type === 'asset' && file.fileName.endsWith('.css')).map(file => String(file.source)).join('\n');
if (!code || !css) throw new Error('Preview build did not produce JavaScript and CSS.');
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f7f9fc"><title>EtalonOps · Interactive local preview</title><style>${css}</style></head>
<body><div id="root"></div><script>${code.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/EtalonOps-preview.html', html);
console.log(`Offline preview written: artifacts/EtalonOps-preview.html (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
