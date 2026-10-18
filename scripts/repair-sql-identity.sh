#!/usr/bin/env bash
# Repair this pilot's SQL identity only. No infrastructure deployment or SKU change.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/node-cloud.sh
python3 - <<'PY'
import json,subprocess
s=json.load(open('.runtime/azure-deployment.json'))
a=json.loads(subprocess.check_output(['az','account','show','-o','json']))
assert a['id']==s['subscription']=='a428f249-9b2a-4314-8619-6b3fd33c805e' and a['tenantId']==s['tenant'],'Account mismatch; stopped.'
assert s['resourceGroup']=='rg-etalonops-poc','Unexpected resource group; stopped.'
principal=subprocess.check_output(['az','webapp','identity','show','-g',s['resourceGroup'],'-n',s['appName'],'--query','principalId','-o','tsv'],text=True).strip()
assert principal.lower()==s['runtimePrincipal'].lower(),'Runtime identity changed; stopped.'
PY
value() { python3 -c 'import json,sys;print(json.load(open(".runtime/azure-deployment.json"))[sys.argv[1]])' "$1"; }
rg=$(value resourceGroup)
app=$(value appName)
sql_name=$(value sqlName)
# A separate exact-IP rule is removed on success or failure. Never broaden access.
npx --no-install tsx scripts/azure-probe.ts > .runtime/repair-shell-ip
shell_ip=$(cat .runtime/repair-shell-ip)
if [ "$shell_ip" != already-allowed ]; then
  python3 -c 'import ipaddress,sys;ipaddress.IPv4Address(sys.argv[1])' "$shell_ip"
  az sql server firewall-rule list -g "$rg" -s "$sql_name" -o json > .runtime/repair-firewall-rules.json
  python3 -c 'import json;assert not any(r["name"]=="EtalonOpsIdentityRepair" for r in json.load(open(".runtime/repair-firewall-rules.json"))),"Existing repair rule found; stopped without overwriting it."'
  cleanup() { az sql server firewall-rule delete -g "$rg" -s "$sql_name" -n EtalonOpsIdentityRepair --output none >/dev/null 2>&1 || echo 'Remove only the EtalonOpsIdentityRepair firewall rule manually.' >&2; }
  trap cleanup EXIT
  az sql server firewall-rule create -g "$rg" -s "$sql_name" -n EtalonOpsIdentityRepair --start-ip-address "$shell_ip" --end-ip-address "$shell_ip" --output none
fi
npx --no-install tsx scripts/azure-migrate.ts
if [ "$shell_ip" != already-allowed ]; then cleanup; trap - EXIT; fi
az webapp restart -g "$rg" -n "$app" --output none
host=$(az webapp show -g "$rg" -n "$app" --query defaultHostName -o tsv)
python3 deploy/callback.py "$host" >/dev/null
python3 deploy/check-cloud.py "https://${host}"
echo "Cloud pilot: https://${host}"
