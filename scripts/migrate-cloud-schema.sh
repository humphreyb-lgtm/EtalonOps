#!/usr/bin/env bash
# Forward schema migration in the existing pilot database. No resource or SKU changes.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/node-cloud.sh
python3 - <<'PY'
import json,subprocess
s=json.load(open('.runtime/azure-deployment.json'))
a=json.loads(subprocess.check_output(['az','account','show','-o','json']))
assert a['id']==s['subscription']=='a428f249-9b2a-4314-8619-6b3fd33c805e' and a['tenantId']==s['tenant'],'Account mismatch; stopped.'
assert s['resourceGroup']=='rg-etalonops-poc' and s['appName']=='etalonops-954bb4a3' and s['sqlName']=='etalonops-954bb4a3-sql','Unexpected pilot; stopped.'
principal=subprocess.check_output(['az','webapp','identity','show','-g',s['resourceGroup'],'-n',s['appName'],'--query','principalId','-o','tsv'],text=True).strip()
assert principal.lower()==s['runtimePrincipal'].lower(),'Runtime identity changed; stopped.'
PY
value() { python3 -c 'import json,sys;print(json.load(open(".runtime/azure-deployment.json"))[sys.argv[1]])' "$1"; }
rg=$(value resourceGroup)
app=$(value appName)
sql_name=$(value sqlName)
# A separate exact-IP rule is removed on success or failure. Never broaden access.
npx --no-install tsx scripts/azure-probe.ts > .runtime/schema-shell-ip
shell_ip=$(cat .runtime/schema-shell-ip)
if [ "$shell_ip" != already-allowed ]; then
  python3 -c 'import ipaddress,sys;ipaddress.IPv4Address(sys.argv[1])' "$shell_ip"
  az sql server firewall-rule list -g "$rg" -s "$sql_name" -o json > .runtime/schema-firewall-rules.json
  python3 -c 'import json;assert not any(r["name"]=="EtalonOpsSchemaUpdate" for r in json.load(open(".runtime/schema-firewall-rules.json"))),"Existing schema update rule found; stopped without overwriting it."'
  cleanup() { az sql server firewall-rule delete -g "$rg" -s "$sql_name" -n EtalonOpsSchemaUpdate --output none >/dev/null 2>&1 || { echo 'Remove only the EtalonOpsSchemaUpdate firewall rule manually.' >&2; return 1; }; }
  trap cleanup EXIT
  az sql server firewall-rule create -g "$rg" -s "$sql_name" -n EtalonOpsSchemaUpdate --start-ip-address "$shell_ip" --end-ip-address "$shell_ip" --output none
fi
npx --no-install tsx scripts/azure-migrate.ts
if [ "$shell_ip" != already-allowed ]; then cleanup; trap - EXIT; fi
