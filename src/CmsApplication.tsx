import {useEffect,useState,type ReactNode} from 'react';
import {useCms} from './CmsContext';
import {CmsNavigation} from './CmsNavigation';
import {CmsDocumentView} from './CmsRenderer';
import {CmsAdmin} from './CmsAdmin';
import {CloudGate} from './cloud-auth';
import {request} from './api';
import {LoginPage} from './LoginPage';
import App from './App';
export function CmsGateway(){const cms=useCms();const publicPage=cms.site.pages.find(p=>p.kind==='page'&&p.visibility==='public'&&location.pathname==='/pages/'+p.slug);if(publicPage)return publicPage.shell==='blank'?<CmsDocumentView page={publicPage}/>:<CmsShell><CmsDocumentView page={publicPage}/></CmsShell>;return <CloudGate><CmsAuthenticated/></CloudGate>;}
function CmsAuthenticated(){const cms=useCms();const [checked,setChecked]=useState(false);useEffect(()=>{let alive=true;void request<{roles:string[]}>('/me').then(v=>{if(alive){cms.setSession(v.roles);setChecked(true);}}).catch(()=>{if(alive)setChecked(true);});return()=>{alive=false;};},[]);const params=new URLSearchParams(location.search);if(params.get('appearancePage')==='login'&&window.parent!==window)return <LoginPage microsoft={async()=>{}} onSite={()=>{}} busy={false} error=""/>;if(location.pathname==='/cms')return checked&&cms.roles.includes('Admin')?<CmsAdmin standalone/>:checked?<p role="alert">System administrator access is required.</p>:<p>Loading administration…</p>;
 if(!checked||!cms.sessionReady)return <p role="status" className="cms-loading">Loading workspace…</p>;
 if(location.pathname==='/cms-canvas'&&cms.preview&&cms.roles.includes('Admin')){const document=cms.site.pages.find(p=>p.id===params.get('document'));return document?<CmsDocumentView page={document} canvas/>:<p>Waiting for the selected draft document…</p>;}
 if(location.pathname.startsWith('/pages/')){const page=cms.site.pages.find(p=>p.kind==='page'&&location.pathname==='/pages/'+p.slug);if(page?.shell==='blank')return <CmsDocumentView page={page}/>;return <CmsShell>{page?<CmsDocumentView page={page}/>:<p role="alert">This page is unavailable or your account does not have access.</p>}</CmsShell>;}return <App/>;}
function CmsShell({children}:{children:ReactNode}){return <div className="cms-application"><header className="cms-mobile-navigation"><a href="/">EtalonOps</a><details><summary>Menu</summary><CmsNavigation/></details></header><aside className="desktop-sidebar"><a className="brand" href="/">EtalonOps</a><CmsNavigation/></aside><main className="workspace cms-page-workspace">{children}</main></div>;}
