import { createHash } from 'node:crypto';
import { Store } from './store';
import { describeMaterial, type MaterialInput, parseExtendedCsv } from './catalog-v2';

export type DeliveryFile = { name: string; csv: string };
type Issue = { file: string; row: number; message: string };
/** Rehearses a delivery in an isolated, empty in-memory repository. Never opens a configured database. */
export function preflightCatalog(files: DeliveryFile[]) {
  if (!files.length || files.length > 50) throw new Error('Supply 1–50 ordered CSV files.');
  if (files.reduce((sum,file)=>sum+Buffer.byteLength(file.csv),0)>20_000_000) throw new Error('Split deliveries above 20 MB.');
  const errors: Issue[] = [], warnings: Issue[] = [];
  const batches: {file:string;sha256:string;rows:number;accepted:boolean;created:number;unchanged:number}[]=[];
  const store = new Store(':memory:');
  const admin = {tenant:'offline-preflight',oid:'delivery-rehearsal',roles:['Admin']};
  let stage = -1;
  const identities=new Map<string,{key:string;file:string;row:number}>();
  try {
    for (const file of files) {
      const summary={file:file.name,sha256:createHash('sha256').update(file.csv).digest('hex'),rows:0,accepted:false,created:0,unchanged:0};
      batches.push(summary);
      if(Buffer.byteLength(file.csv)>800000){errors.push({file:file.name,row:1,message:'Split files above 800 KB.'});continue;}
      const parsed=parseExtendedCsv(file.csv);summary.rows=parsed.rowCount;
      const kind=parsed.records[0]?.kind;
      const position=kind?['material','product','translation','image'].indexOf(kind):-1;
      if(position>=0&&position<stage){errors.push({file:file.name,row:1,message:'Use materials → products → translations → image references order.'});continue;}
      stage=Math.max(stage,position);
      let conflictingKey=false;
      for(const record of parsed.records){
        if(record.kind==='material'){
          const material=record.data as MaterialInput,identity=describeMaterial(material).identity;
          const prior=identities.get(identity);
          if(prior&&prior.key.toLowerCase()!==material.externalKey.toLowerCase()){
            errors.push({file:file.name,row:record.row,message:`Same canonical specification uses key ${prior.key} in ${prior.file}:${prior.row}. Keep one material key and update related files before importing.`});conflictingKey=true;
          }
        }
        const data=record.data as {sourceUrl?:string};
        if(data.sourceUrl){const host=new URL(data.sourceUrl).hostname.toLowerCase();if(host.endsWith('.invalid')||host==='example.com'||host==='example.org'||host==='example.net')warnings.push({file:file.name,row:record.row,message:'Placeholder evidence URL: replace with exact product/specification evidence before live import.'});}
      }
      if(conflictingKey)continue;
      const preview=store.catalogCommand(admin,'preview',{csv:file.csv});
      if(preview.report.errors.length){errors.push(...preview.report.errors.map((issue:{row:number;message:string})=>({file:file.name,...issue})));continue;}
      try {
        const applied=store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'});
        for(const record of parsed.records)if(record.kind==='material'){const material=record.data as MaterialInput;identities.set(describeMaterial(material).identity,{key:material.externalKey,file:file.name,row:record.row});}
        summary.accepted=true;summary.created=applied.created??0;summary.unchanged=applied.unchanged===true?summary.rows:applied.unchanged??0;
        const retry=store.catalogCommand(admin,'apply',{id:preview.id,approval:'I reviewed this batch'});
        if(retry.unchanged!==true)throw new Error('Import replay did not remain idempotent.');
      }catch(error){errors.push({file:file.name,row:1,message:error instanceof Error?error.message:'Import rehearsal failed.'});}
    }
    const count=(table:string)=>Number(store.db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE tenant=?`).get(admin.tenant)?.total??0);
    const totals={materials:count('materials'),manufacturers:count('manufacturers'),products:count('manufacturer_products'),translations:count('translations'),imageReferences:count('image_references')};
    const gaps=store.db.prepare(`SELECT m.external_key,
      (SELECT COUNT(*) FROM manufacturer_products p WHERE p.material_id=m.id AND p.active=1) AS products,
      (SELECT COUNT(*) FROM translations t WHERE t.material_id=m.id AND t.active=1) AS translations
      FROM materials m WHERE m.tenant=? AND m.active=1 ORDER BY m.external_key`).all(admin.tenant);
    const coverage=gaps.map(row=>({materialKey:String(row.external_key),products:Number(row.products),translations:Number(row.translations)}));
    return {schemaVersion:1,valid:errors.length===0,scope:'Empty offline catalog rehearsal only; existing live records and source accuracy are not checked.',batches,totals,coverage,errors,warnings};
  } finally {store.db.close();}
}
