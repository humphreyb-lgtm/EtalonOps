import {MaterialTable} from './MaterialTable';
import {CatalogInbox} from './CatalogInbox';
import {CatalogResearch} from './CatalogResearch';
import { AdminStatus } from './AdminStatus';
import { CatalogReadiness } from './CatalogReadiness';
import { useEffect, useRef, useState } from 'react';
import { Settings, X } from 'lucide-react';
import { databaseMode, request } from './api';
import { CatalogAdmin } from './CatalogAdmin';
import { UserAdmin } from './UserAdmin';
import { ImageAdmin } from './ImageAdmin';
import { JobManufacturerRestrictions } from './JobManufacturerRestrictions';
import { AIUsage } from './AIUsage';

const sections = [
  ['overview', 'Overview'], ['materials','Materials'], ['readiness','Catalog readiness'], ['users', 'Users and access'], ['catalog', 'Catalog and imports'],
  ['imports','Workbook imports'], ['research','Product research'], ['images', 'Product images'], ['status','Pilot status'], ['restrictions', 'Job restrictions'], ['ai', 'AI usage'],
] as const;
type Section = typeof sections[number][0];
export function AdminWorkspace() {
  const [allowed, setAllowed] = useState(false), [open, setOpen] = useState(false);
  const [catalogTarget,setCatalogTarget]=useState<{id:string;request:number}|undefined>(),[imageTarget,setImageTarget]=useState<{id:string;request:number}|undefined>();
  const [section, setSection] = useState<Section>('overview');
  const [visited, setVisited] = useState<Section[]>(['overview']);
  const [changed, setChanged] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    void request<{roles: string[]}>('/me').then(me => { if (active) setAllowed(me.roles.includes('Admin')); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { if (open && !dialog.current?.open) { dialog.current?.showModal(); heading.current?.focus(); } }, [open]);
  async function enter() {
    setError('');
    try {
      const me = await request<{roles:string[]}>('/me');
      if (!me.roles.includes('Admin')) { setAllowed(false); return; }
      setOpen(true);
    } catch { setError('Unable to verify administrator access. Please try again.'); }
  }
  function inspect(id:string,area:'catalog'|'images'){if(area==='catalog')setCatalogTarget({id,request:Date.now()});else setImageTarget({id,request:Date.now()});choose(area);}
  function choose(value: Section) { setSection(value); setVisited(current => current.includes(value) ? current : [...current,value]); }
  useEffect(() => {
    if (!open || !changed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload",warn);
    return () => window.removeEventListener("beforeunload",warn);
  },[open,changed]);
  function close() {
    if(dialog.current?.querySelector('[aria-busy="true"]')) { setError("Wait for the current administration operation to finish before closing."); return; }
    if (changed && !window.confirm('Close administration? Unsubmitted form entries will be cleared. Saved changes are retained.')) return;
    dialog.current?.close(); setOpen(false); setChanged(false); setVisited(['overview']); setSection('overview');setCatalogTarget(undefined);setImageTarget(undefined); trigger.current?.focus();
  }
  if (!allowed) return null;
  return <><button ref={trigger} className="button" onClick={() => void enter()}><Settings size={18} aria-hidden="true"/> Administration</button>
    {!open && error && <p role="alert">{error}</p>}
    <dialog ref={dialog} className={`admin-workspace ${section==='materials'?'material-table-workspace':''}`} aria-labelledby="admin-workspace-title" onCancel={event => {event.preventDefault();close();}}>
      <header className="modal-heading"><div><h2 id="admin-workspace-title" ref={heading} tabIndex={-1}>Administration</h2><p>EtalonOps management</p></div><button className="button" onClick={close}><X size={18} aria-hidden="true"/> Return to MRF</button></header>
      <nav aria-label="Administration sections" className="admin-sections">{sections.map(([id,label]) => <button key={id} className={`button ${section===id?'primary':''}`} aria-current={section===id?'page':undefined} onClick={() => choose(id)}>{label}</button>)}</nav>
      {error && <p role="alert">{error}</p>}
      <div className="admin-content" onChange={() => setChanged(true)}>
        <section hidden={section!=='overview'} aria-label="Administration overview"><h3>Manage your materials workflow</h3><p>Your MRF stays open while you administer the application. Each section keeps its form entries when you switch sections.</p><div className="admin-cards">{sections.slice(1).map(([id,label]) => <article key={id}><h3>{label}</h3><p>{({materials:'Add and edit generic materials in a compact table without manufacturer parts.',imports:'Upload Excel workbooks directly, edit unpublished records and approve publication.',research:'Review a manufacturer product family, edit specifications and phrases, and add selected products.',status:'Check the installed release, database connection and current sign-in access.',readiness:'View catalog counts, find missing relationships and work through specification, product and image reviews.',users:'Register Microsoft users, manage project access, deactivate accounts and review access history.',catalog:'Maintain canonical materials, manufacturer parts, translations, search priority and reviewed CSV imports.',images:'Upload product photos and review their identity, source evidence and usage rights.',restrictions:'Manage manufacturer restrictions by job or material category.',ai:'Check the current AI activation status and request limits.'} as Record<string,string>)[id]}</p><button className="button" onClick={() => choose(id)}>Open {label.toLowerCase()}</button></article>)}</div><p>Catalog and access changes use the existing review and history controls. Submitting an MRF does not place an order.</p></section>
        {visited.includes('status')&&<section hidden={section!=='status'}><AdminStatus/></section>}
        {visited.includes('readiness')&&<section hidden={section!=='readiness'}><CatalogReadiness inspect={inspect}/></section>}
        {visited.includes('users')&&<section hidden={section!=='users'} aria-label="Users and access"><h3>Users and access</h3><UserAdmin embedded/></section>}
        {visited.includes('materials')&&<section hidden={section!=='materials'}><MaterialTable onImages={id=>inspect(id,'images')}/></section>}
        {visited.includes('catalog')&&<section hidden={section!=='catalog'} aria-label="Catalog and imports"><h3>Catalog and imports</h3><CatalogAdmin embedded materialTarget={catalogTarget}/></section>}
        {visited.includes('imports')&&<section hidden={section!=='imports'}><CatalogInbox/></section>}
        {visited.includes('research')&&<section hidden={section!=='research'}><CatalogResearch/></section>}
        {visited.includes('images')&&<section hidden={section!=='images'}><ImageAdmin materialTarget={imageTarget}/></section>}
        {visited.includes('restrictions')&&<section hidden={section!=='restrictions'} aria-label="Job restrictions"><h3>Job restrictions</h3><JobManufacturerRestrictions/></section>}
        {visited.includes('ai')&&<section hidden={section!=='ai'}><AIUsage/></section>}
      </div>
    </dialog></>;
}
