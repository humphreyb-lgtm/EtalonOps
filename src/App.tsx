import {emptyMRFForm,printedTaskCode} from './mrf-form';
import {formatInchText,formatMaterialText,formatMaterialSpecification} from './measurements';
import { draftFilterError,type DraftFilters } from './draft-filters';
import { AdminWorkspace } from './AdminWorkspace';
import { SubmissionCenter } from './SubmissionCenter';
import { UserAdmin } from './UserAdmin';
import { saveBrowserDraft,listBrowserDrafts } from './draft-storage';
import { PurchasingFields } from './PurchasingFields';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList,
  FileText, FolderKanban, Home, Info, LogOut, Menu,  Package,
  Pencil, Plus, Save, Search, Settings, ShieldCheck, ShoppingCart,
  Trash2, X, ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import {
   formatDate, freshDraft, loadDraft,
  positiveQuantity, projects, searchFixtures, units,
  type Candidate, type Draft, type Line, type Unit,
} from './domain';

import { ProductPhoto } from './ProductPhoto';
import { CatalogAdmin } from './CatalogAdmin';
import { cloudMode, cloudDisplayName, cloudSignOut,siteSessionActive } from './cloud-auth';
import { databaseMode, localIdentity, readDatabaseDraft, saveDatabaseDraft, databaseSearch, clearLocalSession, request, listDatabaseDrafts, type DraftPage } from './api';

type Stage = 'idle' | 'verified' | 'clarify';

function Brand() {
  return <a href="#main" className="brand" aria-label="EtalonOps, go to MRF Builder">
    <svg width="30" height="35" viewBox="0 0 32 36" aria-hidden="true"><path fill="#ff650c" d="M16 0 31 9v18L16 36 1 27V9z" /><path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 10h10m-7 0v5l-5 10h14l-5-10v-5m-6 11h8" /></svg>
    <span>EtalonOps</span>
  </a>;
}

const navigation = [
  { title: 'Home', icon: Home }, { title: 'Projects', icon: FolderKanban },
  { title: 'MRF Builder', icon: ClipboardList }, { title: 'Orders', icon: ShoppingCart },
  { title: 'Materials', icon: Package }, { title: 'Reports', icon: ChartNoAxesColumnIncreasing },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return <nav aria-label="Main navigation" className="navigation">
    {navigation.map(({ title, icon: Icon }) => <button key={title} type="button"
      className={`nav-item ${title === 'MRF Builder' ? 'active' : ''}`}
      aria-current={title === 'MRF Builder' ? 'page' : undefined}
      disabled={title !== 'MRF Builder'} title={title !== 'MRF Builder' ? 'Outside this proof of concept' : undefined}
      onClick={onNavigate}><Icon size={20} aria-hidden="true" /><span>{title}</span></button>)}
    <div className="nav-bottom"><button className="nav-item" disabled title="Outside this proof of concept"><Settings size={20} aria-hidden="true" />Settings</button>
      <span className="nav-caption">MRF Builder · Proof of concept</span></div>
  </nav>;
}

function ProductImage({ category, small = false, candidate, productId }: { category: Candidate['category']; small?: boolean; candidate?: Candidate;productId?:string|null }) {
  return <ProductPhoto productId={productId} materialId={candidate && candidate.source!=='ai_fixture' ? candidate.id:undefined} description={`Approved product image for ${candidate?.description??category}`} fallback={<div className={`product-image ${small ? 'small' : ''}`} aria-label="No approved product image">
    <Package size={small ? 19 : 25} strokeWidth={1.25} aria-hidden="true" />
    {!small && <span>No image</span>}
    <span className="sr-only">{category}; image unavailable in demo</span>
  </div>} />;
}

