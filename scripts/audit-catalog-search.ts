// Offline, read-only audit against an administrator-exported snapshot.
// Never commit snapshots or the generated report to source control.
import {readFileSync,writeFileSync} from 'node:fs';
import {Store} from '../server/store';
const path=process.argv[2],reportPath=process.argv[3];
if(!path||!reportPath)throw Error('Usage: npx tsx scripts/audit-catalog-search.ts SNAPSHOT.json PRIVATE_REPORT.json');
const snapshot=JSON.parse(readFileSync(path,'utf8'));
if(snapshot.format!=='etalonops-catalog-snapshot'||snapshot.version!==1)throw Error('Expected a catalog snapshot v1.');
const store=new Store(':memory:');
try{
 store.db.exec('PRAGMA foreign_keys=OFF');
 for(const table of ['materials','catalog_profiles','translations','aliases','manufacturers','manufacturer_products']){
  const columns=new Set((store.db.prepare('PRAGMA table_info('+table+')').all() as any[]).map(r=>r.name));
  for(const row of snapshot.tables[table]??[]){const entries=Object.entries(row).filter(([k])=>columns.has(k));store.db.prepare('INSERT INTO '+table+'('+entries.map(([k])=>'['+k+']').join(',')+') VALUES ('+entries.map(()=>'?').join(',')+')').run(...entries.map(([,v])=>typeof v==='boolean'?Number(v):v) as any[]);}
 }
 const profiles=new Map((snapshot.tables.catalog_profiles??[]).map((x:any)=>[x.material_id.toLowerCase(),JSON.parse(x.attributes)]));
 const active=new Set<string>(),cases:{q:string;id:string;kind:string}[]=[];
 for(const m of snapshot.tables.materials){if(!m.active)continue;active.add(m.id.toLowerCase());cases.push({q:m.description,id:m.id,kind:'description'});const a:any=profiles.get(m.id.toLowerCase());
  const words=a?.type==='female adapter'?['fa','F.A.','female adaptor','female adapters']:a?.type==='male adapter'?['ma','M.A.','male adaptor','male adapters']:a?.type==='coupling with center stop'?['cplg','couplings']:[];
  if(a?.diameterIn)for(const word of words)cases.push({q:a.diameterIn+' inch PVC sch 40 '+word,id:m.id,kind:'generated shorthand'});
 }
 for(const a of snapshot.tables.translations??[])if(a.active&&active.has(a.material_id.toLowerCase()))cases.push({q:a.phrase,id:a.material_id,kind:'stored translation'});
 const failures:any[]=[],principal={tenant:snapshot.tenant,oid:'offline-audit',roles:['Admin']};let passed=0;
 for(const c of cases){const rows=await store.search(principal,c.q);if(rows.some((x:any)=>x.id.toLowerCase()===c.id.toLowerCase()))passed++;else failures.push({...c,returned:rows.map((x:any)=>({id:x.id,description:x.description}))});if((passed+failures.length)%250===0)console.log('Checked '+(passed+failures.length)+' / '+cases.length);}
 const report={exportedAt:snapshot.exportedAt,tested:cases.length,passed,failures};writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({tested:cases.length,passed,failed:failures.length,report:reportPath}));
}finally{store.db.close();}
