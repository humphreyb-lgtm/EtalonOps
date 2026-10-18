import {draftFilterError,type DraftFilters} from './draft-filters';
import { loadDraft,storageKey,type Draft } from './domain';
import type { DraftPage,DraftSummary } from './api';
export function saveBrowserDraft(draft:Draft):Draft {
 const saved={...draft,id:draft.id??crypto.randomUUID(),name:draft.name?.trim()||'Untitled MRF',savedAt:new Date().toISOString()};
 localStorage.setItem(`${storageKey(draft.projectId)}:draft:${saved.id}`,JSON.stringify(saved));
 localStorage.setItem(storageKey(draft.projectId),JSON.stringify(saved));
 return saved;
}
export function listBrowserDrafts(projectId:string,page=1,filters:DraftFilters={}):DraftPage {
 const error=draftFilterError(filters);if(error)throw new Error(error);
 const prefix=`${storageKey(projectId)}:draft:`,records:DraftSummary[]=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
  const id=key.slice(prefix.length),loaded=loadDraft(projectId,id);if(loaded.error||!loaded.restored)continue;
  const d=loaded.draft;records.push({id,name:d.name??'Saved MRF',projectId,deliveryDate:d.deliveryDate,savedAt:d.savedAt??'',itemCount:d.lines.length,version:0});
 }
 const legacy=loadDraft(projectId);if(legacy.restored&&!records.some(d=>d.id===legacy.draft.id))records.push({id:'legacy',name:legacy.draft.name??'Saved MRF',projectId,deliveryDate:legacy.draft.deliveryDate,savedAt:legacy.draft.savedAt??'',itemCount:legacy.draft.lines.length,version:0});
 const filtered=records.filter(d=>(!filters.text?.trim()||(d.name.toLowerCase().includes(filters.text.trim().toLowerCase())))&&(!filters.deliveryFrom||d.deliveryDate>=filters.deliveryFrom)&&(!filters.deliveryTo||d.deliveryDate<=filters.deliveryTo));
 filtered.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||b.id.localeCompare(a.id));const pages=Math.max(1,Math.ceil(filtered.length/25));page=Math.min(page,pages);
 return {records:filtered.slice((page-1)*25,page*25),total:filtered.length,page,pages};
}
