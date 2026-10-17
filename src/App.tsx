import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, Ellipsis,
  FileText, FolderKanban, Home, Info, LogOut, Menu, MessageSquare, Package,
  Pencil, Plus, Save, Search, Send, Settings, ShieldCheck, ShoppingCart,
  Sparkles, Trash2, X, ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import {
  clarificationOptions, discoveryFixtures, formatDate, freshDraft, loadDraft,
  positiveQuantity, projects, searchFixtures, storageKey, units,
  type Candidate, type Draft, type Line, type Unit,
} from './domain';

import { databaseMode, localIdentity, readDatabaseDraft, saveDatabaseDraft, databaseSearch, clearLocalSession } from './api';

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

function ProductImage({ category, small = false }: { category: Candidate['category']; small?: boolean }) {
  return <div className={`product-image ${small ? 'small' : ''}`} aria-label="No approved product image">
    <Package size={small ? 19 : 25} strokeWidth={1.25} aria-hidden="true" />
    {!small && <span>No image</span>}
    <span className="sr-only">{category}; image unavailable in demo</span>
  </div>;
}

function SectionHeading({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{children && <p>{children}</p>}</div>{aside}</div>;
}

function SourceTag({ source }: { source: Line['source'] }) {
  const label = source === 'verified' ? 'Reviewed catalog' : source === 'verified_fixture' ? 'Catalog fixture' : source === 'ai_fixture' ? 'AI mock · unverified' : 'Your description';
  return <span className={`source-tag ${source === 'ai_fixture' ? 'provisional' : ''}`}>{(source === 'verified_fixture' || source === 'verified') && <ShieldCheck size={12} aria-hidden="true" />}{label}</span>;
}

export default function App() {
  const [projectId, setProjectId] = useState('riverside');
  const [initial] = useState<{ draft: Draft; error?: string; restored?: boolean }>(() => databaseMode ? { draft: freshDraft('riverside') } : loadDraft('riverside'));
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
    if ((removing || pendingProject || pendingLeave) && !confirmRef.current?.open) confirmRef.current?.showModal();
  }, [removing, pendingProject, pendingLeave]);

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
    readDatabaseDraft('riverside').then(saved => {
      if (!cancelled) { setDraft(saved ?? freshDraft('riverside')); setAnnouncement(saved ? 'Draft restored from the local database.' : 'Local database ready. Fixture catalog; test session only.'); }
    }).catch(error => { if (!cancelled) setStorageError(error instanceof Error ? error.message : 'Local database unavailable.'); })
      .finally(() => { if (!cancelled) setDatabaseBusy(false); });
    return () => { cancelled = true; };
  }, []);

  function changeDraft(update: (current: Draft) => Draft) {
    setDraft(update);
    setDirty(true);
  }

  function resetEntry() {
    setStage('idle'); setMatches([]); setSuggestions([]); setChoice('');
    setMessages([]); setMessage(''); setAdded([]); setEntryError('');
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
      found = databaseMode ? await databaseSearch(input) : searchFixtures(input);
    } catch { setEntryError('Catalog search is unavailable. Your input is preserved; please retry.'); return; }
    finally { setDatabaseBusy(false); }
    setMatches(found);
    setStage(found.length ? 'verified' : 'clarify');
    setAnnouncement(found.length ? `${found.length} demo catalog matches found.` : 'No demo catalog match found. Clarify the material below or use your description.');
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
    const line: Line = {
      id: crypto.randomUUID(), quantity, requestedUnit: unit as Unit,
      description: candidate?.description ?? description.trim(),
      rawInput: { quantity, description: searchedDescription || description.trim(), requestedUnit: unit as Unit },
      candidate: candidate ? { ...candidate, specs: [...candidate.specs] } : null,
      source: candidate?.source ?? 'user_description', deliveryMode: 'inherit', overrideDate: null,
    };
    changeDraft(current => ({ ...current, lines: [...current.lines, line] }));
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
    const selected = clarificationOptions.find(option => option.id === id)!;
    setSuggestions([]);
    setMessages([{ id: crypto.randomUUID(), author: 'assistant', text: id === 'other'
      ? 'Tell me what you’re using it for, or describe the material in your own words.'
      : `You chose ${selected.title.toLowerCase()}. What size, finish, or application do you need?` }]);
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    const context = [...messages.filter(m => m.author === 'user').map(m => m.text), text].join(' ');
    let reply: string;
    if (/black|device|electrical box|6.?32/i.test(context)) {
      reply = 'Are you looking for black 6-32 device mounting screws? I’ve shown two illustrative options below. What length do you need? No live catalog or AI search has been run.';
      setSuggestions(discoveryFixtures);
    } else if (/hex|metal|pan|screw|tek/i.test(context)) {
      reply = 'What thread or diameter, length, and finish do you need? For example: black 6-32 device screws. This demo uses scripted replies, not live AI.';
    } else {
      reply = 'Could you tell me what it attaches to, its approximate size, and any material or finish? If you’re unsure, Use My Description will keep your wording without a catalog match.';
    }
    setMessages(current => [...current, { id: crypto.randomUUID(), author: 'user', text }, { id: crypto.randomUUID(), author: 'assistant', text: reply }]);
    setMessage('');
    setAnnouncement('Demo assistant replied.');
    chatRef.current?.focus();
  }

  async function saveDraft(): Promise<boolean> {
    try {
      if (databaseMode) setDatabaseBusy(true);
      const saved = databaseMode ? await saveDatabaseDraft(draft) : { ...draft, savedAt: new Date().toISOString() };
      if (!databaseMode) localStorage.setItem(storageKey(projectId), JSON.stringify(saved));
      setDraft(saved); setDirty(false); setStorageError('');
      setAnnouncement(databaseMode ? 'Draft saved in the local development database for this test account.' : 'Draft saved in this browser. You can leave the demo and resume it here.');
      return true;
    } catch (error) {
      setStorageError(databaseMode ? (error instanceof Error ? error.message : 'Database save failed. Your items are still here.') : 'Your browser could not save this draft. Your items are still here. Free up browser storage or allow site storage, then try again.');
      setAnnouncement('Draft was not saved. Your items are still on screen.');
      return false;
    } finally { setDatabaseBusy(false); }
  }

  async function activateProject(id: string) {
    try {
      if (databaseMode) setDatabaseBusy(true);
      const loaded = databaseMode ? { draft: await readDatabaseDraft(id) ?? freshDraft(id), error: '', restored: true } : loadDraft(id);
      setProjectId(id); setDraft(loaded.draft); setStorageError(loaded.error ?? ''); setDirty(false);
      resetEntry(); setQuantity(''); setDescription(''); setUnit('');
      setAnnouncement(databaseMode ? 'Local database draft loaded for this test account.' : loaded.restored ? 'Saved local draft restored for this project.' : 'A new local draft is ready for this project.');
    } catch (error) { setStorageError(error instanceof Error ? error.message : 'Could not load the draft.'); }
    finally { setDatabaseBusy(false); }
  }

  function closeConfirmation() {
    confirmRef.current?.close(); setRemoving(null); setPendingProject(null); setPendingLeave(false);
  }

  async function finishNavigation(save: boolean) {
    if (save && !await saveDraft()) return;
    if (pendingProject) await activateProject(pendingProject);
    if (pendingLeave) { setActive(false); clearLocalSession(); setProfileOpen(false); setDirty(false); }
    closeConfirmation();
  }

  function leaveDemo() {
    if (dirty) setPendingLeave(true);
    else { setActive(false); clearLocalSession(); setProfileOpen(false); }
  }

  function resumeDemo() {
    activateProject(projectId); setActive(true);
  }

  function updateLine(id: string, update: Partial<Line>) {
    changeDraft(current => ({ ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...update } : line) }));
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!positiveQuantity(editing.quantity)) { setEditError('Enter a quantity greater than zero.'); return; }
    if (!editing.description.trim()) { setEditError('Enter a material description.'); return; }
    updateLine(editing.id, { quantity: editing.quantity, requestedUnit: editing.requestedUnit, description: editing.description.trim() });
    editRef.current?.close(); setEditError('');
    setAnnouncement('Item updated. Original input has been preserved.');
  }

  const resultTable = (candidates: Candidate[], isAI = false) => <>
    <div className="results-table" role="table" aria-label={isAI ? 'Mock AI material suggestions' : 'Demo catalog matches'}>
      <div className="result-head" role="row"><span role="columnheader">Image</span><span role="columnheader">Material description</span><span role="columnheader">Product UOM</span><span role="columnheader">Specifications</span><span role="columnheader">Action</span></div>
      {candidates.map(candidate => <div className={`result-row ${added.includes(candidate.id) ? 'is-added' : ''}`} role="row" key={candidate.id}>
        <div role="cell" className="result-image"><ProductImage category={candidate.category} /></div>
        <div role="cell" className="result-description"><strong>{candidate.description}</strong><SourceTag source={candidate.source} />{isAI && <span className="muted source-disclosure">Illustrative fixture · no live source</span>}</div>
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
    {databaseBusy && <div className="database-progress" role="status">Connecting to local database…</div>}
    <a className="skip-link" href="#main">Skip to MRF Builder</a>
    <aside className="desktop-sidebar"><Brand /><Navigation /></aside>
    <header className="topbar">
      <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => menuRef.current?.showModal()}><Menu size={23} aria-hidden="true" /></button>
      <div className="project-picker"><label htmlFor="project-select" className="sr-only">Project</label><div className="project-select-wrap"><select id="project-select" value={projectId} onChange={event => { if (dirty) setPendingProject(event.target.value); else activateProject(event.target.value); }}>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div><span>Project #{project.number} <span className="project-mock">· Demo</span></span></div>
      <form className="global-search" onSubmit={event => { event.preventDefault(); if (globalSearch.trim()) { setDescription(globalSearch.trim()); resetEntry(); descriptionRef.current?.focus(); setAnnouncement('Description filled. Enter a quantity, then Find Matches.'); } }}><Search size={17} aria-hidden="true" /><input aria-label="Search demo materials" placeholder="Search demo materials…" value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} /><button className="sr-only" type="submit">Use search as description</button></form>
      <div className="profile"><button className="avatar" aria-label="Demo session menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(current => !current)}>DM</button>{profileOpen && <div className="profile-menu"><strong>{databaseMode ? localIdentity : 'Demo foreman'}</strong><span>Local session · no sign-in</span><button className="button text-button" onClick={leaveDemo}><LogOut size={15} aria-hidden="true" />Leave demo</button></div>}</div>
    </header>

    <main id="main" className="workspace" tabIndex={-1} inert={databaseBusy || undefined} aria-busy={databaseBusy}>
      <div className="page-heading"><h1>MRF Builder</h1><span className="demo-badge">Local preview</span></div>
      <div className="demo-notice"><Info size={14} aria-hidden="true" /><span>{databaseMode ? 'Local database demo · SQLite · scripted AI · no Microsoft sign-in. Test account: ' + localIdentity : 'Demo data and scripted AI. Drafts save only in this browser. No live catalog or Microsoft sign-in.'}</span></div>
      <section className="panel draft-header" aria-label="MRF header">
        <div className="foreman"><span className="header-icon"><span className="person-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="7" r="3.2" /><path d="M4.5 20v-2a7.5 7.5 0 0 1 15 0v2z" /></svg></span></span><div><span className="field-caption">Foreman</span><strong>{databaseMode ? localIdentity : 'Demo foreman'}</strong></div></div>
        <div className="header-date"><label htmlFor="delivery-date" className="field-caption">MRF Delivery Date</label><input id="delivery-date" type="date" required value={draft.deliveryDate} onChange={event => { if (event.target.value) changeDraft(current => ({ ...current, deliveryDate: event.target.value })); }} /><span className="sr-only">Default for items using the MRF date</span></div>
        <div className="save-area"><button className="button save-button" onClick={saveDraft}><Save size={16} aria-hidden="true" />Save as Draft</button><span className={`save-status ${dirty ? 'unsaved' : ''}`}>{dirty ? 'Unsaved changes' : draft.savedAt ? (databaseMode ? 'Saved in local database' : 'Saved in this browser') : 'Not saved yet'}</span></div>
      </section>
      {storageError && <div className="error-message" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{storageError}</span></div>}

      <section className="panel entry-panel" aria-label="Add a material">
        <form onSubmit={event => search(event)} className="entry-form" noValidate>
          <div className="quantity-group"><div className="field"><label htmlFor="quantity">Quantity</label><input id="quantity" inputMode="decimal" autoComplete="off" placeholder="e.g. 200" value={quantity} maxLength={14} onChange={event => { setQuantity(event.target.value); setEntryError(''); }} aria-invalid={entryError.startsWith('Enter a quantity') || undefined} aria-describedby={entryError ? 'entry-error' : undefined} /></div><div className="field unit-field"><label htmlFor="quantity-unit">Unit</label><select id="quantity-unit" ref={unitRef} value={unit} onChange={event => { setUnit(event.target.value as Unit); setEntryError(''); }} aria-invalid={entryError.startsWith('Choose your') || undefined} aria-describedby={entryError ? 'entry-error' : undefined}><option value="">Choose…</option>{units.map(u => <option value={u} key={u}>{u}</option>)}</select></div></div>
          <div className="field description-field"><label htmlFor="description">Description</label><input id="description" ref={descriptionRef} value={description} maxLength={2000} placeholder={'e.g. 1" PVC or self tappers'} onChange={event => { setDescription(event.target.value); resetEntry(); }} autoComplete="off" aria-describedby={entryError ? 'entry-error' : undefined} /></div>
          <button className="button primary find-button" type="submit"><Search size={16} className="mobile-only" aria-hidden="true" />Find Matches</button>
        </form>
        {entryError && <p className="entry-error" id="entry-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{entryError}</p>}
      </section>

      {stage === 'idle' && <section className="panel getting-started"><span className="empty-icon"><Search size={23} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>Start with the material you need.</h2><p>Enter a quantity and description. We’ll check the demo catalog first, then help clarify if there’s no match.</p><div className="try-search"><span>Try a demo:</span><button onClick={() => { setQuantity('1000'); setDescription('1" PVC'); setUnit(''); resetEntry(); descriptionRef.current?.focus(); }}>1" PVC</button><span aria-hidden="true">·</span><button onClick={() => { setQuantity('200'); setDescription('self tappers'); setUnit('EA'); resetEntry(); descriptionRef.current?.focus(); }}>self tappers</button></div></div></section>}

      {stage === 'verified' && <section className="panel results-panel" aria-label="Translation results"><SectionHeading title="Translation matches" aside={<span className="count-badge">{matches.length} matches</span>}>{databaseMode ? 'Local database matches for “' + searchedDescription + '”. Fixture records are labeled.' : 'Demo verified-match layout for “' + searchedDescription + '”. These are fictional catalog fixtures.'}</SectionHeading>{resultTable(matches)}<div className="panel-footer"><button className="button text-button" onClick={clarify}>None of these is what I want <ArrowRight size={15} aria-hidden="true" /></button><span className="muted">Add a match directly from its row.</span></div></section>}

      {stage === 'clarify' && <>
        <div className="no-match" role="status"><AlertCircle size={19} aria-hidden="true" /><div><strong>No translation match found</strong><p>{matches.length ? 'Let’s find a better match for' : 'No confident demo catalog match for'} <strong>“{searchedDescription}”</strong>.</p></div></div>
        <section className="panel clarification-panel" aria-label="Material clarification">
          <SectionHeading title="Are you looking for…?">Choose the closest option, or tell the assistant what you need in your own words.</SectionHeading>
          <fieldset className="clarification-options"><legend className="sr-only">Clarify your material</legend>{clarificationOptions.map(option => <label className={`clarification-option ${choice === option.id ? 'selected' : ''}`} key={option.id}><input type="radio" name="clarification" value={option.id} checked={choice === option.id} onChange={() => chooseOption(option.id)} /><span className="choice-image">{option.id === 'other' ? <Ellipsis size={23} aria-hidden="true" /> : <ProductImage category="screw" small />}</span><span><strong>{option.title}</strong><span className="choice-detail">{option.detail}</span></span></label>)}</fieldset>
          {choice ? <div className="conversation"><div className="conversation-label"><Sparkles size={14} aria-hidden="true" />Demo assistant<span>Scripted responses</span></div><div className="transcript" ref={transcriptRef} role="log" aria-label="Clarification conversation" aria-live="polite">{messages.map(m => <div className={`message ${m.author}`} key={m.id}><span className={`message-avatar ${m.author === 'assistant' ? 'ai-avatar' : ''}`} aria-hidden="true">{m.author === 'assistant' ? <Sparkles size={20} /> : 'DM'}</span><div className="message-bubble"><span className="sr-only">{m.author === 'assistant' ? 'Demo assistant' : 'You'}: </span>{m.text}</div></div>)}</div><form className="chat-form" onSubmit={sendMessage}><MessageSquare size={19} className="chat-icon" aria-hidden="true" /><label className="sr-only" htmlFor="chat-input">Tell the assistant what you are looking for</label><textarea id="chat-input" ref={chatRef} value={message} maxLength={2000} placeholder="Describe what you need…" rows={1} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(event); } }} /><button className="icon-button send-button" type="submit" disabled={!message.trim()} aria-label="Send message"><Send size={19} aria-hidden="true" /></button></form></div>
            : <p className="clarify-hint"><MessageSquare size={15} aria-hidden="true" />Select “Other / none of these” to start a conversation.</p>}
          <div className="panel-footer fallback-footer"><span className="muted">Can’t find the right item? Keep your own wording.</span><button className="button" type="button" disabled={added.includes('description')} onClick={() => addLine(null)}>{added.includes('description') ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{added.includes('description') ? 'Description added' : 'Use My Description'}</button></div>
        </section>
        {suggestions.length > 0 && <section className="panel results-panel" aria-label="AI suggestions"><SectionHeading title="Suggested materials" aside={<span className="source-tag provisional"><Sparkles size={12} aria-hidden="true" />Mock discovery</span>}>Illustrative candidates only. Live product discovery, sources, and approved photos are not connected.</SectionHeading>{resultTable(suggestions, true)}</section>}
      </>}

      <section className="panel item-list" aria-label="MRF Item List"><SectionHeading title="MRF Item List" aside={<span className="count-badge">{draft.lines.length} {draft.lines.length === 1 ? 'item' : 'items'}</span>}>Materials added to your request.</SectionHeading>
        <div className="item-table-wrap"><table className="item-table"><thead><tr><th scope="col" className="number-column">#</th><th scope="col" className="image-column">Image</th><th scope="col">Material description</th><th scope="col" className="quantity-column">Qty / UOM</th><th scope="col" className="delivery-column">Item delivery</th><th scope="col" className="action-column">Actions</th></tr></thead><tbody>
          {draft.lines.length === 0 ? <tr className="empty-row"><td colSpan={6}><div className="empty-list"><FileText size={38} strokeWidth={1.3} aria-hidden="true" /><div><strong>No items added yet</strong><span>Find a match above to add items to your MRF.</span></div></div></td></tr>
            : draft.lines.map((line, index) => <tr key={line.id} data-testid="mrf-line"><td className="line-number"><span className="mobile-label">Item </span>{String(index + 1).padStart(2, '0')}</td><td className="line-image"><ProductImage category={line.candidate?.category ?? 'conduit'} small /></td><td className="line-description"><strong>{line.description}</strong><SourceTag source={line.source} /><details><summary>Original input</summary><p>{line.rawInput.quantity} {line.rawInput.requestedUnit} · {line.rawInput.description}</p>{line.candidate && <p>Product UOM: {line.candidate.productUnit}. No quantity conversion applied.</p>}</details></td><td className="line-quantity"><span className="mobile-label">Quantity</span><strong>{line.quantity}</strong> <span>{line.requestedUnit}</span></td><td className="line-delivery"><label className="sr-only" htmlFor={`mode-${line.id}`}>Delivery mode for item {index + 1}</label><select id={`mode-${line.id}`} value={line.deliveryMode} onChange={event => updateLine(line.id, event.target.value === 'inherit' ? { deliveryMode: 'inherit', overrideDate: null } : { deliveryMode: 'override', overrideDate: draft.deliveryDate })}><option value="inherit">Use MRF Date</option><option value="override">Item Delivery Override</option></select>{line.deliveryMode === 'override' ? <><label className="sr-only" htmlFor={`override-${line.id}`}>Delivery override for item {index + 1}</label><input id={`override-${line.id}`} type="date" value={line.overrideDate ?? ''} onChange={event => { if (event.target.value) updateLine(line.id, { overrideDate: event.target.value }); }} /></> : <span className="inherited-date" data-testid="effective-date">{formatDate(draft.deliveryDate)}</span>}</td><td className="line-actions"><button className="icon-button" aria-label={`Edit item ${index + 1}`} onClick={event => { editTriggerRef.current = event.currentTarget; setEditing({ ...line }); setEditError(''); }}><Pencil size={16} aria-hidden="true" /></button><button className="icon-button remove-button" aria-label={`Remove item ${index + 1}`} onClick={() => setRemoving(line)}><Trash2 size={16} aria-hidden="true" /></button></td></tr>)}
        </tbody></table></div>
        {draft.lines.length > 0 && <div className="list-footer"><span><Info size={14} aria-hidden="true" />Items use the MRF date unless you choose an override.</span><button className="button text-button" onClick={() => { setDescription(''); setQuantity(''); setUnit(''); resetEntry(); descriptionRef.current?.focus(); }}><Plus size={15} aria-hidden="true" />Next material</button></div>}
      </section>
      <footer className="workspace-footer"><span>EtalonOps · MRF Builder POC</span><span>No request has been submitted. Purchasing is outside this preview.</span></footer>
      <div className={`status-bar ${announcement ? 'has-message' : ''}`} role="status" aria-live="polite" aria-atomic="true">{announcement && <><Check size={15} aria-hidden="true" /><span>{announcement}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setAnnouncement('')}><X size={15} aria-hidden="true" /></button></>}</div>
    </main>

    <dialog className="mobile-menu" ref={menuRef} aria-label="Navigation"><div className="mobile-menu-heading"><Brand /><button className="icon-button" aria-label="Close navigation" onClick={() => menuRef.current?.close()}><X size={22} aria-hidden="true" /></button></div><Navigation onNavigate={() => menuRef.current?.close()} /></dialog>
    <dialog className="modal edit-modal" ref={editRef} aria-labelledby="edit-title" onClose={() => { setEditing(null); editTriggerRef.current?.focus({ preventScroll: true }); }}>{editing && <form onSubmit={saveEdit} noValidate><div className="modal-heading"><div><span className="eyebrow">MRF ITEM</span><h2 id="edit-title">Edit material</h2></div><button className="icon-button" type="button" aria-label="Close edit" onClick={() => editRef.current?.close()}><X size={20} aria-hidden="true" /></button></div><div className="field"><label htmlFor="edit-description">Material description</label><textarea id="edit-description" value={editing.description} maxLength={2000} rows={3} onChange={event => setEditing({ ...editing, description: event.target.value })} /></div><div className="edit-quantity"><div className="field"><label htmlFor="edit-quantity">Quantity</label><input id="edit-quantity" inputMode="decimal" maxLength={14} value={editing.quantity} onChange={event => setEditing({ ...editing, quantity: event.target.value })} /></div><div className="field"><label htmlFor="edit-unit">Requested unit</label><select id="edit-unit" value={editing.requestedUnit} onChange={event => setEditing({ ...editing, requestedUnit: event.target.value as Unit })}>{units.map(u => <option key={u}>{u}</option>)}</select></div></div><p className="fine-print">Original input and source are preserved. Editing does not create or verify a catalog translation.</p>{editError && <p className="entry-error" role="alert">{editError}</p>}<div className="modal-actions"><button type="button" className="button" onClick={() => editRef.current?.close()}>Cancel</button><button className="button primary" type="submit">Save item changes</button></div></form>}</dialog>
    <dialog className="modal confirm-modal" ref={confirmRef} aria-labelledby="confirm-title" onCancel={closeConfirmation}><div className="modal-heading"><h2 id="confirm-title">{removing ? 'Remove this item?' : 'Save your draft first?'}</h2><button className="icon-button" aria-label="Close confirmation" onClick={closeConfirmation}><X size={20} aria-hidden="true" /></button></div>{removing ? <><p>{removing.description}</p><p className="muted">Only this MRF line will be removed.</p><div className="modal-actions"><button className="button" onClick={closeConfirmation}>Keep item</button><button className="button danger" onClick={() => { changeDraft(current => ({ ...current, lines: current.lines.filter(line => line.id !== removing.id) })); setAdded([]); setAnnouncement('Item removed. Save your draft to keep this change.'); closeConfirmation(); }}>Remove item</button></div></> : <><p>You have unsaved changes. Save them in this browser before {pendingProject ? 'switching projects' : 'leaving the demo'}.</p><div className="modal-actions navigation-actions"><button className="button" onClick={closeConfirmation}><ArrowLeft size={15} aria-hidden="true" />Stay here</button><button className="button text-button" onClick={() => finishNavigation(false)}>Discard changes</button><button className="button primary" onClick={() => finishNavigation(true)}>Save and continue</button></div></>}</dialog>
  </>;
}
