#!/usr/bin/env bash
# Restore local Cloud Shell files only; all Azure calls here are read-only.
set -euo pipefail
umask 077
workspace="$HOME/etalonops-westus3"
mkdir -p "$workspace/.runtime"
recovery_dir=$(mktemp -d)
trap 'rm -rf "$recovery_dir"' EXIT
# Immutable, already-tested v11 source. Fill missing files without replacing local files.
curl --fail --silent --show-error --location 'https://codeload.github.com/humphreyb-lgtm/EtalonOps/zip/40d5901' --output "$recovery_dir/source.zip"
unzip -q "$recovery_dir/source.zip" -d "$recovery_dir/source"
source_dir=$(find "$recovery_dir/source" -mindepth 1 -maxdepth 1 -type d -name 'EtalonOps-*')
[ -n "$source_dir" ] && [ -f "$source_dir/package-lock.json" ]
cp -an "$source_dir/." "$workspace/"
cd "$workspace"
python3 - <<'PY'
import json, pathlib, subprocess, uuid

def az(*args):
    return json.loads(subprocess.check_output(['az',*args,'--output','json'],text=True))

def check(condition,message):
    if not condition: raise SystemExit(message)

state_path=pathlib.Path('.runtime/azure-deployment.json')
check(not state_path.exists(),'A setup file already exists; stopped without overwriting it.')
account=az('account','show')
subscription='a428f249-9b2a-4314-8619-6b3fd33c805e'
check(account['id']==subscription,'Select the existing Azure Standard subscription, then rerun recovery.')
rg='rg-etalonops-poc';app_name='etalonops-954bb4a3';sql_name='etalonops-954bb4a3-sql'
app=az('webapp','show','--resource-group',rg,'--name',app_name)
db=az('sql','db','show','--resource-group',rg,'--server',sql_name,'--name','EtalonOps')
owner=az('ad','signed-in-user','show','--query','{id:id,userPrincipalName:userPrincipalName}')
admins=az('sql','server','ad-admin','list','--resource-group',rg,'--server-name',sql_name)
check(len(admins)==1 and str(admins[0].get('sid','')).lower()==owner['id'].lower(),'The signed-in user is not the existing SQL administrator. No setup file was written.')
settings=az('webapp','config','appsettings','list','--resource-group',rg,'--name',app_name,'--query',"[?name=='ETALONOPS_TENANT_ID' || name=='ETALONOPS_CLIENT_ID' || name=='ETALONOPS_SQL_HOST' || name=='ETALONOPS_STORAGE_ACCOUNT'].{name:name,value:value}")
values={row['name']:row['value'] for row in settings}
check(values.get('ETALONOPS_TENANT_ID','').lower()==account['tenantId'].lower(),'Pilot tenant does not match the signed-in account.')
check(values.get('ETALONOPS_SQL_HOST')==sql_name+'.database.windows.net','Pilot SQL hostname mismatch.')
principal=app.get('identity',{}).get('principalId','');uuid.UUID(principal);uuid.UUID(values['ETALONOPS_CLIENT_ID']);uuid.UUID(owner['id'])
check(app['id'].lower().startswith('/subscriptions/'+subscription+'/resourcegroups/'+rg+'/'),'Unexpected app resource.')
check(db['id'].lower().endswith('/servers/'+sql_name+'/databases/etalonops'),'Unexpected database resource.')
state={'subscription':subscription,'tenant':account['tenantId'],'resourceGroup':rg,'appName':app_name,'appHost':app['defaultHostName'],'sqlName':sql_name,'runtimePrincipal':principal,'ownerId':owner['id'],'ownerLogin':owner['userPrincipalName'],'clientId':values['ETALONOPS_CLIENT_ID'],'storageName':values.get('ETALONOPS_STORAGE_ACCOUNT',''),'region':app['location'],'recoveredForExistingPilotUpdate':True}
with state_path.open('x') as f: json.dump(state,f,indent=2)
state_path.chmod(0o600)
print('Recovered local setup from existing Azure app, SQL administrator and sign-in settings. No Azure resources changed.')
PY
source scripts/node-cloud.sh
npm ci --no-audit --no-fund
printf '\nCloud Shell workspace recovered. Ready to run the existing pilot update.\n'
