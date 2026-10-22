import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {cmsSchema,validateCms,compileCms} from './cms';
import {defaultCmsSite,cmsNode,allNodes,cmsModuleHref} from '../src/cms-model';
import {cmsSurfaces} from '../src/cms-inventory';
test('CMS inventory covers every existing native page, dialog, form and content section',()=>{
 const required=new Set(['main','dialog','form','section','aside','header','nav','footer']);const ids=new Set(cmsSurfaces.map(s=>s.id));assert.equal(ids.size,cmsSurfaces.length);assert.equal(cmsSurfaces.filter(s=>s.kind==='dialog').length,7);
 for(const file of readdirSync('src').filter(f=>f.endsWith('.tsx')&&!f.startsWith('Cms')&&!['AppearanceStudio.tsx','AppearanceWorkspace.tsx','main.tsx'].includes(f))){const source=ts.createSourceFile(file,readFileSync('src/'+file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const visit=(node:ts.Node)=>{if(ts.isJsxElement(node)){const tag=node.openingElement.tagName.getText(source);assert.ok(!required.has(tag),`${file}: unregistered ${tag}`);if(tag==='CmsSurface'){const id=node.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==='surfaceId') as ts.JsxAttribute;for(const child of node.children.filter(c=>!ts.isJsxText(c)||!!c.text.trim()||!/[\r\n]/.test(c.text))){assert.ok(ts.isJsxElement(child)&&child.openingElement.tagName.getText(source)==='CmsSource',file+' has an unbound native child.');}assert.ok(id&&id.initializer&&ts.isStringLiteral(id.initializer)&&ids.has(id.initializer.text),file+' has an unknown surface.');}}ts.forEachChild(node,visit);};visit(source);}
 assert.ok(cmsSurfaces.some(s=>s.kind==='label'&&s.slots.some(s=>s.editableText)));assert.doesNotThrow(()=>validateCms(defaultCmsSite()));
});
test('CMS rejects missing native bindings, cyclic symbols, duplicate IDs and broken navigation',()=>{
 const initial=defaultCmsSite();const p=initial.pages.find(p=>p.kind==='page')!;const site=structuredClone(initial);const native=site.pages.find(p=>p.kind==='surface'&&p.root.children.length)!;native.root.children=[];assert.throws(()=>validateCms(site),/Keep exactly one/);
 const cycle=structuredClone(initial);cycle.symbols=[{id:'cycle',name:'Cycle',root:cmsNode('container',{children:[cmsNode('symbol',{symbol:'cycle'})]})}];assert.throws(()=>validateCms(cycle),/cycle/);
 const broken=structuredClone(initial);broken.navigation.push({id:'bad',label:'Broken',pageId:'missing',roles:[],newTab:false,children:[]});assert.throws(()=>validateCms(broken),/navigation link/);
 const duplicate=structuredClone(initial);duplicate.pages.find(v=>v.id===p.id)!.root.children.push(duplicate.pages.find(v=>v.id===p.id)!.root.children[0]);assert.throws(()=>validateCms(duplicate),/duplicate element/);
 const recursive=structuredClone(initial);const own=recursive.pages.find(p=>p.kind==='surface'&&cmsSurfaces.find(s=>s.id===p.id)?.file==='MaterialTable.tsx'&&cmsSurfaces.find(s=>s.id===p.id)?.kind==='section')!;own.root.children.push(cmsNode('module',{module:'materials'}));assert.throws(()=>validateCms(recursive),/recursively contain itself/);
 const depth=structuredClone(initial);let root=depth.pages.find(v=>v.id===p.id)!.root;for(let i=0;i<20;i++){const n=cmsNode('container');root.children.push(n);root=n;}assert.throws(()=>validateCms(depth),/deeply nested/);
});
test('CMS provides scoped custom CSS, responsive properties, nested element and interaction styles',()=>{
 const site=defaultCmsSite();const p=site.pages.find(p=>p.kind==='page')!;p.root.styles={desktop:{paddingTop:2,display:'grid',gridTemplateColumns:'1fr 1fr'},mobile:{gridTemplateColumns:'1fr'}};p.root.hover={desktop:{backgroundColor:'#abcdef'}};p.root.targets={'& input':{styles:{desktop:{paddingTop:0,height:22}},focus:{mobile:{borderColor:'#123456'}}}};p.css='& h2:hover { font-size: 22px; } @media(max-width:500px) { input { padding:0; } }';site.globalStyles={'input, select, textarea':{styles:{desktop:{paddingTop:0,paddingBottom:0}},hover:{mobile:{borderColor:'#112233'}}}};site.css=':root { --accent: #123456; } a:focus-visible { color: var(--accent); }';const css=compileCms(validateCms(site));assert.match(css,/data-cms-document/);assert.match(css,/not\(\[data-cms-editor\]/);assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/input:focus-visible/);assert.match(css,/height:22px!important/);assert.match(css,/height:auto!important/);assert.match(css,/--accent/);const fonts=structuredClone(site);fonts.css='@font-face {font-family: Crew;src:url(https://example.com/crew.woff2)}';const fontCss=compileCms(validateCms(fonts));assert.match(fontCss,/font-family: Crew;/);assert.ok(!fontCss.includes('font-family: Crew!important'));
 for(const unsafe of ['@import "https://evil.invalid/a.css";','p { width:expression(1); }','p{background:url(javascript:alert(1))}','p{behavior: url(test)}','<style>bad']){const next=structuredClone(site);next.css=unsafe;assert.throws(()=>validateCms(next));}
 const syntax=structuredClone(site);syntax.css='p {';assert.throws(()=>validateCms(syntax),/syntax/);
});
test('CMS sanitizes rich content and rejects unsafe destinations without altering business data fields',()=>{
 const site=defaultCmsSite();const p=site.pages.find(p=>p.kind==='page')!;p.root.children.push(cmsNode('richtext',{text:'<p>Hello <strong>crew</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a></p>'}));const result=validateCms(site);const rich=allNodes(result.pages.find(v=>v.id===p.id)!.root).find(n=>n.type==='richtext')!;assert.match(rich.text!,/strong/);assert.ok(!/script|onerror|javascript:|<img/.test(rich.text!));
 const invalid=structuredClone(site);invalid.navigation.push({id:'badurl',label:'Unsafe',href:'javascript:alert(1)',roles:[],newTab:false,children:[]});assert.equal(cmsSchema.safeParse(invalid).success,false);
});

test('CMS operational links follow renamed pages and reusable module placements',()=>{
 const site=defaultCmsSite();site.pages.find(p=>p.id==='page-images')!.slug='company-photos';assert.equal(cmsModuleHref(site,'images'),'/pages/company-photos');site.pages=site.pages.filter(p=>p.id!=='page-images');assert.equal(cmsModuleHref(site,'images'),undefined);site.symbols.push({id:'photos',name:'Photos',root:cmsNode('module',{module:'images'})});site.pages.find(p=>p.kind==='page')!.root.children.push(cmsNode('symbol',{symbol:'photos'}));assert.ok(cmsModuleHref(site,'images'));
});
