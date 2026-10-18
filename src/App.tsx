import { AdminWorkspace } from './AdminWorkspace';
import { SubmissionCenter } from './SubmissionCenter';
import { UserAdmin } from './UserAdmin';
import { saveBrowserDraft,listBrowserDrafts } from './draft-storage';
import { PurchasingFields } from './PurchasingFields';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, Ellipsis,
  FileText, FolderKanban, Home, Info, LogOut, Menu, MessageSquare, Package,
  Pencil, Plus, Save, Search, Send, Settings, ShieldCheck, ShoppingCart,
  Sparkles, Trash2, X, ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import {
  clarificationOptions, discoveryFixtures, formatDate, freshDraft, loadDraft,
  positiveQuantity, projects, searchFixtures, units,
  type Candidate, type Draft, type Line, type Unit,
} from './domain';

import { ProductPhoto } from './ProductPhoto';
import { CatalogAdmin } from './CatalogAdmin';
import { lookupContext, fallbackDescription } from './lookup';
import { cloudMode, cloudDisplayName, cloudSignOut } from './cloud-auth';
import { databaseMode, localIdentity, readDatabaseDraft, saveDatabaseDraft, databaseSearch, clearLocalSession, request, listDatabaseDrafts, type DraftPage, type AIStatus, type AIClarification } from './api';

