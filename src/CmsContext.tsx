import {createContext,useContext,useEffect,useState,useMemo,useRef,type ReactNode} from 'react';
import {defaultCmsSite,type CmsSite,type CmsPage} from './cms-model';
import {request} from './api';
export type CmsContextValue={site:CmsSite;documents:Map<string,CmsPage>;roles:string[];signedIn:boolean;sessionReady:boolean;ready:boolean;setSession:(roles:string[])=>void;refresh:()=>Promise<void>;preview:boolean};
const Context=createContext<CmsContextValue>({site:defaultCmsSite(),documents:new Map(),roles:[],signedIn:false,sessionReady:false,ready:false,setSession:()=>{},refresh:async()=>{},preview:false});
export const useCms=()=>useContext(Context);
export function CmsProvider({children}:{children:ReactNode}){
 const authenticated=useRef(false);const [sessionReady,setSessionReady]=useState(false);const [site,setSite]=useState(defaultCmsSite),[roles,setRoles]=useState<string[]>([]),[signedIn,setSignedIn]=useState(false),[ready,setReady]=useState(false),[css,setCss]=useState('');const preview=window.parent!==window&&new URLSearchParams(location.search).has('cmsPreview');const recovery=new URLSearchParams(location.search).has('cmsRecovery');
 async function refresh(){try{if(recovery||location.pathname==='/cms'){setSite(defaultCmsSite());setCss('');if(signedIn)setSessionReady(true);return;}const value=signedIn?await request<{site:CmsSite;css:string}>('/catalog/cms-live','POST',{}):await(await fetch('/api/public/cms')).json();if(!signedIn&&authenticated.current)return;if(!preview){setSite(value.site);setCss(value.css);}if(signedIn)setSessionReady(true);}catch{/* Keep the last complete published site during an outage. */}finally{setReady(true);if(signedIn)setSessionReady(true);}}
 useEffect(()=>{void refresh();const focus=()=>void refresh();window.addEventListener('cms-published',focus);window.addEventListener('focus',focus);return()=>{window.removeEventListener('cms-published',focus);window.removeEventListener('focus',focus);};},[signedIn,recovery,preview]);
 useEffect(()=>{if(!preview)return;const receive=(e:MessageEvent)=>{if(e.source!==window.parent||e.origin!==location.origin||e.data?.type!=='etalonops-cms-preview')return;setSite(e.data.site);setCss(e.data.css);setReady(true);};window.addEventListener('message',receive);window.parent.postMessage({type:'etalonops-cms-ready'},location.origin);return()=>window.removeEventListener('message',receive);},[preview]);
 const documents=useMemo(()=>new Map(site.pages.map(p=>[p.id,p])),[site]);
 return <Context.Provider value={{site,documents,roles,signedIn,sessionReady,ready,setSession:r=>{authenticated.current=true;setRoles(r);setSignedIn(true);},refresh,preview}}><div className="cms-site"><style id="cms-published-css">{recovery||location.pathname==='/cms'?'':css}</style>{children}</div></Context.Provider>;
}