function SectionHeading({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{children && <p>{children}</p>}</div>{aside}</div>;
}

function SourceTag({ source,verification }: { source: Line['source'];verification?: 'provisional'|'reviewed' }) {
  const label = verification==='provisional'?'Provisional catalog · unverified':source === 'verified' ? 'Reviewed catalog' : source === 'verified_fixture' ? 'Catalog fixture' : source === 'ai_fixture' ? 'AI mock · unverified' : 'Your description';
  return <span className={`source-tag ${source === 'ai_fixture'||verification==='provisional' ? 'provisional' : ''}`}>{verification!=='provisional'&&(source === 'verified_fixture' || source === 'verified') && <ShieldCheck size={12} aria-hidden="true" />}{label}</span>;
}

export default function App() {
  const [draftSearch,setDraftSearch]=useState<DraftFilters>({}),[appliedDraftFilters,setAppliedDraftFilters]=useState<DraftFilters>({}),[draftListError,setDraftListError]=useState('');
  const [draftList,setDraftList]=useState<DraftPage|null>(null),[draftListOpen,setDraftListOpen]=useState(false);
  const [pendingDraft,setPendingDraft]=useState<{kind:'new'}|{kind:'open';id:string}|null>(null);
  const [compliance,setCompliance]=useState<string[]>([]);
  const [productChoices,setProductChoices]=useState<Record<string,string>>({});
  const [allowChanges,setAllowChanges]=useState(true),[exactChoices,setExactChoices]=useState<Record<string,boolean>>({}),[manualProducts,setManualProducts]=useState<Record<string,{manufacturer:string;partNumber:string}>>({});
  const exactFor=(id:string)=>exactChoices[id]??!allowChanges;
  const [projectId, setProjectId] = useState(() => new URLSearchParams(window.location.search).get('project')??'riverside');
  const [assignedProjects,setAssignedProjects]=useState<{id:string;name:string;number:string;details?:Record<string,string>}[]>(databaseMode?[]:projects);
  const [initial] = useState<{ draft: Draft; error?: string; restored?: boolean }>(() => databaseMode ? { draft: freshDraft(projectId) } : loadDraft(projectId,new URLSearchParams(window.location.search).get('draft')??undefined));
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [headerActions,setHeaderActions]=useState<HTMLElement|null>(null),[listActions,setListActions]=useState<HTMLElement|null>(null);
  const [foremen,setForemen]=useState<{id:string;name:string}[]>(databaseMode?[]:[{id:'local-demo-foreman',name:'Demo foreman'}]);
  const [selfId,setSelfId]=useState(databaseMode?'':'local-demo-foreman'),[foremenError,setForemenError]=useState('');
  useEffect(()=>{if(!databaseMode||!assignedProjects.length)return;let cancelled=false;setForemen([]);setSelfId('');setForemenError('');void request<{selfId:string;users:{id:string;name:string}[]}>(`/projects/${projectId}/foremen`).then(value=>{if(!cancelled){setSelfId(value.selfId.toLowerCase());setForemen(value.users);}}).catch(error=>{if(!cancelled)setForemenError(error.message);});return()=>{cancelled=true;};},[projectId,assignedProjects]);

  const [databaseBusy, setDatabaseBusy] = useState(databaseMode);
  const [dirty, setDirty] = useState(false);
  const [storageError, setStorageError] = useState(initial.error ?? '');
  const [announcement, setAnnouncement] = useState(initial.restored ? 'Your saved local draft has been restored.' : '');
  const [active, setActive] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit | ''>('');
  const [description, setDescription] = useState('');
  const [taskCode,setTaskCode]=useState('');
  const [entryError, setEntryError] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [searchedDescription, setSearchedDescription] = useState('');
  const [customDescription, setCustomDescription] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [editing, setEditing] = useState<Line | null>(null);
  const [editError, setEditError] = useState('');
  const [removing, setRemoving] = useState<Line | null>(null);
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const editRef = useRef<HTMLDialogElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLSelectElement>(null);
  const project = assignedProjects.find(p=>p.id===projectId)??{id:projectId,name:'No assigned job',number:'—',details:{}};

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const closeProfile = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false); };
    window.addEventListener('keydown', closeProfile);
    return () => window.removeEventListener('keydown', closeProfile);
  }, []);

  useEffect(() => {
    if (editing && !editRef.current?.open) editRef.current?.showModal();
  }, [editing]);

  useEffect(() => {
    if ((removing || pendingProject || pendingLeave || pendingDraft) && !confirmRef.current?.open) confirmRef.current?.showModal();
  }, [removing, pendingProject, pendingLeave, pendingDraft]);

  useEffect(() => {
    if (!databaseMode) return;
    let cancelled = false;
    void (async()=>{try{const jobs=await request<{records:{id:string;name:string;number:string}[]}>('/jobs');if(cancelled)return;setAssignedProjects(jobs.records);if(!jobs.records.length){setStorageError('No active jobs are assigned to you. Contact your company administrator.');return;}const chosen=jobs.records.some(j=>j.id===projectId)?projectId:jobs.records[0].id;setProjectId(chosen);const saved=await readDatabaseDraft(chosen,chosen===projectId?new URLSearchParams(location.search).get('draft')??undefined:undefined);if(cancelled)return;if(saved&&saved.projectId!==chosen)throw new Error('Choose the job this draft belongs to.');setDraft(saved??freshDraft(chosen));if(saved)setDraftAddress(chosen,saved.id);setAnnouncement(saved?'Saved MRF restored.':'Your assigned jobs are ready.');}catch(error){if(!cancelled)setStorageError(error instanceof Error?error.message:'Unable to load your jobs.');}finally{if(!cancelled)setDatabaseBusy(false);}})();
    return () => { cancelled = true; };
  }, []);

  useEffect(()=>{const refresh=()=>{if(databaseMode)void request<{records:{id:string;name:string;number:string}[]}>('/jobs').then(value=>setAssignedProjects(value.records)).catch(()=>{});};window.addEventListener('etalonops-jobs-changed',refresh);return()=>window.removeEventListener('etalonops-jobs-changed',refresh);},[]);

  function changeDraft(update: (current: Draft) => Draft) {
    if(draft.submitted){setStorageError('Submitted MRFs are locked. Create a revision for changes.');return;}
    setCompliance([]);
    setDraft(update);
    setDirty(true);
  }

  function resetEntry() {
    setExactChoices({});setManualProducts({});setStage('idle');setMatches([]);setCustomDescription(null);setAdded([]);setEntryError('');
  }

  async function search(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const input = (override ?? description).trim();
    if (!positiveQuantity(quantity)) { setEntryError('Enter a quantity greater than zero.'); document.getElementById('quantity')?.focus(); return; }
    if (!input) { setEntryError('Describe the material you need.'); descriptionRef.current?.focus(); return; }
    resetEntry();
    setSearchedDescription(input);
    let found: Candidate[];
    try {
      if (databaseMode) setDatabaseBusy(true);
      found = databaseMode ? await databaseSearch(input,projectId) : searchFixtures(input);
    } catch { setEntryError('Catalog search is unavailable. Your input is preserved; please retry.'); return; }
    finally { setDatabaseBusy(false); }
    setMatches(found);
    setStage(found.length ? 'verified' : 'clarify');
    setAnnouncement(found.length ? `${found.length} ${cloudMode ? "catalog" : "demo catalog"} matches found.` : 'No match found. Edit your description below or add it as entered.');
  }

  function requireEntry(): boolean {
    if (!positiveQuantity(quantity)) { setEntryError('Enter a quantity greater than zero before adding an item.'); document.getElementById('quantity')?.focus(); return false; }
    if (!unit) { setEntryError('Choose your quantity unit. A product’s package unit does not tell us whether you mean feet, sticks, or each.'); unitRef.current?.focus(); return false; }
    return true;
  }

  function addLine(candidate: Candidate | null,selectedPurchase?:{productId:string;noSubstitutions:boolean}) {
    if (candidate && added.includes(candidate.id)) return;
    if (!candidate && added.includes('description')) return;
    if (!requireEntry()) return;
    const ownDescription = customDescription ?? description;
    if (!candidate && (!ownDescription.trim() || ownDescription.length > 2000)) { setEntryError('Your description must contain 1–2000 characters. Edit Description to add before continuing.'); return; }
    const product=candidate?.products?.find(p=>p.id===(selectedPurchase?.productId??productChoices[candidate.id]??candidate.products?.[0]?.id))??candidate?.products?.[0];
    const exact=selectedPurchase?.noSubstitutions??exactFor(candidate?.id??'description'),manual=manualProducts[candidate?.id??'description'];
    const manufacturer=product?.manufacturer??manual?.manufacturer.trim()??'',partNumber=product?.partNumber??manual?.partNumber.trim()??'';
    if((exact&&(!manufacturer||!partNumber))||Boolean(manufacturer)!==Boolean(partNumber)){setEntryError('No Substitutions requires an exact manufacturer and part number. Choose a manufacturer product or enter both fields.');return;}
    const line: Line = {
      id: crypto.randomUUID(), taskCode:taskCode.trim(), quantity, requestedUnit: unit as Unit,
      description: candidate?.description ?? ownDescription.trim(),
      rawInput: { quantity, description: searchedDescription || description.trim(), requestedUnit: unit as Unit },
      candidate: candidate ? { ...candidate, specs: [...candidate.specs] } : null,
      purchasing:manufacturer&&partNumber?{productId:product?.id??null,manufacturer,partNumber,noSubstitutions:exact}:undefined,
      source: candidate?.source ?? 'user_description', deliveryMode: 'inherit', overrideDate: null,
    };
    changeDraft(current => ({ ...current, lines: [...current.lines, line] }));
    if(databaseMode&&candidate&&/^[a-f\d-]{36}$/i.test(candidate.id)&&line.rawInput.description.length<=500)void request('/catalog/selection','POST',{eventId:line.id,projectId,materialId:candidate.id,productId:product?.id??null,phrase:line.rawInput.description}).catch(()=>setEntryError('Item added, but its search phrase could not be learned. Save your draft to preserve the line.'));
    setAdded(current => [...current, candidate?.id ?? 'description']);
    setEntryError('');
    setAnnouncement(`Added ${formatInchText(line.description)} to your MRF. ${quantity} ${unit}; using the MRF delivery date. Save your draft to keep it.`);
  }

  function clarify() {setStage('clarify');setCustomDescription(description);setAnnouncement('No suitable match. Edit your description below or add it as entered.');}
  function clearEntry(){setDescription('');setQuantity('');setUnit('');setTaskCode('');setAllowChanges(true);resetEntry();descriptionRef.current?.focus();}

  function setDraftAddress(project:string,id?:string){const url=new URL(window.location.href);url.searchParams.set('project',project);if(id)url.searchParams.set('draft',id);else url.searchParams.delete('draft');window.history.replaceState(null,'',url);}
  async function showDrafts(page=1,filters:DraftFilters=appliedDraftFilters){
    const error=draftFilterError(filters);if(error){setDraftListError(error);return;}
    filters=Object.fromEntries(Object.entries(filters).filter(([,value])=>value?.trim()));
    try{setDatabaseBusy(true);const list=databaseMode?await listDatabaseDrafts(projectId,page,filters):listBrowserDrafts(projectId,page,filters);setDraftList(list);setDraftListOpen(true);setAppliedDraftFilters(filters);setDraftListError('');}
    catch(error){const message=error instanceof Error?error.message:'Could not load saved drafts.';setDraftListError(message);if(!draftListOpen)setStorageError(message);}
    finally{setDatabaseBusy(false);}
  }
  async function navigateDraft(action:{kind:'new'}|{kind:'open';id:string}){
    try{setDatabaseBusy(true);let next:Draft;
      if(action.kind==='new')next=freshDraft(projectId);
      else if(databaseMode){const saved=await readDatabaseDraft(projectId,action.id);if(!saved||saved.projectId!==projectId)throw new Error('Draft not found in this project.');next=saved;}
      else{const loaded=loadDraft(projectId,action.id==='legacy'?undefined:action.id);if(loaded.error||!loaded.restored)throw new Error(loaded.error??'Draft not found.');next=loaded.draft;}
      setDraft(next);setDraftAddress(projectId,next.id);setDirty(false);setStorageError('');setCompliance([]);resetEntry();setQuantity('');setUnit('');setDescription('');setDraftListOpen(false);
      setAnnouncement(action.kind==='new'?'New MRF ready. Give it a name before saving.':`Opened ${next.name??'saved MRF'}.`);
    }catch(error){setStorageError(error instanceof Error?error.message:'Could not open the MRF. Your current items are preserved.');}
    finally{setDatabaseBusy(false);}
  }
  function chooseDraft(action:{kind:'new'}|{kind:'open';id:string}){if(dirty)setPendingDraft(action);else void navigateDraft(action);}
  async function saveDraft(): Promise<Draft|null> {
    try {
      if(draft.submitted){setStorageError('Submitted MRFs are locked. Create a revision for changes.');return null;}
      if(!draft.name?.trim()){setStorageError('Enter an MRF name before saving.');return null;}
      if (databaseMode) setDatabaseBusy(true);
      const saved = databaseMode ? await saveDatabaseDraft({...draft,name:draft.name.trim()}) : saveBrowserDraft({...draft,foreman:draft.foreman??foremen.find(person=>person.id===selfId)});
      setDraftAddress(projectId,saved.id);
      setDraft(saved); setDirty(false); setStorageError('');
      setAnnouncement(cloudMode ? 'Draft saved in Azure SQL.' : databaseMode ? 'Draft saved in the local development database for this test account.' : 'Draft saved in this browser. You can leave the demo and resume it here.');
      return saved;
    } catch (error) {
      setStorageError(databaseMode ? (error instanceof Error ? error.message : 'Database save failed. Your items are still here.') : 'Your browser could not save this draft. Your items are still here. Free up browser storage or allow site storage, then try again.');
      setAnnouncement('Draft was not saved. Your items are still on screen.');
      return null;
    } finally { setDatabaseBusy(false); }
  }

  async function prepareSubmission():Promise<Draft|null>{
    if(!draft.lines.length){setStorageError('Add at least one material before submitting.');return null;}
    setDatabaseBusy(true);
    try{const saved=(dirty||!draft.id)?await saveDraft():await readDatabaseDraft(projectId,draft.id);if(saved)setDraft(saved);return saved;}
    finally{setDatabaseBusy(false);}
  }
  async function submissionSaved(id:string){const saved=await readDatabaseDraft(projectId,id);if(saved){setDraft(saved);setDirty(false);setAnnouncement(`MRF submitted as ${saved.submitted?.number}. No order was placed.`);}}
  async function activateProject(id: string) {
    try {
      if (databaseMode) setDatabaseBusy(true);
      const loaded = databaseMode ? { draft: await readDatabaseDraft(id) ?? freshDraft(id), error: '', restored: true } : loadDraft(id);
      setDraftAddress(id,loaded.draft.id);setDraftListOpen(false);setCompliance([]);
      setDraftSearch({});setAppliedDraftFilters({});setDraftListError('');setProjectId(id); setDraft(loaded.draft); setStorageError(loaded.error ?? ''); setDirty(false);
      resetEntry(); setQuantity(''); setDescription(''); setUnit('');
      setAnnouncement(cloudMode ? 'Azure SQL draft loaded for this project.' : databaseMode ? 'Local database draft loaded for this test account.' : loaded.restored ? 'Saved local draft restored for this project.' : 'A new local draft is ready for this project.');
    } catch (error) { setStorageError(error instanceof Error ? error.message : 'Could not load the draft.'); }
    finally { setDatabaseBusy(false); }
  }

  function closeConfirmation() {
    confirmRef.current?.close(); setRemoving(null); setPendingProject(null); setPendingLeave(false);setPendingDraft(null);
  }

  async function finishNavigation(save: boolean) {
    if (save && !await saveDraft()) return;
    if (pendingDraft) await navigateDraft(pendingDraft);
    if (pendingProject) await activateProject(pendingProject);
    if (pendingLeave) { setActive(false); clearLocalSession(); if (cloudMode||siteSessionActive()) void cloudSignOut(); setProfileOpen(false); setDirty(false); }
    closeConfirmation();
  }

  function leaveDemo() {
    if (dirty) setPendingLeave(true);
    else { setActive(false); clearLocalSession(); if (cloudMode||siteSessionActive()) void cloudSignOut(); setProfileOpen(false); }
  }

  function resumeDemo() {
    void navigateDraft(draft.id?{kind:'open',id:draft.id}:{kind:'new'});setActive(true);
  }


  function updateLine(id: string, update: Partial<Line>) {
    changeDraft(current => ({ ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...update } : line) }));
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!positiveQuantity(editing.quantity)) { setEditError('Enter a quantity greater than zero.'); return; }
    if (!editing.description.trim()) { setEditError('Enter a material description.'); return; }
    const purchasing=editing.purchasing;
    if(purchasing&&((Boolean(purchasing.manufacturer.trim())!==Boolean(purchasing.partNumber.trim()))||(purchasing.noSubstitutions&&(!purchasing.manufacturer.trim()||!purchasing.partNumber.trim())))){setEditError('Supply both manufacturer and manufacturer part number. No Substitutions requires both.');return;}
    updateLine(editing.id, { taskCode:(editing.taskCode??'').trim(), purchasing: purchasing?{...purchasing,manufacturer:purchasing.manufacturer.trim(),partNumber:purchasing.partNumber.trim()}:undefined, quantity: editing.quantity, requestedUnit: editing.requestedUnit, description: editing.description.trim() });
    editRef.current?.close(); setEditError('');
    setAnnouncement('Item updated. Original input has been preserved.');
  }

  function entryPurchasing(candidate:Candidate|null,compact=false){const id=candidate?.id??'description',label=candidate?formatInchText(candidate.description):'my description',exact=exactFor(id),manual=manualProducts[id]??{manufacturer:'',partNumber:''};return <div className="entry-purchasing"><label><input type="checkbox" aria-label={`No Substitutions for ${label}`} checked={exact} onChange={event=>setExactChoices(current=>({...current,[id]:event.target.checked}))}/><span className={compact?'sr-only':undefined}>No Substitutions</span></label>{!candidate?.products?.length&&(exact||manual.manufacturer||manual.partNumber)&&<div className="exact-product-fields"><label>Manufacturer<input aria-label={`Exact manufacturer for ${label}`} value={manual.manufacturer} maxLength={200} onChange={event=>setManualProducts(current=>({...current,[id]:{...manual,manufacturer:event.target.value}}))}/></label><label>Manufacturer part number<input aria-label={`Exact part number for ${label}`} value={manual.partNumber} maxLength={200} onChange={event=>setManualProducts(current=>({...current,[id]:{...manual,partNumber:event.target.value}}))}/></label></div>}</div>;}

  const resultTable = (candidates: Candidate[], isAI = false) => <>
    <div className="results-table" role="table" aria-label={isAI ? 'Mock AI material suggestions' : cloudMode ? 'Catalog matches' : 'Demo catalog matches'}>
      <div className="result-head" role="row"><span role="columnheader">Image</span><span role="columnheader">Material description</span><span role="columnheader">Product UOM</span><span role="columnheader">Specifications</span><span role="columnheader">No Substitutions</span><span role="columnheader">Action</span></div>
      {candidates.map(candidate => <div className={`result-row ${added.includes(candidate.id) ? 'is-added' : ''}`} role="row" key={candidate.id}>
        <div role="cell" className="result-image"><ProductImage category={candidate.category} candidate={candidate} productId={productChoices[candidate.id]??candidate.products?.[0]?.id} /></div>
        <div role="cell" className="result-description"><strong>{formatMaterialText(candidate.description,candidate.category)}</strong>{candidate.highUse&&<span className="source-tag">High use</span>}{Boolean(candidate.products?.length)&&<label className="result-product">Manufacturer product<select aria-label={`Manufacturer product for ${formatInchText(candidate.description)}`} value={productChoices[candidate.id]??candidate.products![0].id} onChange={event=>setProductChoices(current=>({...current,[candidate.id]:event.target.value}))}>{candidate.products!.map(product=><option value={product.id} key={product.id}>{product.manufacturer} · {product.partNumber}{product.verification==='provisional'?' · provisional':''}</option>)}</select></label>}{isAI && <span className="muted source-disclosure">Illustrative fixture · no live source</span>}</div>
        <div role="cell" className="result-uom"><span className="mobile-label">Product UOM</span><span className="unit-badge">{candidate.productUnit}</span></div>
        <div role="cell" className="specs"><span className="mobile-label">Specifications</span>{candidate.specs.map(spec=>formatMaterialSpecification(spec,candidate.category)).join(' · ')}<SourceTag source={candidate.source} verification={candidate.verification}/></div>
        <div role="cell" className="result-substitutions">{entryPurchasing(candidate,true)}</div>
        <div role="cell" className="result-action"><button type="button" className={`button add-button ${added.includes(candidate.id) ? 'added-button' : ''}`} disabled={added.includes(candidate.id)} onClick={() => addLine(candidate)} aria-label={`${added.includes(candidate.id) ? 'Added' : 'Add'} ${formatInchText(candidate.description)}`}>
          {added.includes(candidate.id) ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{added.includes(candidate.id) ? 'Added' : 'Add'}
        </button></div>
      </div>)}
    </div>
    {unit && candidates.some(candidate => candidate.productUnit !== unit) && <p className="unit-note"><Info size={14} aria-hidden="true" />Your quantity stays in {unit}. Product/package UOM is shown separately; no conversion is assumed.</p>}
  </>;

  if (!active) return <main className="resume-page"><Brand /><section className="resume-panel"><span className="eyebrow">LOCAL PROOF OF CONCEPT</span><h1>Your work, ready when you are.</h1><p>You’ve left the demo. {databaseMode ? 'Saved drafts remain in the local database for this test account.' : 'Saved drafts remain in this browser; unsaved changes are not retained.'}</p><button className="button primary" onClick={resumeDemo}>Resume demo <ArrowRight size={16} aria-hidden="true" /></button><p className="fine-print">This is a local demo session, not Microsoft sign-in. {databaseMode ? 'Data is stored in your local development database.' : 'No data is sent to a server.'}</p></section></main>;

  return <>
    {(databaseBusy) && <div className="database-progress" role="status">{cloudMode ? 'Connecting to Azure SQL…' : 'Connecting to local database…'}</div>}
    <a className="skip-link" href="#main">Skip to MRF Builder</a>
    <aside className="desktop-sidebar"><Brand /><Navigation /></aside>
    <header className="topbar">
      <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => menuRef.current?.showModal()}><Menu size={23} aria-hidden="true" /></button>
      <div className="project-picker"><label htmlFor="project-select" className="sr-only">Project</label><div className="project-select-wrap"><select id="project-select" value={projectId} disabled={databaseBusy} onChange={event => { if (dirty) setPendingProject(event.target.value); else activateProject(event.target.value); }}>{!assignedProjects.length&&<option value={projectId}>No assigned jobs</option>}{assignedProjects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div><span>Job #{project.number}</span></div>
      <form className="global-search" onSubmit={event => { event.preventDefault(); if (globalSearch.trim()) { setDescription(globalSearch.trim()); resetEntry(); descriptionRef.current?.focus(); setAnnouncement('Description filled. Enter a quantity, then Find Matches.'); } }}><Search size={17} aria-hidden="true" /><input aria-label={cloudMode ? 'Search materials' : 'Search demo materials'} placeholder={cloudMode ? 'Search materials…' : 'Search demo materials…'} value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} /><button className="sr-only" type="submit">Use search as description</button></form>
      <div className="profile"><button className="avatar" aria-label={cloudMode||siteSessionActive() ? 'Account menu' : 'Demo session menu'} aria-expanded={profileOpen} onClick={() => setProfileOpen(current => !current)}>{cloudMode||siteSessionActive() ? cloudDisplayName().split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase() : 'DM'}</button>{profileOpen && <div className="profile-menu"><strong>{cloudMode||siteSessionActive() ? cloudDisplayName() : databaseMode ? localIdentity : 'Demo foreman'}</strong><span>{siteSessionActive()?'Site account':cloudMode ? 'Microsoft work account' : 'Local session · no sign-in'}</span><button className="button text-button" onClick={leaveDemo}><LogOut size={15} aria-hidden="true" />{cloudMode||siteSessionActive() ? 'Sign out' : 'Leave demo'}</button></div>}</div>
    </header>

    <main id="main" className="workspace" tabIndex={-1} inert={(databaseBusy) || undefined} aria-busy={databaseBusy}>
      <div className="page-heading"><h1>MRF Builder</h1><AdminWorkspace /><CatalogAdmin /><UserAdmin /><span className="demo-badge">{cloudMode ? 'Cloud pilot' : 'Local preview'}</span></div>
      <div className="demo-notice"><Info size={14} aria-hidden="true"/><span>{cloudMode||siteSessionActive()?`Signed in as ${cloudDisplayName()}. Choose an assigned job to create or continue an MRF.`:databaseMode?'Local database demo · no Microsoft sign-in. Test account: '+localIdentity:'Demo data. Drafts save only in this browser. No live catalog or Microsoft sign-in.'}</span></div>
      <nav className="mrf-navigation" aria-label="MRF actions"><span ref={setListActions}/><button className="button" onClick={()=>void showDrafts()}>My Drafts</button><button className="button" onClick={()=>chooseDraft({kind:'new'})}>New MRF</button></nav>
      {draftListOpen&&draftList&&<section className="panel saved-drafts" aria-label="My Drafts"><div className="section-heading"><h2>My Drafts</h2><button className="button" onClick={()=>setDraftListOpen(false)}>Close draft list</button></div><form className="draft-filters" onSubmit={event=>{event.preventDefault();void showDrafts(1,draftSearch);}}><label>Find saved MRF by name<input maxLength={120} value={draftSearch.text??''} onChange={e=>setDraftSearch(current=>({...current,text:e.target.value}))}/></label><label>Delivery from<input type="date" value={draftSearch.deliveryFrom??''} onChange={e=>setDraftSearch(current=>({...current,deliveryFrom:e.target.value}))}/></label><label>Delivery through<input type="date" value={draftSearch.deliveryTo??''} onChange={e=>setDraftSearch(current=>({...current,deliveryTo:e.target.value}))}/></label><div className="catalog-actions"><button className="button" disabled={databaseBusy}>Filter drafts</button><button className="button" type="button" disabled={databaseBusy} onClick={()=>{setDraftSearch({});void showDrafts(1,{});}}>Clear draft filters</button></div></form>{draftListError&&<p role="alert">{draftListError}</p>}<p>{project.name} · {draftList.total} saved drafts{Object.keys(appliedDraftFilters).length?' matching applied filters':''}</p>{draftList.records.length===0&&<p>No saved drafts match. Clear the filters or save a new MRF for this project.</p>}{draftList.records.map(item=><article key={item.id}><h3>{item.name}</h3><p>{item.itemCount} items · Delivery {formatDate(item.deliveryDate)} · Last saved {new Date(item.savedAt).toLocaleString()}</p><button className="button" onClick={()=>chooseDraft({kind:'open',id:item.id})}>Continue {item.name}</button></article>)}<div className="catalog-actions"><button className="button" disabled={draftList.page<=1} onClick={()=>void showDrafts(draftList.page-1)}>Previous drafts</button><span>Page {draftList.page} of {draftList.pages}</span><button className="button" disabled={draftList.page>=draftList.pages} onClick={()=>void showDrafts(draftList.page+1)}>Next drafts</button></div></section>}
      <section className="panel mrf-header" aria-label="MRF header">
        <label htmlFor="mrf-name">MRF name<input id="mrf-name" readOnly={Boolean(draft.submitted)} required maxLength={120} value={draft.name??'Saved MRF'} placeholder="e.g. Level 2 Rough-In" onChange={event=>changeDraft(current=>({...current,name:event.target.value}))}/></label>
        <label htmlFor="mrf-foreman">Foreman<select id="mrf-foreman" aria-label="Foreman" disabled={Boolean(draft.submitted)||!foremen.length} value={draft.foreman?.id??selfId} onChange={event=>{const person=foremen.find(person=>person.id===event.target.value);if(person)changeDraft(current=>({...current,foreman:person}));}}>{!foremen.length&&<option value="">{foremenError?'Foreman list unavailable':'Loading foremen…'}</option>}{draft.foreman&&!foremen.some(person=>person.id===draft.foreman?.id)&&<option value={draft.foreman.id} disabled>{draft.foreman.name} (unavailable)</option>}{foremen.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label htmlFor="delivery-date">MRF Delivery Date<input id="delivery-date" type="date" readOnly={Boolean(draft.submitted)} required value={draft.deliveryDate} onChange={event=>{if(event.target.value)changeDraft(current=>({...current,deliveryDate:event.target.value}));}}/></label>
        <div className="mrf-header-actions"><div className="catalog-actions"><button className="button save-button" disabled={Boolean(draft.submitted)||(databaseMode&&!assignedProjects.length)} onClick={saveDraft}><Save size={16} aria-hidden="true"/>Save as Draft</button><span ref={setHeaderActions}/></div><span className={`save-status ${dirty?'unsaved':''}`}>{dirty?'Unsaved changes':draft.savedAt?(cloudMode?'Saved in Azure SQL':databaseMode?'Saved in local database':'Saved in this browser'):'Not saved yet'}</span></div>
        {foremenError&&<p role="alert" className="error-message">{foremenError}</p>}
      </section>
      <section className="panel mrf-logistics" aria-label="MRF work area and packaging">{project.details&&<p className="mrf-job-defaults">Ship to: {project.details.address||'Not recorded'} · Delivery contact: {project.details.deliveryContactName||'Not recorded'} {project.details.deliveryContactPhone} · Purchasing agent: {project.details.purchasingAgentName||'Not recorded'}</p>}<fieldset disabled={Boolean(draft.submitted)} className="mrf-logistics-fields"><legend>Work area, packaging and delivery</legend>{(['workArea','defaultTaskCode','packagingMethod','specialPackagingInstructions','deliveryInstructions','purchasingNotes'] as const).map(key=><label key={key}>{{workArea:'Work Area',defaultTaskCode:'Default Task Code',packagingMethod:'Packaging Method',specialPackagingInstructions:'Special Packaging Instructions',deliveryInstructions:'Delivery Instructions',purchasingNotes:'Purchasing Notes'}[key]}<input maxLength={key==='defaultTaskCode'?16:['workArea','packagingMethod'].includes(key)?200:2000} value={{...emptyMRFForm(),...draft.form}[key]} onChange={e=>changeDraft(current=>({...current,form:{...emptyMRFForm(),...current.form,[key]:e.target.value}}))}/></label>)}</fieldset></section>
      <SubmissionCenter projectName={project.name} headerActions={headerActions} listActions={listActions} projectId={projectId} draft={draft} prepare={prepareSubmission} onSubmitted={submissionSaved} onOpenDraft={id=>chooseDraft({kind:'open',id})}/>
      {storageError && <div className="error-message" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{storageError}</span></div>}

      <div inert={draft.submitted||(databaseMode&&!assignedProjects.length)?true:undefined}>
      <section className="panel entry-panel" aria-label="Add a material">
        <SectionHeading title="Add MRF Item"/>
        <form onSubmit={event => search(event)} className="entry-form" noValidate>
          <div className="quantity-group"><div className="field"><label htmlFor="quantity">Quantity</label><input id="quantity" inputMode="decimal" autoComplete="off" placeholder="e.g. 200" value={quantity} maxLength={14} onChange={event => { setQuantity(event.target.value); setEntryError(''); }} aria-invalid={entryError.startsWith('Enter a quantity') || undefined} aria-describedby={entryError ? 'entry-error' : undefined} /></div><div className="field unit-field"><label htmlFor="quantity-unit">Unit</label><select id="quantity-unit" ref={unitRef} value={unit} onChange={event => { setUnit(event.target.value as Unit); setEntryError(''); }} aria-invalid={entryError.startsWith('Choose your') || undefined} aria-describedby={entryError ? 'entry-error' : undefined}><option value="">Choose…</option>{units.map(u => <option value={u} key={u}>{u}</option>)}</select></div></div>
          <div className="field description-field"><label htmlFor="description">Description</label><input id="description" ref={descriptionRef} value={description} maxLength={2000} placeholder={'e.g. 1" PVC or self tappers'} onChange={event => { setDescription(event.target.value); resetEntry(); }} autoComplete="off" aria-describedby={entryError ? 'entry-error' : undefined} /></div>
          <div className="field task-code-field"><label htmlFor="task-code">Task Code</label><input id="task-code" value={taskCode} maxLength={16} onChange={event=>setTaskCode(event.target.value)} autoComplete="off"/></div>
          <div className="entry-actions"><label className="allow-changes"><input type="checkbox" checked={allowChanges} onChange={event=>{setAllowChanges(event.target.checked);setExactChoices({});}}/>Allow Changes</label><button className="button primary find-button" type="submit"><Search size={16} className="mobile-only" aria-hidden="true" />Find Matches</button></div>
        </form>
        {entryError && <p className="entry-error" id="entry-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{entryError}</p>}
      </section>

      {stage === 'verified' && <section className="panel results-panel" aria-label="Material results"><SectionHeading title="Material matches" aside={<span className="count-badge">{matches.length} matches</span>}>{databaseMode ? 'Local database matches for “' + searchedDescription + '”. Fixture records are labeled.' : 'Demo verified-match layout for “' + searchedDescription + '”. These are fictional catalog fixtures.'}</SectionHeading>{resultTable(matches)}<div className="panel-footer"><button className="button text-button" onClick={clarify}>None of these is what I want <ArrowRight size={15} aria-hidden="true" /></button><span className="muted">Add a match directly from its row.</span></div></section>}

      {stage === 'clarify' && <section className="panel unmatched-panel" aria-label="No match found">
        <div className="unmatched-heading" role="status"><AlertCircle size={17}/><strong>{matches.length?'No suitable match selected':'No match found'}</strong><span className="muted">Edit the description or add it as entered. This adds an MRF line only.</span></div>
        <form className="unmatched-form" onSubmit={event=>{event.preventDefault();addLine(null);}}>
          <label>Description to add<input value={customDescription??description} maxLength={2000} onChange={event=>{setCustomDescription(event.target.value);setAdded(current=>current.filter(id=>id!=='description'));}}/></label>
          <div className="unmatched-actions"><button className="button primary" disabled={added.includes('description')||!(customDescription??description).trim()} type="submit">{added.includes('description')?'Added to MRF':'Add to MRF'}</button><button className="button" type="button" onClick={()=>{const value=(customDescription??description).trim();setDescription(value);void search(undefined,value);}}>Search again</button><button className="button" type="button" onClick={clearEntry}>Clear entry</button></div>
        </form>{entryPurchasing(null)}
      </section>}

      <section className="panel item-list" aria-label="MRF Item List"><SectionHeading title="MRF Item List" aside={<span className="item-list-tools">{databaseMode&&<button className="button" onClick={()=>void request<{issues:{lineId:string;message:string}[];ready:boolean}>('/catalog/validate-lines','POST',{projectId,lines:draft.lines}).then(result=>{setCompliance(result.issues.map(issue=>`Item ${draft.lines.findIndex(line=>line.id===issue.lineId)+1}: ${issue.message}`));setAnnouncement(result.ready?'Manufacturer and job restriction checks passed. No order was submitted.':'Some items need correction before purchasing. Your draft is preserved.');}).catch(error=>setEntryError(error.message))}>Check purchasing requirements</button>}<span className="count-badge">{draft.lines.length} {draft.lines.length === 1 ? 'item' : 'items'}</span></span>}>Materials added to your request.</SectionHeading>
        <div className="item-table-wrap"><table className="item-table"><thead><tr><th scope="col" className="number-column">#</th><th scope="col" className="image-column">Image</th><th scope="col">Material description</th><th scope="col" className="quantity-column">Qty / UOM</th><th scope="col" className="delivery-column">Item delivery</th><th scope="col" className="action-column">Actions</th></tr></thead><tbody>
          {draft.lines.length === 0 ? <tr className="empty-row"><td colSpan={6}><div className="empty-list"><FileText size={38} strokeWidth={1.3} aria-hidden="true" /><div><strong>No items added yet</strong><span>Find a match above to add items to your MRF.</span></div></div></td></tr>
            : draft.lines.map((line, index) => <tr key={line.id} className={line.purchasing?.noSubstitutions?'no-substitutions':undefined} id={`mrf-line-${line.id}`} tabIndex={-1} data-testid="mrf-line"><td className="line-number"><span className="mobile-label">Item </span>{String(index + 1).padStart(2, '0')}</td><td className="line-image"><ProductImage category={line.candidate?.category ?? 'conduit'} candidate={line.candidate??undefined} productId={line.purchasing?.productId} small /></td><td className="line-description"><strong>{formatMaterialText(line.description,line.candidate?.category)}</strong><SourceTag source={line.source} verification={line.candidate?.verification} />{line.purchasing?.manufacturer&&<p className="line-manufacturer">{line.purchasing.manufacturer} · {line.purchasing.partNumber}<span className="substitution-note">{line.purchasing.noSubstitutions?'No Substitutions — exact product required':'or equivalent'}</span></p>}{printedTaskCode(line.taskCode,draft.form?.defaultTaskCode)&&<span className="line-task-code">Task Code: {printedTaskCode(line.taskCode,draft.form?.defaultTaskCode)}</span>}</td><td className="line-quantity"><span className="mobile-label">Quantity</span><strong>{line.quantity}</strong> <span>{line.requestedUnit}</span></td><td className="line-delivery"><label className="sr-only" htmlFor={`mode-${line.id}`}>Delivery mode for item {index + 1}</label><select id={`mode-${line.id}`} value={line.deliveryMode} onChange={event => updateLine(line.id, event.target.value === 'inherit' ? { deliveryMode: 'inherit', overrideDate: null } : { deliveryMode: 'override', overrideDate: draft.deliveryDate })}><option value="inherit">Use MRF Date</option><option value="override">Item Delivery Override</option></select>{line.deliveryMode === 'override' ? <><label className="sr-only" htmlFor={`override-${line.id}`}>Delivery override for item {index + 1}</label><input id={`override-${line.id}`} type="date" value={line.overrideDate ?? ''} onChange={event => { if (event.target.value) updateLine(line.id, { overrideDate: event.target.value }); }} /></> : <span className="inherited-date" data-testid="effective-date">{formatDate(draft.deliveryDate)}</span>}</td><td className="line-actions"><button className="icon-button" aria-label={`Edit item ${index + 1}`} onClick={event => { editTriggerRef.current = event.currentTarget; setEditing({ ...line }); setEditError(''); }}><Pencil size={16} aria-hidden="true" /></button><button className="icon-button remove-button" aria-label={`Remove item ${index + 1}`} onClick={() => setRemoving(line)}><Trash2 size={16} aria-hidden="true" /></button></td></tr>)}
        </tbody></table></div>
        {draft.lines.length > 0 && <div className="list-footer"><span><Info size={14} aria-hidden="true" />Items use the MRF date unless you choose an override.</span><button className="button text-button" onClick={() => { setDescription(''); setQuantity(''); setUnit(''); setAllowChanges(true);resetEntry(); descriptionRef.current?.focus(); }}><Plus size={15} aria-hidden="true" />Next material</button></div>}
      </section>
      </div>
      <footer className="workspace-footer"><span>EtalonOps · MRF Builder POC</span><span>{draft.submitted?`${draft.submitted.number} submitted. No purchase order placed.`:'This MRF is a draft. Saving does not submit or place an order.'}</span></footer>
      {compliance.length>0&&<div role="alert" className="entry-error">{compliance.map((issue,i)=><p key={i}>{issue}</p>)}</div>}<div className={`status-bar ${announcement ? 'has-message' : ''}`} role="status" aria-live="polite" aria-atomic="true">{announcement && <><Check size={15} aria-hidden="true" /><span>{announcement}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setAnnouncement('')}><X size={15} aria-hidden="true" /></button></>}</div>
    </main>

    <dialog className="mobile-menu" ref={menuRef} aria-label="Navigation"><div className="mobile-menu-heading"><Brand /><button className="icon-button" aria-label="Close navigation" onClick={() => menuRef.current?.close()}><X size={22} aria-hidden="true" /></button></div><Navigation onNavigate={() => menuRef.current?.close()} /></dialog>
    <dialog className="modal edit-modal" ref={editRef} aria-labelledby="edit-title" onClose={() => { setEditing(null); editTriggerRef.current?.focus({ preventScroll: true }); }}>{editing && <form onSubmit={saveEdit} noValidate><div className="modal-heading"><div><span className="eyebrow">MRF ITEM</span><h2 id="edit-title">Edit material</h2></div><button className="icon-button" type="button" aria-label="Close edit" onClick={() => editRef.current?.close()}><X size={20} aria-hidden="true" /></button></div><div className="field"><label htmlFor="edit-description">Material description</label><textarea id="edit-description" value={editing.description} maxLength={2000} rows={3} onChange={event => setEditing({ ...editing, description: event.target.value })} /></div><div className="edit-quantity"><div className="field"><label htmlFor="edit-quantity">Quantity</label><input id="edit-quantity" inputMode="decimal" maxLength={14} value={editing.quantity} onChange={event => setEditing({ ...editing, quantity: event.target.value })} /></div><div className="field"><label htmlFor="edit-unit">Requested unit</label><select id="edit-unit" value={editing.requestedUnit} onChange={event => setEditing({ ...editing, requestedUnit: event.target.value as Unit })}>{units.map(u => <option key={u}>{u}</option>)}</select></div></div><label htmlFor="edit-task-code">Task Code</label><input id="edit-task-code" maxLength={16} value={editing.taskCode??''} onChange={event=>setEditing({...editing,taskCode:event.target.value})}/><PurchasingFields projectId={projectId} line={editing} onChange={purchasing=>setEditing({...editing,purchasing})}/><p className="fine-print">Original input and source are preserved. Editing does not create or verify a catalog translation.</p>{editError && <p className="entry-error" role="alert">{editError}</p>}<div className="modal-actions"><button type="button" className="button" onClick={() => editRef.current?.close()}>Cancel</button><button className="button primary" type="submit">Save item changes</button></div></form>}</dialog>
    <dialog className="modal confirm-modal" ref={confirmRef} aria-labelledby="confirm-title" onCancel={closeConfirmation}><div className="modal-heading"><h2 id="confirm-title">{removing ? 'Remove this item?' : 'Save your draft first?'}</h2><button className="icon-button" aria-label="Close confirmation" onClick={closeConfirmation}><X size={20} aria-hidden="true" /></button></div>{removing ? <><p>{removing.description}</p><p className="muted">Only this MRF line will be removed.</p><div className="modal-actions"><button className="button" onClick={closeConfirmation}>Keep item</button><button className="button danger" onClick={() => { changeDraft(current => ({ ...current, lines: current.lines.filter(line => line.id !== removing.id) })); setAdded([]); setAnnouncement('Item removed. Save your draft to keep this change.'); closeConfirmation(); }}>Remove item</button></div></> : <><p>You have unsaved changes. Save them before {pendingDraft?'opening another MRF':pendingProject ? 'switching projects' : 'leaving'}. Your other saved drafts will remain available.</p><div className="modal-actions navigation-actions"><button className="button" onClick={closeConfirmation}><ArrowLeft size={15} aria-hidden="true" />Stay here</button><button className="button text-button" onClick={() => finishNavigation(false)}>Discard changes</button><button className="button primary" onClick={() => finishNavigation(true)}>Save and continue</button></div></>}</dialog>
  </>;
}