type Stage = 'idle' | 'verified' | 'clarify';
type Message = { id: string; author: 'user' | 'assistant'; text: string };

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
  const [draftList,setDraftList]=useState<DraftPage|null>(null),[draftListOpen,setDraftListOpen]=useState(false);
  const [pendingDraft,setPendingDraft]=useState<{kind:'new'}|{kind:'open';id:string}|null>(null);
  const [compliance,setCompliance]=useState<string[]>([]);
  const [productChoices,setProductChoices]=useState<Record<string,string>>({});
  const [projectId, setProjectId] = useState(() => new URLSearchParams(window.location.search).get('project') === 'northside' ? 'northside' : 'riverside');
  const [initial] = useState<{ draft: Draft; error?: string; restored?: boolean }>(() => databaseMode ? { draft: freshDraft(projectId) } : loadDraft(projectId,new URLSearchParams(window.location.search).get('draft')??undefined));
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [databaseBusy, setDatabaseBusy] = useState(databaseMode);
  const [dirty, setDirty] = useState(false);
  const [storageError, setStorageError] = useState(initial.error ?? '');
  const [announcement, setAnnouncement] = useState(initial.restored ? 'Your saved local draft has been restored.' : '');
  const [active, setActive] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit | ''>('');
  const [description, setDescription] = useState('');
  const [entryError, setEntryError] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [searchedDescription, setSearchedDescription] = useState('');
  const [choice, setChoice] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [aiEnabled,setAIEnabled] = useState(false);
  const [aiBusy,setAIBusy] = useState(false);
  const [aiError,setAIError] = useState('');
  const [aiWording,setAIWording] = useState('');
  const lookupSession = useRef(crypto.randomUUID());
  const [customDescription, setCustomDescription] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Candidate[]>([]);
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
  const chatRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const project = projects.find(p => p.id === projectId)!;

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
    if (choice) chatRef.current?.focus({ preventScroll: true });
  }, [choice]);

  useEffect(() => {
    const composer = chatRef.current;
    if (!composer) return;
    composer.style.height = 'auto';
    composer.style.height = `${Math.min(150, composer.scrollHeight + 2)}px`;
    if (!message) composer.scrollTop = 0;
  }, [message, choice]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!databaseMode) return;
    let cancelled = false;
    request<AIStatus>('/lookup/status').then(status=>{if(!cancelled)setAIEnabled(status.enabled);}).catch(()=>{});
    readDatabaseDraft(projectId,new URLSearchParams(window.location.search).get('draft')??undefined).then(saved => {
      if (!cancelled) { if(saved&&saved.projectId!==projectId)throw new Error('This draft belongs to another project. Choose its project before opening it.');setDraft(saved ?? freshDraft(projectId));if(saved)setDraftAddress(projectId,saved.id); setAnnouncement(cloudMode ? (saved ? 'Draft restored from Azure SQL.' : 'Azure SQL ready. AI discovery is disabled.') : saved ? 'Draft restored from the local database.' : 'Local database ready. Fixture catalog; test session only.'); }
    }).catch(error => { if (!cancelled) setStorageError(error instanceof Error ? error.message : 'Local database unavailable.'); })
      .finally(() => { if (!cancelled) setDatabaseBusy(false); });
    return () => { cancelled = true; };
  }, []);

  function changeDraft(update: (current: Draft) => Draft) {
    if(draft.submitted){setStorageError('Submitted MRFs are locked. Create a revision for changes.');return;}
    setCompliance([]);
    setDraft(update);
    setDirty(true);
  }

  function resetEntry() {
    setStage('idle'); setMatches([]); setSuggestions([]); setChoice('');
    setMessages([]); setMessage(''); setCustomDescription(null); setAIError(''); setAIWording(''); lookupSession.current=crypto.randomUUID(); setAdded([]); setEntryError('');
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
    setAnnouncement(found.length ? `${found.length} ${cloudMode ? "catalog" : "demo catalog"} matches found.` : cloudMode ? 'No catalog match found. Clarify the material below or use your description.' : 'No demo catalog match found. Clarify the material below or use your description.');
  }

  function requireEntry(): boolean {
    if (!positiveQuantity(quantity)) { setEntryError('Enter a quantity greater than zero before adding an item.'); document.getElementById('quantity')?.focus(); return false; }
    if (!unit) { setEntryError('Choose your quantity unit. A product’s package unit does not tell us whether you mean feet, sticks, or each.'); unitRef.current?.focus(); return false; }
    return true;
  }

  function addLine(candidate: Candidate | null) {
    if (candidate && added.includes(candidate.id)) return;
    if (!candidate && added.includes('description')) return;
    if (!requireEntry()) return;
    const ownDescription = customDescription ?? fallbackDescription(description, messages);
    if (!candidate && (!ownDescription.trim() || ownDescription.length > 2000)) { setEntryError('Your description must contain 1–2000 characters. Edit Description to add before continuing.'); return; }
    const product=candidate?.products?.find(p=>p.id===(productChoices[candidate.id]??candidate.products?.[0]?.id))??candidate?.products?.[0];
    const line: Line = {
      id: crypto.randomUUID(), quantity, requestedUnit: unit as Unit,
      description: candidate?.description ?? ownDescription.trim(),
      rawInput: { quantity, description: searchedDescription || description.trim(), requestedUnit: unit as Unit },
      candidate: candidate ? { ...candidate, specs: [...candidate.specs] } : null,
      purchasing:product?{productId:product.id,manufacturer:product.manufacturer,partNumber:product.partNumber,noSubstitutions:false}:undefined,
      source: candidate?.source ?? 'user_description', deliveryMode: 'inherit', overrideDate: null,
    };
    changeDraft(current => ({ ...current, lines: [...current.lines, line] }));
    if(databaseMode&&candidate&&/^[a-f\d-]{36}$/i.test(candidate.id)&&line.rawInput.description.length<=500)void request('/catalog/selection','POST',{eventId:line.id,projectId,materialId:candidate.id,productId:product?.id??null,phrase:line.rawInput.description}).catch(()=>setEntryError('Item added, but its search phrase could not be learned. Save your draft to preserve the line.'));
    setAdded(current => [...current, candidate?.id ?? 'description']);
    setEntryError('');
    setAnnouncement(`Added ${line.description} to your MRF. ${quantity} ${unit}; using the MRF delivery date. Save your draft to keep it.`);
  }

  function clarify() {
    setStage('clarify'); setChoice(''); setMessages([]); setSuggestions([]); setMessage('');
    setAnnouncement('Let’s clarify what you need. Choose an option or describe it in your own words.');
  }

  function chooseOption(id: string) {
    setChoice(id);
    setSuggestions([]);
    // Retain the transcript when changing an option for this same lookup.
    setMessages(current => [...current, { id: crypto.randomUUID(), author: 'assistant', text: lookupContext(searchedDescription || description, current, id).reply }]);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || aiBusy) return;
    const next: Message[] = [...messages, { id: crypto.randomUUID(), author: 'user', text }];
    const result = lookupContext(searchedDescription || description, next, choice);
    if (!cloudMode && /black|device|electrical box|6.?32/i.test([searchedDescription, ...next.filter(m => m.author === 'user').map(m => m.text)].join(' '))) setSuggestions(discoveryFixtures);
    let response = result.reply;
    setAIError('');
    if (aiEnabled && databaseMode) {
      if (!unit) { setEntryError('Choose your quantity unit before using live AI.'); unitRef.current?.focus(); return; }
      setAIBusy(true);setMessages(next);
      try {
        const value=await request<AIClarification>('/lookup/clarify','POST',{projectId,sessionId:lookupSession.current,turnId:crypto.randomUUID(),description:searchedDescription||description,quantity,requestedUnit:unit,choice,turns:next.map(({author,text})=>({author,text}))});
        response=`${value.summary} ${value.reply}`;setAIWording(value.description);
      } catch(error) { setAIError(error instanceof Error?error.message:'AI unavailable. Your details are retained.'); }
      finally { setAIBusy(false); }
    }
    setMessages([...next, { id: crypto.randomUUID(), author: 'assistant', text: response }]);
    setMessage('');
    setAnnouncement('Clarification details retained.');
    chatRef.current?.focus();
  }

  function setDraftAddress(project:string,id?:string){const url=new URL(window.location.href);url.searchParams.set('project',project);if(id)url.searchParams.set('draft',id);else url.searchParams.delete('draft');window.history.replaceState(null,'',url);}
  async function showDrafts(page=1){
    try{setDatabaseBusy(true);const list=databaseMode?await listDatabaseDrafts(projectId,page):listBrowserDrafts(projectId,page);setDraftList(list);setDraftListOpen(true);}
    catch(error){setStorageError(error instanceof Error?error.message:'Could not load saved drafts.');}
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
      const saved = databaseMode ? await saveDatabaseDraft({...draft,name:draft.name.trim()}) : saveBrowserDraft(draft);
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
      setProjectId(id); setDraft(loaded.draft); setStorageError(loaded.error ?? ''); setDirty(false);
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
    if (pendingLeave) { setActive(false); clearLocalSession(); if (cloudMode) void cloudSignOut(); setProfileOpen(false); setDirty(false); }
    closeConfirmation();
  }

  function leaveDemo() {
    if (dirty) setPendingLeave(true);
    else { setActive(false); clearLocalSession(); if (cloudMode) void cloudSignOut(); setProfileOpen(false); }
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
    updateLine(editing.id, { purchasing: purchasing?{...purchasing,manufacturer:purchasing.manufacturer.trim(),partNumber:purchasing.partNumber.trim()}:undefined, quantity: editing.quantity, requestedUnit: editing.requestedUnit, description: editing.description.trim() });
    editRef.current?.close(); setEditError('');
    setAnnouncement('Item updated. Original input has been preserved.');
  }

  const resultTable = (candidates: Candidate[], isAI = false) => <>
    <div className="results-table" role="table" aria-label={isAI ? 'Mock AI material suggestions' : cloudMode ? 'Catalog matches' : 'Demo catalog matches'}>
      <div className="result-head" role="row"><span role="columnheader">Image</span><span role="columnheader">Material description</span><span role="columnheader">Product UOM</span><span role="columnheader">Specifications</span><span role="columnheader">Action</span></div>
      {candidates.map(candidate => <div className={`result-row ${added.includes(candidate.id) ? 'is-added' : ''}`} role="row" key={candidate.id}>
        <div role="cell" className="result-image"><ProductImage category={candidate.category} candidate={candidate} /></div>
        <div role="cell" className="result-description"><strong>{candidate.description}</strong><SourceTag source={candidate.source} verification={candidate.verification} />{candidate.highUse&&<span className="source-tag">High use</span>}{Boolean(candidate.products?.length)&&<label className="result-product">Manufacturer product<select aria-label={`Manufacturer product for ${candidate.description}`} value={productChoices[candidate.id]??candidate.products![0].id} onChange={event=>setProductChoices(current=>({...current,[candidate.id]:event.target.value}))}>{candidate.products!.map(product=><option value={product.id} key={product.id}>{product.manufacturer} · {product.partNumber}{product.verification==='provisional'?' · provisional':''}</option>)}</select></label>}{isAI && <span className="muted source-disclosure">Illustrative fixture · no live source</span>}</div>
        <div role="cell" className="result-uom"><span className="mobile-label">Product UOM</span><span className="unit-badge">{candidate.productUnit}</span></div>
        <div role="cell" className="specs"><span className="mobile-label">Specifications</span>{candidate.specs.join(' · ')}</div>
        <div role="cell" className="result-action"><button type="button" className={`button add-button ${added.includes(candidate.id) ? 'added-button' : ''}`} disabled={added.includes(candidate.id)} onClick={() => addLine(candidate)} aria-label={`${added.includes(candidate.id) ? 'Added' : 'Add'} ${candidate.description}`}>
          {added.includes(candidate.id) ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{added.includes(candidate.id) ? 'Added' : 'Add'}
        </button></div>
      </div>)}
    </div>
    {unit && candidates.some(candidate => candidate.productUnit !== unit) && <p className="unit-note"><Info size={14} aria-hidden="true" />Your quantity stays in {unit}. Product/package UOM is shown separately; no conversion is assumed.</p>}
  </>;

  if (!active) return <main className="resume-page"><Brand /><section className="resume-panel"><span className="eyebrow">LOCAL PROOF OF CONCEPT</span><h1>Your work, ready when you are.</h1><p>You’ve left the demo. {databaseMode ? 'Saved drafts remain in the local database for this test account.' : 'Saved drafts remain in this browser; unsaved changes are not retained.'}</p><button className="button primary" onClick={resumeDemo}>Resume demo <ArrowRight size={16} aria-hidden="true" /></button><p className="fine-print">This is a local demo session, not Microsoft sign-in. {databaseMode ? 'Data is stored in your local development database.' : 'No data is sent to a server.'}</p></section></main>;

  return <>
    {(databaseBusy||aiBusy) && <div className="database-progress" role="status">{aiBusy ? 'Interpreting your material request…' : cloudMode ? 'Connecting to Azure SQL…' : 'Connecting to local database…'}</div>}
    <a className="skip-link" href="#main">Skip to MRF Builder</a>
    <aside className="desktop-sidebar"><Brand /><Navigation /></aside>
    <header className="topbar">
      <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => menuRef.current?.showModal()}><Menu size={23} aria-hidden="true" /></button>
      <div className="project-picker"><label htmlFor="project-select" className="sr-only">Project</label><div className="project-select-wrap"><select id="project-select" value={projectId} disabled={aiBusy||databaseBusy} onChange={event => { if (dirty) setPendingProject(event.target.value); else activateProject(event.target.value); }}>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div><span>Project #{project.number} <span className="project-mock">· Demo</span></span></div>
      <form className="global-search" onSubmit={event => { event.preventDefault(); if (globalSearch.trim()) { setDescription(globalSearch.trim()); resetEntry(); descriptionRef.current?.focus(); setAnnouncement('Description filled. Enter a quantity, then Find Matches.'); } }}><Search size={17} aria-hidden="true" /><input aria-label={cloudMode ? 'Search materials' : 'Search demo materials'} placeholder={cloudMode ? 'Search materials…' : 'Search demo materials…'} value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} /><button className="sr-only" type="submit">Use search as description</button></form>
      <div className="profile"><button className="avatar" aria-label={cloudMode ? 'Account menu' : 'Demo session menu'} aria-expanded={profileOpen} onClick={() => setProfileOpen(current => !current)}>{cloudMode ? cloudDisplayName().split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase() : 'DM'}</button>{profileOpen && <div className="profile-menu"><strong>{cloudMode ? cloudDisplayName() : databaseMode ? localIdentity : 'Demo foreman'}</strong><span>{cloudMode ? 'Microsoft work account' : 'Local session · no sign-in'}</span><button className="button text-button" onClick={leaveDemo}><LogOut size={15} aria-hidden="true" />{cloudMode ? 'Sign out' : 'Leave demo'}</button></div>}</div>
    </header>

    <main id="main" className="workspace" tabIndex={-1} inert={(databaseBusy||aiBusy) || undefined} aria-busy={databaseBusy||aiBusy}>
      <div className="page-heading"><h1>MRF Builder</h1><AdminWorkspace /><CatalogAdmin /><UserAdmin /><span className="demo-badge">{cloudMode ? 'Cloud pilot' : 'Local preview'}</span></div>
      <div className="demo-notice"><Info size={14} aria-hidden="true" /><span>{cloudMode ? (aiEnabled ? 'Microsoft sign-in · Azure SQL · AI clarification enabled · external search disabled · example projects.' : 'Microsoft sign-in · Azure SQL · AI discovery disabled · example projects.') : databaseMode ? 'Local database demo · scripted AI · no Microsoft sign-in. Test account: ' + localIdentity : 'Demo data and scripted AI. Drafts save only in this browser. No live catalog or Microsoft sign-in.'}</span></div>
      <section className="panel draft-tools" aria-label="Draft identification"><label htmlFor="mrf-name">MRF name<input id="mrf-name" readOnly={Boolean(draft.submitted)} required maxLength={120} value={draft.name??'Saved MRF'} placeholder="e.g. Level 2 Rough-In" onChange={event=>changeDraft(current=>({...current,name:event.target.value}))}/></label><div className="catalog-actions"><button className="button" onClick={()=>chooseDraft({kind:'new'})}>New MRF</button><button className="button" onClick={()=>void showDrafts()}>My Drafts</button></div></section>
      {draftListOpen&&draftList&&<section className="panel saved-drafts" aria-label="My Drafts"><div className="section-heading"><h2>My Drafts</h2><button className="button" onClick={()=>setDraftListOpen(false)}>Close draft list</button></div><p>{project.name} · {draftList.total} saved drafts</p>{draftList.records.length===0&&<p>No saved drafts for this project yet.</p>}{draftList.records.map(item=><article key={item.id}><h3>{item.name}</h3><p>{item.itemCount} items · Delivery {formatDate(item.deliveryDate)} · Last saved {new Date(item.savedAt).toLocaleString()}</p><button className="button" onClick={()=>chooseDraft({kind:'open',id:item.id})}>Continue {item.name}</button></article>)}<div className="catalog-actions"><button className="button" disabled={draftList.page<=1} onClick={()=>void showDrafts(draftList.page-1)}>Previous drafts</button><span>Page {draftList.page} of {draftList.pages}</span><button className="button" disabled={draftList.page>=draftList.pages} onClick={()=>void showDrafts(draftList.page+1)}>Next drafts</button></div></section>}
      <section className="panel draft-header" aria-label="MRF header">
        <div className="foreman"><span className="header-icon"><span className="person-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="7" r="3.2" /><path d="M4.5 20v-2a7.5 7.5 0 0 1 15 0v2z" /></svg></span></span><div><span className="field-caption">Foreman</span><strong>{cloudMode ? cloudDisplayName() : databaseMode ? localIdentity : 'Demo foreman'}</strong></div></div>
        <div className="header-date"><label htmlFor="delivery-date" className="field-caption">MRF Delivery Date</label><input id="delivery-date" type="date" readOnly={Boolean(draft.submitted)} required value={draft.deliveryDate} onChange={event => { if (event.target.value) changeDraft(current => ({ ...current, deliveryDate: event.target.value })); }} /><span className="sr-only">Default for items using the MRF date</span></div>
        <div className="save-area">{databaseMode&&<button className="button" onClick={()=>void request<{issues:{lineId:string;message:string}[];ready:boolean}>('/catalog/validate-lines','POST',{projectId,lines:draft.lines}).then(result=>{setCompliance(result.issues.map(issue=>`Item ${draft.lines.findIndex(line=>line.id===issue.lineId)+1}: ${issue.message}`));setAnnouncement(result.ready?'Manufacturer and job restriction checks passed. No order was submitted.':'Some items need correction before purchasing. Your draft is preserved.');}).catch(error=>setEntryError(error.message))}>Check purchasing requirements</button>}<button className="button save-button" disabled={Boolean(draft.submitted)} onClick={saveDraft}><Save size={16} aria-hidden="true" />Save as Draft</button><span className={`save-status ${dirty ? 'unsaved' : ''}`}>{dirty ? 'Unsaved changes' : draft.savedAt ? (cloudMode ? 'Saved in Azure SQL' : databaseMode ? 'Saved in local database' : 'Saved in this browser') : 'Not saved yet'}</span></div>
      </section>
      <SubmissionCenter projectId={projectId} draft={draft} prepare={prepareSubmission} onSubmitted={submissionSaved} onOpenDraft={id=>chooseDraft({kind:'open',id})}/>
      {storageError && <div className="error-message" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{storageError}</span></div>}

      <div inert={draft.submitted?true:undefined}>
      <section className="panel entry-panel" aria-label="Add a material">
        <form onSubmit={event => search(event)} className="entry-form" noValidate>
          <div className="quantity-group"><div className="field"><label htmlFor="quantity">Quantity</label><input id="quantity" inputMode="decimal" autoComplete="off" placeholder="e.g. 200" value={quantity} maxLength={14} onChange={event => { setQuantity(event.target.value); setEntryError(''); }} aria-invalid={entryError.startsWith('Enter a quantity') || undefined} aria-describedby={entryError ? 'entry-error' : undefined} /></div><div className="field unit-field"><label htmlFor="quantity-unit">Unit</label><select id="quantity-unit" ref={unitRef} value={unit} onChange={event => { setUnit(event.target.value as Unit); setEntryError(''); }} aria-invalid={entryError.startsWith('Choose your') || undefined} aria-describedby={entryError ? 'entry-error' : undefined}><option value="">Choose…</option>{units.map(u => <option value={u} key={u}>{u}</option>)}</select></div></div>
          <div className="field description-field"><label htmlFor="description">Description</label><input id="description" ref={descriptionRef} value={description} maxLength={2000} placeholder={'e.g. 1" PVC or self tappers'} onChange={event => { setDescription(event.target.value); resetEntry(); }} autoComplete="off" aria-describedby={entryError ? 'entry-error' : undefined} /></div>
          <button className="button primary find-button" type="submit"><Search size={16} className="mobile-only" aria-hidden="true" />Find Matches</button>
        </form>
        {entryError && <p className="entry-error" id="entry-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{entryError}</p>}
      </section>

      {stage === 'idle' && <section className="panel getting-started"><span className="empty-icon"><Search size={23} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>Start with the material you need.</h2><p>{cloudMode ? 'Enter a quantity and description to search your catalog. AI discovery is currently disabled.' : 'Enter a quantity and description. We’ll check the demo catalog first, then help clarify if there’s no match.'}</p><div className="try-search"><span>{cloudMode ? 'Example searches:' : 'Try a demo:'}</span><button onClick={() => { setQuantity('1000'); setDescription('1" PVC'); setUnit(''); resetEntry(); descriptionRef.current?.focus(); }}>1" PVC</button><span aria-hidden="true">·</span><button onClick={() => { setQuantity('200'); setDescription('self tappers'); setUnit('EA'); resetEntry(); descriptionRef.current?.focus(); }}>self tappers</button></div></div></section>}

      {stage === 'verified' && <section className="panel results-panel" aria-label="Translation results"><SectionHeading title="Translation matches" aside={<span className="count-badge">{matches.length} matches</span>}>{databaseMode ? 'Local database matches for “' + searchedDescription + '”. Fixture records are labeled.' : 'Demo verified-match layout for “' + searchedDescription + '”. These are fictional catalog fixtures.'}</SectionHeading>{resultTable(matches)}<div className="panel-footer"><button className="button text-button" onClick={clarify}>None of these is what I want <ArrowRight size={15} aria-hidden="true" /></button><span className="muted">Add a match directly from its row.</span></div></section>}

      {stage === 'clarify' && <>
        <div className="no-match" role="status"><AlertCircle size={19} aria-hidden="true" /><div><strong>No translation match found</strong><p>{matches.length ? 'Let’s find a better match for' : 'No confident demo catalog match for'} <strong>“{searchedDescription}”</strong>.</p></div></div>
        <section className="panel clarification-panel" aria-label="Material clarification">
          <SectionHeading title="Are you looking for…?">Choose the closest option, or tell the assistant what you need in your own words.</SectionHeading>
          <fieldset className="clarification-options"><legend className="sr-only">Clarify your material</legend>{clarificationOptions.map(option => <label className={`clarification-option ${choice === option.id ? 'selected' : ''}`} key={option.id}><input type="radio" name="clarification" value={option.id} checked={choice === option.id} onChange={() => chooseOption(option.id)} /><span className="choice-image">{option.id === 'other' ? <Ellipsis size={23} aria-hidden="true" /> : <ProductImage category="screw" small />}</span><span><strong>{option.title}</strong><span className="choice-detail">{option.detail}</span></span></label>)}</fieldset>
          {choice ? <div className="conversation"><div className="conversation-label"><Sparkles size={14} aria-hidden="true" />{aiEnabled ? 'AI material clarification' : cloudMode ? 'Material clarification' : 'Demo assistant'}<span>{aiEnabled ? 'Unverified interpretation · no web search' : cloudMode ? 'AI discovery disabled' : 'Scripted responses'}</span></div><div className="transcript" ref={transcriptRef} role="log" aria-label="Clarification conversation" aria-live="polite">{messages.map(m => <div className={`message ${m.author}`} key={m.id}><span className={`message-avatar ${m.author === 'assistant' ? 'ai-avatar' : ''}`} aria-hidden="true">{m.author === 'assistant' ? <Sparkles size={20} /> : 'DM'}</span><div className="message-bubble"><span className="sr-only">{m.author === 'assistant' ? 'Demo assistant' : 'You'}: </span>{m.text}</div></div>)}</div><form className="chat-form" onSubmit={sendMessage}><MessageSquare size={19} className="chat-icon" aria-hidden="true" /><label className="sr-only" htmlFor="chat-input">Tell the assistant what you are looking for</label><textarea id="chat-input" disabled={aiBusy} ref={chatRef} value={message} maxLength={2000} placeholder="Describe what you need…" rows={1} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(event); } }} /><button className="icon-button send-button" type="submit" disabled={!message.trim()||aiBusy} aria-label="Send message"><Send size={19} aria-hidden="true" /></button></form></div>
            : <p className="clarify-hint"><MessageSquare size={15} aria-hidden="true" />Select “Other / none of these” to start a conversation.</p>}
          {aiBusy && <p role="status">Interpreting your request…</p>}{aiError && <p className="error-message" role="alert">{aiError}</p>}{aiWording && <div className="clarification-summary"><strong>AI wording · unverified</strong><p>{aiWording}</p><button className="button" onClick={()=>setCustomDescription(aiWording)}>Use AI wording for my description</button><span className="muted">Review this wording first. Original input stays separate; this does not create a catalog match.</span></div>}
          {messages.some(m => m.author === 'user') && <div className="clarification-summary"><label htmlFor="clarified-description">Description to add</label><textarea id="clarified-description" value={customDescription ?? fallbackDescription(description, messages)} onChange={event => setCustomDescription(event.target.value)} rows={3} />{customDescription !== null && <button className="button text-button" onClick={() => setCustomDescription(null)}>Use conversation wording</button>}<span className="muted">Your original entry and these clarification details stay separate from verified catalog facts. You can edit the line after adding it.</span></div>}
          <div className="panel-footer fallback-footer"><span className="muted">Can’t find the right item? Keep your own wording.</span><button className="button" type="button" disabled={added.includes('description')} onClick={() => addLine(null)}>{added.includes('description') ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{added.includes('description') ? 'Description added' : 'Use My Description'}</button></div>
        </section>
        {suggestions.length > 0 && <section className="panel results-panel" aria-label="AI suggestions"><SectionHeading title="Suggested materials" aside={<span className="source-tag provisional"><Sparkles size={12} aria-hidden="true" />Mock discovery</span>}>Illustrative candidates only. Live product discovery, sources, and approved photos are not connected.</SectionHeading>{resultTable(suggestions, true)}</section>}
      </>}

      <section className="panel item-list" aria-label="MRF Item List"><SectionHeading title="MRF Item List" aside={<span className="count-badge">{draft.lines.length} {draft.lines.length === 1 ? 'item' : 'items'}</span>}>Materials added to your request.</SectionHeading>
        <div className="item-table-wrap"><table className="item-table"><thead><tr><th scope="col" className="number-column">#</th><th scope="col" className="image-column">Image</th><th scope="col">Material description</th><th scope="col" className="quantity-column">Qty / UOM</th><th scope="col" className="delivery-column">Item delivery</th><th scope="col" className="action-column">Actions</th></tr></thead><tbody>
          {draft.lines.length === 0 ? <tr className="empty-row"><td colSpan={6}><div className="empty-list"><FileText size={38} strokeWidth={1.3} aria-hidden="true" /><div><strong>No items added yet</strong><span>Find a match above to add items to your MRF.</span></div></div></td></tr>
            : draft.lines.map((line, index) => <tr key={line.id} data-testid="mrf-line"><td className="line-number"><span className="mobile-label">Item </span>{String(index + 1).padStart(2, '0')}</td><td className="line-image"><ProductImage category={line.candidate?.category ?? 'conduit'} candidate={line.candidate??undefined} productId={line.purchasing?.productId} small /></td><td className="line-description"><strong>{line.description}</strong><SourceTag source={line.source} verification={line.candidate?.verification} />{line.purchasing?.manufacturer&&<p className="line-manufacturer">{line.purchasing.manufacturer} · {line.purchasing.partNumber}<br/><strong>{line.purchasing.noSubstitutions?'No Substitutions — exact product required':'Requested example · substitutions allowed subject to job rules'}</strong></p>}<details><summary>Original input</summary><p>{line.rawInput.quantity} {line.rawInput.requestedUnit} · {line.rawInput.description}</p>{line.candidate && <p>Product UOM: {line.candidate.productUnit}. No quantity conversion applied.</p>}</details></td><td className="line-quantity"><span className="mobile-label">Quantity</span><strong>{line.quantity}</strong> <span>{line.requestedUnit}</span></td><td className="line-delivery"><label className="sr-only" htmlFor={`mode-${line.id}`}>Delivery mode for item {index + 1}</label><select id={`mode-${line.id}`} value={line.deliveryMode} onChange={event => updateLine(line.id, event.target.value === 'inherit' ? { deliveryMode: 'inherit', overrideDate: null } : { deliveryMode: 'override', overrideDate: draft.deliveryDate })}><option value="inherit">Use MRF Date</option><option value="override">Item Delivery Override</option></select>{line.deliveryMode === 'override' ? <><label className="sr-only" htmlFor={`override-${line.id}`}>Delivery override for item {index + 1}</label><input id={`override-${line.id}`} type="date" value={line.overrideDate ?? ''} onChange={event => { if (event.target.value) updateLine(line.id, { overrideDate: event.target.value }); }} /></> : <span className="inherited-date" data-testid="effective-date">{formatDate(draft.deliveryDate)}</span>}</td><td className="line-actions"><button className="icon-button" aria-label={`Edit item ${index + 1}`} onClick={event => { editTriggerRef.current = event.currentTarget; setEditing({ ...line }); setEditError(''); }}><Pencil size={16} aria-hidden="true" /></button><button className="icon-button remove-button" aria-label={`Remove item ${index + 1}`} onClick={() => setRemoving(line)}><Trash2 size={16} aria-hidden="true" /></button></td></tr>)}
        </tbody></table></div>
        {draft.lines.length > 0 && <div className="list-footer"><span><Info size={14} aria-hidden="true" />Items use the MRF date unless you choose an override.</span><button className="button text-button" onClick={() => { setDescription(''); setQuantity(''); setUnit(''); resetEntry(); descriptionRef.current?.focus(); }}><Plus size={15} aria-hidden="true" />Next material</button></div>}
      </section>
      </div>
      <footer className="workspace-footer"><span>EtalonOps · MRF Builder POC</span><span>{draft.submitted?`${draft.submitted.number} submitted. No purchase order placed.`:'This MRF is a draft. Saving does not submit or place an order.'}</span></footer>
      {compliance.length>0&&<div role="alert" className="entry-error">{compliance.map((issue,i)=><p key={i}>{issue}</p>)}</div>}<div className={`status-bar ${announcement ? 'has-message' : ''}`} role="status" aria-live="polite" aria-atomic="true">{announcement && <><Check size={15} aria-hidden="true" /><span>{announcement}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setAnnouncement('')}><X size={15} aria-hidden="true" /></button></>}</div>
    </main>

    <dialog className="mobile-menu" ref={menuRef} aria-label="Navigation"><div className="mobile-menu-heading"><Brand /><button className="icon-button" aria-label="Close navigation" onClick={() => menuRef.current?.close()}><X size={22} aria-hidden="true" /></button></div><Navigation onNavigate={() => menuRef.current?.close()} /></dialog>
    <dialog className="modal edit-modal" ref={editRef} aria-labelledby="edit-title" onClose={() => { setEditing(null); editTriggerRef.current?.focus({ preventScroll: true }); }}>{editing && <form onSubmit={saveEdit} noValidate><div className="modal-heading"><div><span className="eyebrow">MRF ITEM</span><h2 id="edit-title">Edit material</h2></div><button className="icon-button" type="button" aria-label="Close edit" onClick={() => editRef.current?.close()}><X size={20} aria-hidden="true" /></button></div><div className="field"><label htmlFor="edit-description">Material description</label><textarea id="edit-description" value={editing.description} maxLength={2000} rows={3} onChange={event => setEditing({ ...editing, description: event.target.value })} /></div><div className="edit-quantity"><div className="field"><label htmlFor="edit-quantity">Quantity</label><input id="edit-quantity" inputMode="decimal" maxLength={14} value={editing.quantity} onChange={event => setEditing({ ...editing, quantity: event.target.value })} /></div><div className="field"><label htmlFor="edit-unit">Requested unit</label><select id="edit-unit" value={editing.requestedUnit} onChange={event => setEditing({ ...editing, requestedUnit: event.target.value as Unit })}>{units.map(u => <option key={u}>{u}</option>)}</select></div></div><PurchasingFields projectId={projectId} line={editing} onChange={purchasing=>setEditing({...editing,purchasing})}/><p className="fine-print">Original input and source are preserved. Editing does not create or verify a catalog translation.</p>{editError && <p className="entry-error" role="alert">{editError}</p>}<div className="modal-actions"><button type="button" className="button" onClick={() => editRef.current?.close()}>Cancel</button><button className="button primary" type="submit">Save item changes</button></div></form>}</dialog>
    <dialog className="modal confirm-modal" ref={confirmRef} aria-labelledby="confirm-title" onCancel={closeConfirmation}><div className="modal-heading"><h2 id="confirm-title">{removing ? 'Remove this item?' : 'Save your draft first?'}</h2><button className="icon-button" aria-label="Close confirmation" onClick={closeConfirmation}><X size={20} aria-hidden="true" /></button></div>{removing ? <><p>{removing.description}</p><p className="muted">Only this MRF line will be removed.</p><div className="modal-actions"><button className="button" onClick={closeConfirmation}>Keep item</button><button className="button danger" onClick={() => { changeDraft(current => ({ ...current, lines: current.lines.filter(line => line.id !== removing.id) })); setAdded([]); setAnnouncement('Item removed. Save your draft to keep this change.'); closeConfirmation(); }}>Remove item</button></div></> : <><p>You have unsaved changes. Save them before {pendingDraft?'opening another MRF':pendingProject ? 'switching projects' : 'leaving'}. Your other saved drafts will remain available.</p><div className="modal-actions navigation-actions"><button className="button" onClick={closeConfirmation}><ArrowLeft size={15} aria-hidden="true" />Stay here</button><button className="button text-button" onClick={() => finishNavigation(false)}>Discard changes</button><button className="button primary" onClick={() => finishNavigation(true)}>Save and continue</button></div></>}</dialog>
  </>;
}
