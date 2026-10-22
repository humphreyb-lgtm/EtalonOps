import App from './App';
import {MaterialTable} from './MaterialTable';
import {MaterialWorkbook} from './MaterialWorkbook';
import {UserAdmin} from './UserAdmin';
import {CatalogAdmin} from './CatalogAdmin';
import {CatalogInbox} from './CatalogInbox';
import {CatalogResearch} from './CatalogResearch';
import {ImageAdmin} from './ImageAdmin';
import {CatalogReadiness} from './CatalogReadiness';
import {ManualItemReview} from './ManualItemReview';
import {DocumentDesigner} from './DocumentDesigner';
import {AdminStatus} from './AdminStatus';
import {JobManufacturerRestrictions} from './JobManufacturerRestrictions';
import {AIUsage} from './AIUsage';
import {GlobalDesign} from './GlobalDesign';
import {cmsModules,cmsModuleHref} from './cms-model';
import {useCms} from './CmsContext';
export function CmsModule({name}:{name:string}){
 const {site,roles,signedIn}=useCms();const module=cmsModules.find(m=>m[0]===name);if(!module)return <p>Module unavailable.</p>;const allowed=roles.includes('Admin')||module[2]==='authenticated'&&signedIn||module[2]==='company'&&roles.includes('CompanyAdmin');if(!allowed)return <p className="cms-module-access">Your account does not have access to this module.</p>;
 const go=(module:string,query='')=>{const href=cmsModuleHref(site,module);if(href)location.href=href+query;else window.alert('This administration page is currently unavailable.');};const jump=(id:string,area:'catalog'|'images')=>go(area,'?material='+encodeURIComponent(id));const id=new URLSearchParams(location.search).get('material');
 switch(name){case 'mrf-builder':return <App embedded/>;case 'materials':return <MaterialTable onImages={id=>jump(id,'images')}/>;case 'workbook':return <MaterialWorkbook onApplied={()=>{}} onReview={()=>go('inbox')}/>;case 'users':return <UserAdmin embedded/>;case 'catalog':return <CatalogAdmin embedded materialTarget={id?{id,request:1}:undefined}/>;case 'inbox':return <CatalogInbox/>;case 'research':return <CatalogResearch/>;case 'images':return <ImageAdmin materialTarget={id?{id,request:1}:undefined}/>;case 'readiness':return <CatalogReadiness inspect={jump}/>;case 'manual':return <ManualItemReview onCount={()=>{}} onImages={id=>jump(id,'images')}/>;case 'pdf':return <DocumentDesigner/>;case 'status':return <AdminStatus/>;case 'restrictions':return <JobManufacturerRestrictions/>;case 'usage':return <AIUsage/>;case 'text-styles':return <GlobalDesign/>;default:return null;}
}
