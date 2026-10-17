"""Allowlisted runtime ZIP. Never package runtime state, credentials or Git."""
import os
import zipfile
files=['package.json','package-lock.json']
for root in ['dist','dist-server','node_modules']:
    for path,dirs,names in os.walk(root):
        dirs[:]=[d for d in dirs if d not in ['.cache','.git']]
        for name in names:
            full=os.path.join(path,name)
            if os.path.islink(full): continue
            if root=='server' and (name.endswith('.test.ts') or name=='sql.integration.ts'): continue
            files.append(full)
with zipfile.ZipFile('.runtime/app.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(files): archive.write(name,name)
print('Runtime ZIP prepared from allowlisted application/build/dependency files.')
