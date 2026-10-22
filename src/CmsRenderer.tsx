import {cmsSurfaces} from './cms-inventory';
import {CmsNavigation} from './CmsNavigation';
import {safeCmsHtml} from './cms-html';
import {CmsSurface} from './CmsSurface';
import {Children,cloneElement,createElement,isValidElement,Fragment,useEffect,useState,type ReactNode} from 'react';
import {useCms} from './CmsContext';
import {CmsModule} from './CmsModules';
import {imageBlob} from './api';
import type {CmsNode,CmsPage} from './cms-model';
function CmsImage({src,alt,...props}:{src:string;alt:string;[key:string]:unknown}){const {signedIn}=useCms();const [url,setUrl]=useState(src);useEffect(()=>{if(!src.startsWith('/api/cms/media/')){setUrl(src);return;}let alive=true,owned='';const load=async()=>{try{const blob=signedIn?await imageBlob(src.slice(4)):await(await fetch(src)).blob();if(alive){owned=URL.createObjectURL(blob);setUrl(owned);}}catch{setUrl('');}};void load();return()=>{alive=false;if(owned)URL.revokeObjectURL(owned);};},[src,signedIn]);return url?<img {...props} src={url} alt={alt}/>:<span {...props}>{alt||'Image unavailable'}</span>;}
// Keep native lists and fragments transparent to flex/grid and direct-child CSS.
// Attaching the source token to each real element preserves layout and picking.
function sourceContent(content:ReactNode,props:{'data-cms-node':string;className:string}):ReactNode{
 if(content===null||content===undefined||typeof content==='boolean')return null;
 if(Array.isArray(content))return Children.map(content,child=>sourceContent(child,props));
 if(isValidElement<Record<string,unknown>>(content)){
  if(content.type===Fragment)return <Fragment>{Children.map(content.props.children as ReactNode,child=>sourceContent(child,props))}</Fragment>;
  if(typeof content.type==='string'||content.type===CmsSurface)return cloneElement(content,{...props,className:String(content.props.className??'')+' '+props.className});
 }
 return <span {...props} className={props.className+' cms-native-source'}>{content}</span>;
}
export function CmsNodes({nodes,sources={},depth=0}:{nodes:CmsNode[];sources?:Record<string,ReactNode>;depth?:number}){return <>{nodes.map(node=><CmsBlock key={node.id} node={node} sources={sources} depth={depth}/>)}</>;}
function CmsBlock({node,sources,depth}:{node:CmsNode;sources:Record<string,ReactNode>;depth:number}){
 const {site}=useCms();if(depth>20)return null;const props={'data-cms-node':node.id,className:'cms-block cms-'+node.type+(node.classes?' '+node.classes:'')};
 if(node.type==='module'){if(node.module?.startsWith('source:')){const missing=!(node.module in sources);const surface=missing?cmsSurfaces.find(s=>node.id.startsWith(s.id+'_')):undefined;const slot=surface?.slots.find(s=>'source:'+s.id===node.module);if(missing&&(node.text!==undefined||slot?.previewText!==undefined))return <span {...props}>{node.text??slot?.previewText}</span>;if(!(node.module in sources))return <div {...props} className={props.className+' cms-binding-placeholder'}><strong>{node.name}</strong><small>Native application module · binding preserved</small></div>;const content=node.text!==undefined&&typeof sources[node.module]==='string'?node.text:sources[node.module];return sourceContent(content,props);}return <div {...props}><CmsModule name={node.module??''}/></div>;}
 if(node.type==='navigation')return <div {...props}><CmsNavigation/></div>;
 if(node.type==='container')return <div {...props}><CmsNodes nodes={node.children} sources={sources} depth={depth+1}/></div>;
 if(node.type==='symbol'){const symbol=site.symbols.find(s=>s.id===node.symbol);return <div {...props}>{symbol&&<CmsNodes nodes={[symbol.root]} sources={sources} depth={depth+1}/>}</div>;}
 if(node.type==='heading')return createElement('h'+(node.level??2),props,node.text??'Heading');
 if(node.type==='richtext')return <div {...props} dangerouslySetInnerHTML={{__html:safeCmsHtml(node.text??'')}}/>;
 if(node.type==='text')return <p {...props} style={{whiteSpace:'pre-wrap'}}>{node.text}</p>;
 if(node.type==='image')return <CmsImage {...props} src={node.src??''} alt={node.alt??''}/>;
 if(node.type==='divider')return <hr {...props}/>;
 return <a {...props} href={node.href||'#'}>{node.text||node.name}</a>;
}
export function CmsDocumentView({page,canvas=false}:{page:CmsPage;canvas?:boolean}){const native=canvas&&page.kind==='surface'?cmsSurfaces.find(s=>s.id===page.id):undefined;const tag=native?.kind??'article';const attributes={className:'cms-document'+(native?.classes?' '+native.classes:'')+(page.root.classes?' '+page.root.classes:''),'data-cms-document':page.id,'data-cms-node':page.root.id,...(native?.domId?{id:native.domId}:{}),...(tag==='dialog'?{open:true,style:{position:'relative',margin:'10px auto'}}:{}),...(tag==='button'?{type:'button'}:{}),...(tag==='form'?{onSubmit:(e:React.FormEvent)=>e.preventDefault()}:{})};return createElement(tag,attributes,<CmsNodes nodes={page.root.children}/>);}
