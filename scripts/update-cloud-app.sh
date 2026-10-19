#!/usr/bin/env bash
# Update the existing pilot application only; no resource or SKU changes.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ ! -f .runtime/azure-deployment.json ]]; then
  echo "Local deployment settings are missing; recovering from existing Azure resources."
  bash scripts/recover-cloud-workspace.sh
fi
source scripts/node-cloud.sh
python3 - <<'PY'
import json,subprocess
s=json.load(open('.runtime/azure-deployment.json'))
a=json.loads(subprocess.check_output(['az','account','show','-o','json']))
assert a['id']==s['subscription']=='a428f249-9b2a-4314-8619-6b3fd33c805e' and a['tenantId']==s['tenant'],'Account mismatch; stopped.'
assert s['resourceGroup']=='rg-etalonops-poc' and s['appName']=='etalonops-954bb4a3','Unexpected application; stopped.'
app=json.loads(subprocess.check_output(['az','webapp','show','-g',s['resourceGroup'],'-n',s['appName'],'-o','json']))
assert app['identity']['principalId'].lower()==s['runtimePrincipal'].lower(),'Runtime identity mismatch; stopped.'
PY
npm ci --no-audit --no-fund
npm run build
bash scripts/migrate-cloud-schema.sh
python3 deploy/package.py
az webapp deploy --name etalonops-954bb4a3 --resource-group rg-etalonops-poc --src-path .runtime/app.zip --type zip --output none
host=$(az webapp show --name etalonops-954bb4a3 --resource-group rg-etalonops-poc --query defaultHostName -o tsv)
python3 deploy/callback.py "$host" >/dev/null
python3 deploy/check-cloud.py "https://${host}"
echo "Cloud pilot: https://${host}"
