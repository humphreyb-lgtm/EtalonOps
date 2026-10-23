// Wrap native content surfaces while retaining their original native tag, props,
// refs, event handlers and conditional React children. A repeat run audits coverage.
import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const inventory=[];const dependencies={};
const layoutTags=['main','dialog','form','section','aside','header','nav','footer'];
const ignored=new Set(['AppearanceStudio.tsx','AppearanceWorkspace.tsx','main.tsx']);
for(const file of readdirSync('src').filter(f=>f.endsWith('.tsx')&&!f.startsWith('Cms')&&!ignored.has(f))){
 const text=readFileSync('src/'+file,'utf8');const reservedIds=new Set([...text.matchAll(/surfaceId="([^"]+)"/g)].map(m=>m[1]));const allocateId=base=>{let candidate=base,index=1;while(reservedIds.has(candidate))candidate=base+'-'+index++;reservedIds.add(candidate);return candidate;};const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];let counter=0,wrapped=false;
 const imports=new Map();for(const n of source.statements)if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('./')){const target=n.moduleSpecifier.text.slice(2)+'.tsx';if(target.startsWith('Cms')||target==='AppearanceStudio.tsx')continue;if(n.importClause?.name)imports.set(n.importClause.name.text,target);const bindings=n.importClause?.namedBindings;if(bindings&&ts.isNamedImports(bindings))for(const b of bindings.elements)imports.set(b.name.text,target);}dependencies[file]=[];const renderDeps=n=>{if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const dep=imports.get(n.tagName.getText(source));if(dep&&!dependencies[file].includes(dep))dependencies[file].push(dep);}ts.forEachChild(n,renderDeps);};renderDeps(source);
 const attrs=el=>el.attributes.properties;
 const literal=(el,name)=>{const a=attrs(el).find(a=>ts.isJsxAttribute(a)&&a.name.text===name);return a?.initializer&&ts.isStringLiteral(a.initializer)?a.initializer.text:'';};
 const hint=node=>{if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){const el=ts.isJsxElement(node)?node.openingElement:node;const label=literal(el,'aria-label')||literal(el,'aria-labelledby')||literal(el,'className');if(label)return label;return el.tagName.getText(source);}let found='';node.forEachChild(c=>{if(!found)found=hint(c);});return found;};
 const safe=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45);
 const visit=node=>{
 if(ts.isJsxElement(node)){
 const tag=node.openingElement.tagName.getText(source);const existing=tag==='CmsSurface';
 if(existing||[...layoutTags,'h1','h2','h3','h4','h5','h6','p','label','button','a','summary','legend','small','strong','span','AppearanceWorkspace'].includes(tag)){
  const index=counter++;const id=existing?literal(node.openingElement,'surfaceId'):allocateId(safe(file.replace('.tsx',''))+'-'+(tag==='AppearanceWorkspace'?'main':tag)+'-'+index);
  const kind=existing?literal(node.openingElement,'as'):(tag==='AppearanceWorkspace'?'main':tag);const title=hint(node)||file;
  const access=file==='LoginPage.tsx'?'public':['App.tsx','SubmissionCenter.tsx','PurchasingFields.tsx','ProductPhoto.tsx','CompanyLogo.tsx','ResultDetails.tsx','SearchFilters.tsx'].includes(file)?'authenticated':file==='UserAdmin.tsx'?'company':'admin';
  const slots=[];const reservedSlots=new Set(node.children.filter(c=>ts.isJsxElement(c)&&c.openingElement.tagName.getText(source)==='CmsSource').map(c=>literal(c.openingElement,'slot')));const allocateSlot=base=>{let candidate=base,index=1;while(reservedSlots.has(candidate))candidate=base+'-'+index++;reservedSlots.add(candidate);return candidate;};
  let slotIndex=0;for(const child of node.children){if(ts.isJsxText(child)&&!child.text.trim()&&(!child.text||/[\r\n]/.test(child.text)))continue;
   if(ts.isJsxElement(child)&&child.openingElement.tagName.getText(source)==='CmsSource'){const meaningful=child.children.filter(c=>!ts.isJsxText(c)||c.text.trim());const editable=literal(child.openingElement,'editableText')==='true'||meaningful.length===1&&(ts.isJsxText(meaningful[0])&&!!meaningful[0].text.trim()||ts.isJsxExpression(meaningful[0])&&meaningful[0].expression&&ts.isStringLiteral(meaningful[0].expression));const body=meaningful[0];const rendered=body&&(ts.isJsxElement(body)||ts.isJsxSelfClosingElement(body))?(ts.isJsxElement(body)?body.openingElement:body):undefined;const renderTag=rendered?(rendered.tagName.getText(source)==='CmsSurface'?literal(rendered,'as'):rendered.tagName.getText(source)):'';const value=body&&ts.isJsxText(body)?body.text:body&&ts.isJsxExpression(body)&&body.expression&&ts.isStringLiteral(body.expression)?body.expression.text:undefined;slots.push({id:literal(child.openingElement,'slot'),title:literal(child.openingElement,'title'),editableText:!!editable,renderTag,previewText:value});if(editable&&!literal(child.openingElement,'editableText'))edits.push({at:child.openingElement.end-1,end:child.openingElement.end-1,text:' editableText="true"'});slotIndex++;continue;}
   const name=(ts.isJsxText(child)?child.text.trim().slice(0,60):hint(child))||'Content';const slot=allocateSlot('s'+slotIndex+++'-'+safe(name));const editableText=ts.isJsxText(child)&&!!child.text.trim()||ts.isJsxExpression(child)&&child.expression&&ts.isStringLiteral(child.expression);
   slots.push({id:slot,title:name,editableText:!!editableText});edits.push({at:child.pos,end:child.pos,kind:'open',text:`<CmsSource slot="${slot}" title=${JSON.stringify(name)} editableText="${!!editableText}">`},{at:child.end,end:child.end,kind:'close',text:'</CmsSource>'});
  }
  const words=[];const textNodes=n=>{if(ts.isJsxText(n)&&n.text.trim())words.push(n.text.trim());else ts.forEachChild(n,textNodes);};node.children.forEach(textNodes);const readable=!layoutTags.includes(kind)&&words.join(' ').trim()?words.join(' ').replace(/\s+/g,' ').slice(0,100):'';
  const screen=kind==='main'&&file==='LoginPage.tsx'?'Sign-in':kind==='main'&&file==='App.tsx'?(title==='resume-page'?'Session resume':'MRF Builder'):kind==='dialog'?({'AdminWorkspace.tsx':'Administration','CatalogAdmin.tsx':'Catalog administration','UserAdmin.tsx':'User administration','SubmissionCenter.tsx':'MRF review and submission'}[file]||(title==='edit-title'?'Edit MRF item':title==='confirm-title'?'MRF confirmation':title)):'';
  inventory.push({id,title:screen||readable||(existing?(literal(node.openingElement,'surfaceTitle')||literal(node.openingElement,'title')||title):title),file,kind,access,classes:literal(node.openingElement,'className'),domId:literal(node.openingElement,'id'),slots});
  if(existing){const old=attrs(node.openingElement).find(a=>ts.isJsxAttribute(a)&&a.name.text==='title');if(old&&!literal(node.openingElement,'surfaceTitle'))edits.push({at:old.name.getStart(source),end:old.name.end,text:'surfaceTitle'});}
  if(!existing){wrapped=true;edits.push({at:node.openingElement.tagName.getStart(source),end:node.openingElement.tagName.end,text:`CmsSurface as="${kind}" surfaceId="${id}" surfaceTitle=${JSON.stringify(title)}`},{at:node.closingElement.tagName.getStart(source),end:node.closingElement.tagName.end,text:'CmsSurface'});}
 }
 }
 ts.forEachChild(node,visit);
 };visit(source);
 if(edits.length){let out=text;for(const e of edits.sort((a,b)=>b.at-a.at||b.end-a.end||(a.kind==='open'?-1:b.kind==='open'?1:0)))out=out.slice(0,e.at)+e.text+out.slice(e.end);if(wrapped&&!text.includes("from './CmsSurface'"))out="import {CmsSurface,CmsSource} from './CmsSurface';\n"+out;writeFileSync('src/'+file,out);}
}
writeFileSync('src/cms-inventory.ts','// Generated by scripts/register-cms-surfaces.mjs; native surface inventory.\nexport const cmsSurfaces='+JSON.stringify(inventory,null,1)+';\nexport const cmsRenderDependencies='+JSON.stringify(dependencies,null,1)+';\n');
console.log(`Registered ${inventory.length} native page, modal, form and section surfaces.`);
