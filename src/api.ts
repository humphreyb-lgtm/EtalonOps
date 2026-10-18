import type { DraftFilters } from './draft-filters';
import { catalogStreamValidator } from './catalog-stream';
import type { Candidate, Draft } from './domain';
import { cloudMode, cloudToken } from './cloud-auth';

export const databaseMode = cloudMode || window.location.protocol !== 'file:' && new URLSearchParams(window.location.search).get('database') === '1';
export const localIdentity = new URLSearchParams(window.location.search).get('identity') ?? 'foreman-one';
let token: string | null = null;
let tokenPromise: Promise<string> | null = null;
type SavedDraft = Omit<Draft, 'ownerId' | 'schemaVersion'> & { id: string; version: number };
async function accessToken(): Promise<string> {
  if (cloudMode) return cloudToken();
  if (token) return token;
  if (!tokenPromise) tokenPromise = fetch('/api/dev/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: localIdentity }) })
    .then(async response => { if (!response.ok) throw new Error('Local database session unavailable. Start the local API; Microsoft sign-in is not configured.'); token = (await response.json()).token; return token!; })
    .finally(() => { tokenPromise = null; });
  return tokenPromise;
}
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Database request failed. Your on-screen items are preserved.');
  return value;
}
export function clearLocalSession() { token = null; tokenPromise = null; }
export async function readDatabaseDraft(projectId: string,id?:string): Promise<Draft | null> {
  const { draft } = await request<{ draft: SavedDraft | null }>(id?`/drafts/${encodeURIComponent(id)}`:`/projects/${encodeURIComponent(projectId)}/draft`);
  return draft ? { ...draft, schemaVersion: 1, ownerId: 'local-demo-foreman' } : null;
}
export async function saveDatabaseDraft(draft: Draft): Promise<Draft> {
  const { draft: saved } = await request<{ draft: SavedDraft }>(draft.id ? `/drafts/${draft.id}` : '/drafts', draft.id ? 'PUT' : 'POST', { name:draft.name??'Untitled MRF', projectId: draft.projectId, deliveryDate: draft.deliveryDate, lines: draft.lines, version: draft.version ?? 0 });
  return { ...saved, schemaVersion: 1, ownerId: 'local-demo-foreman' };
}
export async function databaseSearch(query: string,projectId?:string) { return (await request<{ matches: Candidate[] }>(`/materials?q=${encodeURIComponent(query)}${projectId?`&projectId=${encodeURIComponent(projectId)}`:''}`)).matches; }

export type ImportRecord = { manufacturer: string; manufacturer_part_number: string; specifications_json: string; external_key: string; description: string; aliases_json: string; requested_uom: string; product_uom: string; source_url: string; verification_basis: string; dataset_kind: string };
export type ImportBatch = { id: string; state: string; report: { rows: number; errors: { row: number; message: string }[]; kind: string }; reviewer?: string | null; approvedAt?: string | null };
export type ImportPreview = ImportBatch & { records: ImportRecord[] };
export async function downloadCatalog() {
  const response = await fetch('/api/admin/catalog.csv', { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!response.ok) throw new Error('Catalog export failed.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = 'etalonops-catalog.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadCatalogSnapshot() {
  const response=await fetch('/api/admin/catalog-snapshot.json',{headers:{Authorization:`Bearer ${await accessToken()}`}});
  if(!response.ok){const error=await response.json();throw new Error(error.error??'Catalog snapshot export failed.');}
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement('a');link.href=url;link.download='etalonops-catalog-snapshot.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

type ExportWriter={write(chunk:Uint8Array):Promise<void>;close():Promise<void>;abort():Promise<void>};
type ExportPicker={showSaveFilePicker?:(options:unknown)=>Promise<{createWritable():Promise<ExportWriter>}>};
export function supportsLargeCatalogExport(){return typeof (window as unknown as ExportPicker).showSaveFilePicker==='function';}
export async function downloadLargeCatalog(progress:(count:number)=>void=()=>{}):Promise<boolean>{
 const picker=(window as unknown as ExportPicker).showSaveFilePicker;
 if(!picker)throw new Error('Large exports require a desktop browser with direct file saving, such as Chrome or Edge.');
 let handle:Awaited<ReturnType<NonNullable<ExportPicker['showSaveFilePicker']>>>;
 try{handle=await picker.call(window,{suggestedName:'etalonops-catalog-stream.jsonl',types:[{description:'Catalog records (JSON Lines)',accept:{'application/x-ndjson':['.jsonl']}}]});}
 catch(error){if(error instanceof DOMException&&error.name==='AbortError')return false;throw error;}
 const controller=new AbortController();let writer:ExportWriter|undefined;
 try{
  const response=await fetch('/api/admin/catalog-stream.jsonl',{headers:{Authorization:`Bearer ${await accessToken()}`},signal:controller.signal});
  if(!response.ok){const error=await response.json();throw new Error(error.error??'Catalog export failed.');}
  if(!response.body)throw new Error('Streaming downloads are unavailable in this browser.');
  writer=await handle.createWritable();const reader=response.body.getReader(),validate=catalogStreamValidator();let reported=0;
  while(true){const part=await reader.read();if(part.done)break;const count=validate.push(part.value);await writer.write(part.value);if(count-reported>=250){progress(count);reported=count;}}
  const count=validate.finish();await writer.close();writer=undefined;progress(count);return true;
 }catch(error){controller.abort();if(writer)try{await writer.abort();}catch{}throw error;}
}

export type ImageRecord = { id: string; materialId: string; productId?:string|null; contentHash: string; sourceUrl: string; rightsBasis: string; status: 'pending'|'approved'|'rejected'; reviewer: string|null; reviewedAt: string|null };
export async function imageBlob(path: string) {
  const response=await fetch(`/api${path}`,{headers:{Authorization:`Bearer ${await accessToken()}`}});
  if(!response.ok)throw new Error('Product image unavailable.');
  return response.blob();
}
export async function uploadProductImage(id: string,file: File,sourceUrl: string,rightsBasis: string,productId:string|null=null) {
  const encodedSource=encodeURIComponent(sourceUrl),encodedRights=encodeURIComponent(rightsBasis);
  if(encodedSource.length+encodedRights.length>8000)throw new Error('Shorten the source evidence URL or usage-rights description before uploading.');
  const response=await fetch(`/api/admin/materials/${id}/images`,{method:'POST',headers:{Authorization:`Bearer ${await accessToken()}`,'Content-Type':file.type||'application/octet-stream','x-image-source-url':encodedSource,'x-image-rights-basis':encodedRights,...(productId?{'x-image-product-id':productId}:{})},body:file});
  const value=await response.json();if(!response.ok)throw new Error(value.error??'Image upload failed.');return value as {image:ImageRecord};
}

export type AIStatus={enabled:boolean;discoveryAvailable:boolean;limits:{monthlySessions:number;monthlyRequests:number;sessionRequests:number;userDailyRequests:number}};
export type AIClarification={summary:string;description:string;reply:string;question:string|null;source:'ai';discoveryAvailable:false};

export type DraftSummary={id:string;name:string;projectId:string;deliveryDate:string;savedAt:string;itemCount:number;version:number};
export type DraftPage={records:DraftSummary[];total:number;page:number;pages:number};
export function listDatabaseDrafts(projectId:string,page=1,filters:DraftFilters={}){const params=new URLSearchParams({page:String(page)});for(const [key,value] of Object.entries(filters))if(value)params.set(key,value);return request<DraftPage>(`/projects/${encodeURIComponent(projectId)}/drafts?${params}`);}
