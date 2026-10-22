// Build a reviewed, credential-free package from owner-supplied files. Never pack
// the live snapshot itself, application settings, accounts, jobs or credentials.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readSafeWorkbook} from '../../server/catalog-workbook';
import sharp from 'sharp';
import {normalizeImage} from '../../server/image-assets';
import {parseMaterialWorkbook} from '../../server/material-workbook';
import {materialWorkbookColumns} from '../../src/material-workbook-format';
import {materialFamily} from '../../src/material-families';
import {parseInches} from '../../src/measurements';
import {materialInput,describeMaterial} from '../../server/catalog-v2';
import {packageSchema,signature,type ImportRecord} from './core';
const [source,live,output]=process.argv.slice(2);if(!source||!live||!output)throw Error('Usage: prepare-strut.ts extracted-package live-snapshot.json output-directory');
const snapshot=JSON.parse(readFileSync(live,'utf8'));if(snapshot.format!=='etalonops-catalog-snapshot'||snapshot.version!==1)throw Error('Unsupported catalog export.');
mkdirSync(output,{recursive:true});mkdirSync(join(output,'images'),{recursive:true});const records:ImportRecord[]=[];
const tracker=await readSafeWorkbook(readFileSync(join(source,'EtalonOps-Strut-Research-Tracker.xlsx')));const imageSheet=tracker.find(s=>s.sheet==='Image Register')!;const imageMap=new Map(imageSheet.data.slice(1).map(r=>[String(r[3]),String(r[6])]));
function inches(v:string,length=false){let value=v.trim(),factor=1;if(length&&/(ft|feet|foot|')\s*$/i.test(value)){factor=12;value=value.replace(/(ft|feet|foot|')\s*$/i,'').trim();}return parseInches(value.replace(/(?:inches|inch|in|["″])\s*$/i,'').trim().replace(/^(\d+)-(\d+\/\d+)$/,'$1 $2'))*factor;}
for(const file of ['001','002','003'].map(n=>'EtalonOps-Strut-Catalog-Batch-'+n+'.xlsx')){const rows=await parseMaterialWorkbook(readFileSync(join(source,file)));
 for(const row of rows){const family=materialFamily(row.familyId),attrs:Record<string,string|number>={};
  for(const [,field] of materialWorkbookColumns){if(['key','description','category','unit','extra','phrases','image','source','notes','status'].includes(field)||!row[field])continue;if(field==='configurationStatus'&&row[field]==='existing')continue;attrs[field]=field.endsWith('In')?inches(row[field],field==='lengthIn'):field==='angleDeg'?Number(row[field]):row[field];}
  for(const line of (row.extra??'').split(/\r?\n/).filter(Boolean)){const at=line.indexOf('=');if(at<1)throw Error('Invalid extra specification.');const key=line.slice(0,at).trim(),v=line.slice(at+1).trim();if(Object.hasOwn(attrs,key))throw Error('Duplicate specification in '+file+' row '+row._row);const type=family?.fields.find(f=>f.key===key)?.kind;attrs[key]=['diameterIn','lengthIn','minSpanIn','maxSpanIn','widthIn','heightIn','depthIn'].includes(key)?inches(v,key==='lengthIn'):type==='inches'?inches(v):type==='number'?Number(v):v;}
  const material=materialInput.parse({externalKey:row.key||'BULK-'+createHash('sha256').update(JSON.stringify({category:row.category,unit:row.unit,attrs})).digest('hex').slice(0,24),displayDescription:row.description,category:row.category,productUnit:row.unit,attributes:attrs,sourceUrl:row.source,verificationBasis:row.notes,verification:'provisional',origin:'admin_reviewed'});describeMaterial(material);
  const ref=file+':'+row._row,record:ImportRecord={ref,originalKey:row.key??'',row,material,phrases:[...new Set([row.description,...(row.phrases??'').split(/[;\r\n]+/)].map(v=>v.trim()).filter(Boolean))]};
  if(record.originalKey){const m=snapshot.tables.materials.find((m:any)=>m.external_key===record.originalKey),p=snapshot.tables.catalog_profiles.find((p:any)=>String(p.material_id).toLowerCase()===String(m?.id).toLowerCase());if(!m||!p)throw Error('Live baseline key missing: '+record.originalKey);record.baselineSignature=signature(m,p);}
  const imageFile=imageMap.get(row.image);if(!imageFile||!/^images\/[a-zA-Z0-9_.-]+$/.test(imageFile))throw Error('Unmapped image: '+ref);const raw=readFileSync(join(source,imageFile));await normalizeImage(raw);const image=await sharp(raw).metadata();record.image={file:imageFile,sha256:createHash('sha256').update(raw).digest('hex'),sourceUrl:row.source,width:image.width!,height:image.height!};copyFileSync(join(source,imageFile),join(output,imageFile));records.push(record);
 }
}
if(records.length!==297)throw Error('Expected exactly 297 reviewed strut materials.');
const data=packageSchema.parse({format:'etalonops-publication-import-v1',source:'Strut Reconciled Review',expectedTenantHash:createHash('sha256').update(String(snapshot.tenant).toLowerCase()).digest('hex'),held:1,records});const bytes=JSON.stringify(data,null,2)+'\n';writeFileSync(join(output,'materials.json'),bytes);writeFileSync(join(output,'materials.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');writeFileSync(join(output,'PREPARED-SUMMARY.json'),JSON.stringify({ready:records.length,uniqueImages:new Set(records.map(r=>r.image!.file)).size,imageAssignments:records.length,heldExcluded:1,imageApproval:'Owner approved representative images in this conversation',snapshotDate:snapshot.exportedAt},null,2));console.log('Prepared 297 strut materials and 94 assets. No live data was modified.');
