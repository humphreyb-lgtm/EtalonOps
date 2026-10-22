import {cmsSurfaces} from './cms-inventory';
import type {Properties} from './appearance';
export const cmsNodeTypes=['container','heading','text','richtext','image','link','button','divider','module','symbol','navigation'] as const;
export type CmsStyle={desktop?:Properties;tablet?:Properties;mobile?:Properties};
export type CmsNode={id:string;type:typeof cmsNodeTypes[number];name:string;text?:string;href?:string;src?:string;alt?:string;level?:number;module?:string;symbol?:string;classes?:string;styles?:CmsStyle;hover?:CmsStyle;focus?:CmsStyle;disabled?:CmsStyle;css?:string;targets?:Record<string,{styles?:CmsStyle;hover?:CmsStyle;focus?:CmsStyle;disabled?:CmsStyle}>;children:CmsNode[]};
export type CmsPage={id:string;title:string;slug:string;kind:'page'|'surface';visibility:'public'|'authenticated'|'roles';roles:string[];enabled:boolean;shell?:'standard'|'blank';root:CmsNode;css:string;description:string};
export type CmsSymbol={id:string;name:string;root:CmsNode};
export type CmsLink={id:string;label:string;pageId?:string;href?:string;roles:string[];children:CmsLink[];newTab:boolean};
export type CmsVariants={styles?:CmsStyle;hover?:CmsStyle;focus?:CmsStyle;disabled?:CmsStyle};
export type CmsSite={globalStyles?:Record<string,CmsVariants>;pages:CmsPage[];symbols:CmsSymbol[];navigation:CmsLink[];css:string};
export type CmsVersion={version:number;at:string;by:string;site:CmsSite};
export type CmsResponse={draft:CmsSite;published:CmsSite;history:CmsVersion[];version:number;css:string};
export const cmsModules=[['mrf-builder','MRF Builder','authenticated'],['materials','Materials','admin'],['workbook','Material workbook imports','admin'],['users','Users, companies and jobs','company'],['catalog','Catalog and imports','admin'],['inbox','Publication review','admin'],['research','Product research','admin'],['images','Product images','admin'],['readiness','Catalog readiness','admin'],['manual','Manual entry review','admin'],['pdf','PDF template builder','admin'],['status','Pilot status','admin'],['restrictions','Job restrictions','admin'],['usage','AI usage','admin'],['text-styles','Global text styles','admin']] as const;
export function cmsNode(type:CmsNode['type'],extra:Partial<CmsNode>={}):CmsNode{return {id:'n_'+crypto.randomUUID(),type,name:type,children:[],...extra};}
export function findNode(root:CmsNode,id:string):CmsNode|undefined{if(root.id===id)return root;for(const child of root.children){const found=findNode(child,id);if(found)return found;}}
export function removeNode(root:CmsNode,id:string):CmsNode|undefined{const index=root.children.findIndex(n=>n.id===id);if(index>=0)return root.children.splice(index,1)[0];for(const child of root.children){const result=removeNode(child,id);if(result)return result;}}
export function cloneNode(node:CmsNode):CmsNode{const next=structuredClone(node);const renew=(n:CmsNode)=>{n.id='n_'+crypto.randomUUID();n.children.forEach(renew);};renew(next);return next;}
export function canViewPage(page:CmsPage,roles:string[],signedIn:boolean){return page.enabled&&(roles.includes('Admin')||page.visibility==='public'||signedIn&&(page.visibility==='authenticated'||page.roles.some(r=>roles.includes(r))));}
export function sourceDocument(surface:typeof cmsSurfaces[number]):CmsPage{
 return {id:surface.id,title:surface.title,slug:'',kind:'surface',visibility:surface.access==='public'?'public':surface.access==='admin'||surface.access==='company'?'roles':'authenticated',roles:surface.access==='company'?['Admin','CompanyAdmin']:surface.access==='admin'?['Admin']:[],enabled:true,description:'Built-in '+surface.kind+' from '+surface.file,css:'',root:{id:'root_'+surface.id,type:'container',name:surface.title,children:surface.slots.map(s=>({id:surface.id+'_'+s.id,type:'module',name:s.title,module:'source:'+s.id,children:[]}))}};
}
export function defaultCmsSite():CmsSite{
 const pages=cmsSurfaces.map(sourceDocument);
 const add=(id:string,title:string,slug:string,module:string,access:string)=>pages.push({id,title,slug,kind:'page',visibility:access==='authenticated'?'authenticated':'roles',roles:access==='company'?['Admin','CompanyAdmin']:['Admin'],enabled:true,description:'',css:'',root:{id:'root_'+id,type:'container',name:title,children:[{id:id+'_module',type:'module',name:title,module,children:[]}]}});
 for(const [key,title,access] of cmsModules)if(key!=='mrf-builder')add('page-'+key,title,key,key,access);
 pages.push({id:'page-home',title:'Home',slug:'home',kind:'page',visibility:'authenticated',roles:[],enabled:true,description:'EtalonOps workspace',css:'',root:{id:'root_home',type:'container',name:'Home',children:[{id:'home_title',type:'heading',name:'Welcome',text:'Your materials workflow',level:1,children:[]},{id:'home_text',type:'text',name:'Introduction',text:'Build material requests and manage your assigned jobs.',children:[]},{id:'home_mrf',type:'button',name:'Open MRF Builder',text:'Open MRF Builder',href:'/',children:[]}]}});
 return {pages,symbols:[],css:'',navigation:[{id:'nav-home',label:'Home',pageId:'page-home',roles:[],newTab:false,children:[]},{id:'nav-mrf',label:'MRF Builder',href:'/',roles:[],newTab:false,children:[]},{id:'nav-materials',label:'Materials',pageId:'page-materials',roles:['Admin'],newTab:false,children:[]}]};
}
export function allNodes(root:CmsNode):CmsNode[]{return [root,...root.children.flatMap(allNodes)];}
export const cmsHref=(page:CmsPage)=>'/pages/'+encodeURIComponent(page.slug);

export function cmsModuleHref(site:CmsSite,module:string):string|undefined{
 const has=(root:CmsNode,seen=new Set<string>()):boolean=>allNodes(root).some(n=>n.module===module||!!(n.symbol&&!seen.has(n.symbol)&&(seen.add(n.symbol),site.symbols.find(s=>s.id===n.symbol))&&has(site.symbols.find(s=>s.id===n.symbol)!.root,seen)));
 const page=site.pages.find(p=>p.kind==='page'&&p.enabled&&has(p.root));return page?cmsHref(page):undefined;
}
