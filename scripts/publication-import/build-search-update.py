"""Package reviewed phrase data and the existing owner-run Cloud Shell updater."""
import hashlib,json,pathlib,subprocess,sys,zipfile
root=pathlib.Path(__file__).resolve().parents[2]
prepared=pathlib.Path(sys.argv[1]);app=pathlib.Path(sys.argv[2]);output=pathlib.Path(sys.argv[3])
manifest=json.loads((prepared/'materials.json').read_text())
if manifest.get('mode')!='translations-only' or any(r.get('originalKey') or r.get('image') for r in manifest['records']):raise SystemExit('Expected an append-only translation package.')
actual=hashlib.sha256((prepared/'materials.json').read_bytes()).hexdigest()
if actual!=(prepared/'materials.sha256').read_text().strip():raise SystemExit('Manifest checksum mismatch.')
subprocess.run([str(root/'node_modules/.bin/esbuild'),str(root/'scripts/publication-import/run.ts'),'--bundle','--platform=node','--format=esm','--packages=external','--outfile='+str(prepared/'run.mjs')],check=True)
files={name:(prepared/name).read_bytes() for name in ['materials.json','materials.sha256','REVIEW.json','run.mjs']}
for name in ['package.json','package-lock.json']:files[name]=(root/name).read_bytes()
files['node-cloud.sh']=(root/'scripts/node-cloud.sh').read_bytes()
files['run-import.sh']=(root/'scripts/publication-import/run-import.sh').read_bytes()
files['start-import.sh']=(root/'scripts/publication-import/start-import.sh').read_text().replace('--apply --approve-images','--apply').replace('strut import','search update').replace('Strut import','Search update').encode()
files['status.sh']=(root/'scripts/publication-import/status.sh').read_text().replace("print('Images:',r.get('images',{}))","print('Phrase verification:',r.get('translationVerification',{}).get('verifiedAssociations','Not finished'))\n print('Existing catalog preserved:',r.get('translationVerification',{}).get('protectedDataUnchanged','Not finished'))").replace('Material batches:','Translation batches:').encode()
files['README.txt']=('EtalonOps v49.2 search coverage update\nRun start-import.sh in the existing owner Azure Bash Cloud Shell.\nRequires the original 297 strut materials to be installed. Resolves their live Material Keys.\nAppends reviewed phrases only; preserves catalog metadata, images and existing translations.\nInstaller updates only recognized older app versions; it refuses unknown newer releases.\nTemporary container OAuth access and an exact-source-IP SQL rule, if needed, are removed on exit.\nThe existing container lease prevents overlap with the original import. Backups and progress reports are private.\nNo AI/Bing calls. Rerun safely after interruption.\nSee REVIEW.json for withheld phrases and acceptance corrections.\n').encode()
files['app-update.zip']=app.read_bytes();files['app-update.sha256']=(hashlib.sha256(files['app-update.zip']).hexdigest()+'  app-update.zip\n').encode()
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED)as z:
 for name,data in files.items():z.writestr(name,data)
checksum=hashlib.sha256(output.read_bytes()).hexdigest()
installer=(root/'scripts/publication-import/install-search-update.sh').read_text().replace('ARCHIVE_SHA256',checksum)
output.with_name('install-search-update.sh').write_text(installer)
print(output,checksum)
