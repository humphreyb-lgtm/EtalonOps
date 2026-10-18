import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { preflightCatalog } from '../server/catalog-preflight';
try {
  const paths=process.argv.slice(2);
  if(!paths.length||paths.length>50)throw new Error('Usage: npm run catalog:preflight -- materials.csv products.csv translations.csv images.csv (1–50 ordered files)');
  let bytes=0;
  const files=paths.map(path=>{
    const stat=statSync(path);bytes+=stat.size;
    if(!stat.isFile()||stat.size>800000||bytes>20_000_000)throw new Error('Use regular CSV files up to 800 KB each and 20 MB per delivery.');
    return {name:basename(path),csv:readFileSync(path,'utf8')};
  });
  const report=preflightCatalog(files);console.log(JSON.stringify(report,null,2));
  if(!report.valid)process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.message:'Catalog preflight failed.');process.exitCode=1;}
