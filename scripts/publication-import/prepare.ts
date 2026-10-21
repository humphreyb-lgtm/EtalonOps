// Build a reviewed, credential-free package from owner-supplied files. Never pack
// the live snapshot itself, application settings, accounts, jobs or credentials.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readSafeWorkbook} from '../../server/catalog-workbook';
import {parseMaterialWorkbook} from '../../server/material-workbook';
import {materialWorkbookColumns,type WorkbookRow} from '../../src/material-workbook-format';
import {materialFamily} from '../../src/material-families';
import {parseInches} from '../../src/measurements';
import {materialInput,describeMaterial} from '../../server/catalog-v2';
import {packageSchema,signature,hash,type ImportRecord} from './core';
const [source,live,output]=process.argv.slice(2);if(!source||!live||!output)throw Error('Usage: prepare.ts extracted-R2 live-snapshot.json output-directory');
const snapshot=JSON.parse(readFileSync(live,'utf8'));if(snapshot.format!=='etalonops-catalog-snapshot'||snapshot.version!==1)throw Error('Unsupported live export.');
mkdirSync(output,{recursive:true});mkdirSync(join(output,'images'),{recursive:true});
const records:ImportRecord[]=[];const imageWorkbook=await readSafeWorkbook(readFileSync(join(source,'EtalonOps-Reconciliation-Report-R2.xlsx')));const photoSheet=imageWorkbook.find(s=>s.sheet==='Image Review')!;const photoHeaders=photoSheet.data[0].map(String);const photoRows=photoSheet.data.slice(1).map(values=>Object.fromEntries(photoHeaders.map((k,i)=>[k,values[i]])));
function inches(v:string,length=false){let value=v.trim(),factor=1;if(length&&/(ft|feet|foot|')\s*$/i.test(value)){factor=12;value=value.replace(/(ft|feet|foot|')\s*$/i,'').trim();}return parseInches(value.replace(/(?:inches|inch|in|["″])\s*$/i,'').trim().replace(/^(\d+)-(\d+\/\d+)$/,'$1 $2'))*factor;}
const files=['EtalonOps-Existing-Reference-Pending-Reconciliation-R2.xlsx',...['01','02','03'].map(n=>'EtalonOps-Pending-Reconciliation-Batch-'+n+'-R2.xlsx')];
for(const file of files){let rows:WorkbookRow[];
 if(file.startsWith('EtalonOps-Existing')){const sheet=(await readSafeWorkbook(readFileSync(join(source,file)))).find(s=>s.sheet==='Reference Records')!;if(sheet.data[0].some((v,i)=>v!==materialWorkbookColumns[i][0]))throw Error('Reference headers changed.');rows=sheet.data.slice(1).map((values,index)=>({_row:String(index+2),...Object.fromEntries(materialWorkbookColumns.map((c,i)=>[c[1],values[i]==null?'':String(values[i]).trim()]))}));}
 else rows=await parseMaterialWorkbook(readFileSync(join(source,file)));
 for(const row of rows){const family=materialFamily(row.familyId),attrs:Record<string,string|number>={};
  for(const [,field] of materialWorkbookColumns){if(['key','description','category','unit','extra','phrases','image','source','notes','status'].includes(field)||!row[field])continue;if(field==='configurationStatus'&&row[field]==='existing')continue;attrs[field]=field.endsWith('In')?inches(row[field],field==='lengthIn'):field==='angleDeg'?Number(row[field]):row[field];}
  for(const line of (row.extra??'').split(/\r?\n/).filter(Boolean)){const at=line.indexOf('=');if(at<1)throw Error('Invalid extra specification.');const key=line.slice(0,at).trim(),v=line.slice(at+1).trim();if(Object.hasOwn(attrs,key))throw Error('Duplicate specification in '+file+' row '+row._row);const type=family?.fields.find(f=>f.key===key)?.kind;attrs[key]=['diameterIn','lengthIn','minSpanIn','maxSpanIn','widthIn','heightIn','depthIn'].includes(key)?inches(v,key==='lengthIn'):type==='inches'?inches(v):type==='number'?Number(v):v;}
  const material=materialInput.parse({externalKey:row.key||'BULK-'+createHash('sha256').update(JSON.stringify({category:row.category,unit:row.unit,attrs})).digest('hex').slice(0,24),displayDescription:row.description,category:row.category,productUnit:row.unit,attributes:attrs,sourceUrl:row.source,verificationBasis:row.notes,verification:'provisional',origin:'admin_reviewed'});describeMaterial(material);
  const ref=file+':'+row._row,record:ImportRecord={ref,originalKey:row.key??'',row,material,phrases:[...new Set([row.description,...(row.phrases??'').split(/[;\r\n]+/)].map(v=>v.trim()).filter(Boolean))]};
  if(record.originalKey){const m=snapshot.tables.materials.find((m:any)=>m.external_key===record.originalKey),p=snapshot.tables.catalog_profiles.find((p:any)=>String(p.material_id).toLowerCase()===String(m?.id).toLowerCase());if(!m||!p)throw Error('Live baseline key missing: '+record.originalKey);record.baselineSignature=signature(m,p);}
  const image=photoRows.find(p=>p['Batch file']===file&&Number(p['Batch row'])===Number(row._row));
  if(image?.['Local asset in ZIP']){const file=String(image['Local asset in ZIP']);if(!/^images\/[a-zA-Z0-9_.-]+$/.test(file))throw Error('Invalid image path');const bytes=readFileSync(join(source,file)),sha256=createHash('sha256').update(bytes).digest('hex');if(sha256!==image.SHA256)throw Error('Image checksum mismatch');let sourceUrl=String(image['Image source']??'');try{const u=new URL(sourceUrl);if(u.protocol!=='https:')throw Error();}catch{sourceUrl=material.sourceUrl;}
   record.image={file,sha256,sourceUrl,width:Number(image['Width px']),height:Number(image['Height px'])};copyFileSync(join(source,file),join(output,file));}
  records.push(record);
 }
}
const data=packageSchema.parse({format:'etalonops-publication-import-v1',source:'Publication Review R2',expectedTenantHash:createHash('sha256').update(String(snapshot.tenant).toLowerCase()).digest('hex'),held:28,records});
const bytes=JSON.stringify(data,null,2)+'\n';writeFileSync(join(output,'materials.json'),bytes);writeFileSync(join(output,'materials.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
writeFileSync(join(output,'PREPARED-SUMMARY.json'),JSON.stringify({ready:records.length,originalKeys:records.filter(r=>r.originalKey).length,imageAssignments:records.filter(r=>r.image).length,externalImageUrls:records.filter(r=>r.row.image).length,materialsWithPhotos:records.filter(r=>r.row.image||r.image).length,missingPhotos:records.filter(r=>!r.row.image&&!r.image).length,heldExcluded:28,snapshotDate:snapshot.exportedAt,manifestHash:hash(data)},null,2));console.log(readFileSync(join(output,'PREPARED-SUMMARY.json'),'utf8'));
