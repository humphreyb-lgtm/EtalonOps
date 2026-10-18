import { CatalogRelationships } from './CatalogRelationships';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { databaseMode, request, downloadCatalog, downloadCatalogSnapshot, downloadLargeCatalog, supportsLargeCatalogExport, type ImportBatch, type ImportPreview } from './api';
import { AIUsage } from './AIUsage';
import { ImageAdmin } from './ImageAdmin';
import { cloudMode } from './cloud-auth';

export function CatalogAdmin({embedded=false,materialTarget}:{embedded?:boolean;materialTarget?:{id:string;request:number}}={}) {
  const [allowed, setAllowed] = useState(false), [open, setOpen] = useState(false);
  const [csv, setCsv] = useState(''), [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [batches, setBatches] = useState<ImportBatch[]>([]), [rollback, setRollback] = useState<ImportBatch | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!databaseMode) return;
    let cancelled = false;
    request<{ roles: string[] }>('/me').then(me => { if (!cancelled) setAllowed(me.roles.includes('Admin')); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
  async function refresh() { setBatches((await request<{ batches: ImportBatch[] }>('/admin/imports')).batches); }
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (error) { setError(error instanceof Error ? error.message : 'Catalog operation failed.'); }
    finally { setBusy(false); }
  }
  function close() { if (busy) return; dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  function changeCsv(value: string) { setCsv(value); setPreview(null); setReviewed(false); setNotice(''); }
  useEffect(()=>{if(embedded&&allowed)void run(refresh);},[embedded,allowed]);
  if (!allowed) return null;
  const canApply = preview && preview.state === 'preview' && preview.report.errors.length === 0 && !(cloudMode && preview.report.kind === 'fixture');
  const content=<>
      <p>Import a reviewed initial dataset. Searches, conversations and foreman selections never create verified mappings. Image approvals are separate.</p>
      {!cloudMode && <p className="muted">Local test database. Fictional fixtures are permitted here only.</p>}
      {error && <p className="error-message" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <div className="catalog-actions"><button className="button" disabled={busy||!supportsLargeCatalogExport()} onClick={()=>void run(async()=>{const saved=await downloadLargeCatalog(count=>setNotice(`Exporting catalog: ${count} records…`));setNotice(saved?'Large catalog export saved. Image files are separate.':'Catalog export canceled.');})}>Export large catalog to file</button></div><p className="muted">Large exports save directly to disk in desktop Chrome or Edge. The regular JSON snapshot is also available. Catalog exports contain image metadata; image files are separate.</p>
      {cloudMode&&<div className="catalog-actions"><button className="button" disabled={busy} onClick={()=>void run(async()=>{await downloadCatalogSnapshot();setNotice('Catalog relationships downloaded. Image files are separate.');})}>Export catalog relationships</button></div>}
      {!cloudMode&&<><fieldset disabled={busy} className="catalog-fields"><legend>Review a CSV batch</legend>
        <label htmlFor="catalog-file">Choose CSV file (maximum 500 KB)</label><input id="catalog-file" type="file" accept=".csv,text/csv" onChange={event => { const file = event.target.files?.[0]; if (!file) return; setPreview(null); setReviewed(false); void run(async () => { if (file.size > 500000) throw new Error('CSV file exceeds 500 KB. Split it into reviewed batches.'); changeCsv(await file.text()); }); }} />
        <label htmlFor="catalog-csv">CSV contents</label><textarea id="catalog-csv" value={csv} maxLength={800000} rows={5} onChange={event => changeCsv(event.target.value)} placeholder="Paste a CSV with the documented v1 headers." />
        <div className="catalog-actions"><button className="button" disabled={!csv.trim()} onClick={() => void run(async () => { setReviewed(false); setPreview(await request<ImportPreview>('/admin/imports/preview', 'POST', { csv })); await refresh(); })}>Preview import</button><button className="button" onClick={() => void run(async () => { await downloadCatalog(); setNotice('Catalog export downloaded.'); })}>Export active catalog</button><button className="button" onClick={() => void run(async () => { await downloadCatalogSnapshot(); setNotice('Catalog snapshot downloaded, including manufacturer relationships, translations and image metadata. Image files are separate.'); })}>Export catalog relationships</button></div>
      </fieldset>
      {preview && <section aria-label="Import preview" className="catalog-preview"><h3>Import preview</h3><p>{preview.report.rows} records · {preview.report.kind || 'unclassified'} · {preview.state}</p>
        {preview.report.errors.length > 0 && <ul className="catalog-errors">{preview.report.errors.map((issue, i) => <li key={i}>Row {issue.row}: {issue.message}</li>)}</ul>}
        <div className="catalog-records" role="region" aria-label="Preview records" tabIndex={0}>{preview.records.map(record => <article className="catalog-record" key={record.external_key}><h4>{record.description}</h4><dl><dt>External key</dt><dd>{record.external_key}</dd><dt>Manufacturer / part</dt><dd>{record.manufacturer || 'Unavailable'} / {record.manufacturer_part_number || 'Unavailable'}</dd><dt>Specifications</dt><dd>{record.specifications_json}</dd><dt>Aliases</dt><dd>{record.aliases_json}</dd><dt>Requested / product unit</dt><dd>{record.requested_uom} / {record.product_uom} · no conversion assumed</dd><dt>Source evidence</dt><dd>{record.source_url || 'No external source (fixture only)'}</dd><dt>Verification basis</dt><dd>{record.verification_basis}</dd></dl></article>)}</div>
        {cloudMode && preview.report.kind === 'fixture' && <p role="alert">Fictional fixtures cannot be applied to the cloud catalog.</p>}
        <label className="catalog-review"><input type="checkbox" checked={reviewed} disabled={busy || !canApply} onChange={event => setReviewed(event.target.checked)} />I reviewed this batch, its aliases, units and source evidence.</label>
        <button className="button primary" disabled={busy || !canApply || !reviewed} onClick={() => void run(async () => { await request(`/admin/imports/${preview.id}/apply`, 'POST', { approval: 'I reviewed this batch' }); setPreview({ ...preview, state: 'applied' }); setReviewed(false); setNotice('Reviewed batch applied. No images were approved.'); await refresh(); })}>Apply reviewed batch</button>
      </section>}
      <section aria-label="Import history"><h3>Import history</h3><p className="muted">Up to 50 batches. Rollback deactivates the batch; existing draft references are preserved.</p><div className="catalog-history">{batches.map(batch => <article className="catalog-history-row" key={batch.id}><span><strong>{batch.report.rows} records · {batch.state}</strong><small>{batch.id}{batch.approvedAt && ` · ${batch.approvedAt}`}</small></span>{batch.state === 'applied' && <button className="button" disabled={busy} onClick={() => setRollback(batch)}>Review rollback</button>}</article>)}</div>
        {rollback && <div className="catalog-rollback" role="group" aria-label="Confirm catalog rollback"><p>Deactivate all records in batch {rollback.id}? Existing saved MRF lines keep their historical references.</p><div className="catalog-actions"><button className="button" disabled={busy} onClick={() => setRollback(null)}>Keep batch</button><button className="button danger" disabled={busy} onClick={() => void run(async () => { await request(`/admin/imports/${rollback.id}/rollback`, 'POST'); if (preview?.id === rollback.id) setPreview({ ...preview, state: 'rolled_back' }); setRollback(null); setNotice('Batch deactivated. Historical draft references retained.'); await refresh(); })}>Deactivate batch</button></div></div>}
      </section></>}<CatalogRelationships materialTarget={materialTarget}/>{!embedded&&<><ImageAdmin /><AIUsage /></>}{busy && <p role="status">Working on catalog…</p>}
    </>;
  return embedded?<section aria-label="Catalog administration" aria-busy={busy}>{content}</section>:<><button className="button text-button" ref={trigger} onClick={() => { setOpen(true); void run(refresh); }}>Catalog administration</button><dialog ref={dialog} className="modal catalog-modal" aria-labelledby="catalog-admin-title" onCancel={event => { event.preventDefault(); close(); }}><div className="modal-heading"><h2 id="catalog-admin-title">Catalog administration</h2><button className="icon-button" aria-label="Close catalog administration" disabled={busy} onClick={close}><X size={20}/></button></div>{open&&content}</dialog></>;
}
