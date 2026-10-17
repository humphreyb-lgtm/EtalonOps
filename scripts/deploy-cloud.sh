#!/usr/bin/env bash
# Execute only in the owner's Azure Cloud Shell, after reviewing docs/CLOUD_DEPLOYMENT.md.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v az >/dev/null
command -v python3 >/dev/null
source scripts/node-cloud.sh
mkdir -p .runtime
python3 - <<'PY'
import hashlib,json,os,subprocess
account=json.loads(subprocess.check_output(['az','account','show','-o','json']))
if account['id']!='a428f249-9b2a-4314-8619-6b3fd33c805e' or account['name']!='Azure Standard' or account['state']!='Enabled':
    raise SystemExit('Select the approved Azure Standard subscription before deployment.')
owner=json.loads(subprocess.check_output(['az','ad','signed-in-user','show','-o','json']))
suffix=hashlib.sha256(account['id'].encode()).hexdigest()[:8]
s=dict(subscription=account['id'],tenant=account['tenantId'],ownerId=owner['id'],ownerLogin=owner['userPrincipalName'],resourceGroup='rg-etalonops-poc',appName='etalonops-'+suffix,planName='etalonops-'+suffix+'-plan',sqlName='etalonops-'+suffix+'-sql',storageName='etalonops'+suffix,logsName='etalonops-'+suffix+'-logs',insightsName='etalonops-'+suffix+'-insights',identityName='EtalonOps POC '+suffix)
p='.runtime/azure-deployment.json'
if os.path.exists(p):
    prior=json.load(open(p))
    if any(prior.get(k)!=s[k] for k in s): raise SystemExit('Existing deployment state belongs to another account. Refusing to change it.')
    s=prior
json.dump(s,open(p,'w'),indent=2)
print('Approved subscription verified. Target: new EtalonOps POC group, East US, one B1 app and Basic SQL. AI disabled.')
PY
value() { python3 -c 'import json,sys;print(json.load(open(".runtime/azure-deployment.json"))[sys.argv[1]])' "$1"; }
remember() { python3 -c 'import json,sys;p=".runtime/azure-deployment.json";s=json.load(open(p));s[sys.argv[1]]=sys.argv[2];json.dump(s,open(p,"w"),indent=2)' "$1" "$2"; }
rg=$(value resourceGroup)
app=$(value appName)
sql_name=$(value sqlName)
# Stop before paid creation if the runtime, region or identity prerequisites fail.
az webapp list-runtimes --os linux --output tsv | python3 -c 'import sys; assert any(v.upper() in ("NODE|24-LTS","NODE:24-LTS") for v in sys.stdin.read().split()),"Azure Node 24 runtime unavailable; stop before provisioning."'
az appservice list-locations --sku B1 --linux-workers-enabled --query "[?name=='East US'].name" --output tsv | python3 -c 'import sys; assert "East US" in sys.stdin.read(),"East US B1 listing unavailable."'
# Existing group names must carry our ownership marker; never adopt an unrelated group.
if [ "$(az group exists --name "$rg" -o tsv)" = true ]; then
  [ "$(az group show -n "$rg" --query tags.etalonops -o tsv)" = poc ] || { echo 'Existing group is not owned by this POC; stopped.' >&2; exit 1; }
fi
if ! python3 -c 'import json;assert json.load(open(".runtime/azure-deployment.json")).get("clientId")' 2>/dev/null; then
  identity_name=$(value identityName)
  az ad app list --display-name "$identity_name" --output json > .runtime/identity-candidates.json
  count=$(python3 -c 'import json;print(len(json.load(open(".runtime/identity-candidates.json"))))')
  if [ "$count" = 0 ]; then
    python3 deploy/identity.py .runtime/azure-deployment.json > .runtime/identity.json
    az rest --method POST --url https://graph.microsoft.com/v1.0/applications --body @.runtime/identity.json --output json > .runtime/identity-created.json
  else
    python3 deploy/recover_identity.py .runtime/azure-deployment.json .runtime/identity-candidates.json > .runtime/identity-created.json
    echo 'Recovered the exact marked EtalonOps identity; no duplicate registration created.'
  fi
  remember clientId "$(python3 -c 'import json;print(json.load(open(".runtime/identity-created.json"))["appId"])')"
  remember applicationObjectId "$(python3 -c 'import json;print(json.load(open(".runtime/identity-created.json"))["id"])')"
fi
client=$(value clientId)
application_object=$(value applicationObjectId)
printf '{"identifierUris":["api://%s"]}' "$client" > .runtime/identifier.json
az rest --method PATCH --url "https://graph.microsoft.com/v1.0/applications/$application_object" --body @.runtime/identifier.json --output none
sp=$(az ad sp list --filter "appId eq '$client'" --query '[0].id' -o tsv)
if [ -z "$sp" ]; then sp=$(az ad sp create --id "$client" --query id -o tsv); fi
remember servicePrincipalId "$sp"
az rest --method PATCH --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp" --body '{"appRoleAssignmentRequired":true}' --output none
owner=$(value ownerId)
assigned=$(az rest --method GET --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp/appRoleAssignedTo" --query "length(value[?principalId=='$owner' && appRoleId=='9c6c4e1a-3830-4400-9b69-ce15aa8a0bdd'])" -o tsv)
if [ "$assigned" = 0 ]; then
  printf '{"principalId":"%s","resourceId":"%s","appRoleId":"9c6c4e1a-3830-4400-9b69-ce15aa8a0bdd"}' "$owner" "$sp" > .runtime/role.json
  az rest --method POST --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp/appRoleAssignedTo" --body @.runtime/role.json --output none
fi
# Consent is limited to this owner, this application and its own delegated API scope.
grant=$(az rest --method GET --url "https://graph.microsoft.com/v1.0/oauth2PermissionGrants?\$filter=clientId%20eq%20'$sp'" --query "length(value[?resourceId=='$sp' && principalId=='$owner' && consentType=='Principal'])" -o tsv)
if [ "$grant" = 0 ]; then
  printf '{"clientId":"%s","consentType":"Principal","principalId":"%s","resourceId":"%s","scope":"access_as_user"}' "$sp" "$owner" "$sp" > .runtime/consent.json
  az rest --method POST --url https://graph.microsoft.com/v1.0/oauth2PermissionGrants --body @.runtime/consent.json --output none
fi
npm ci --cache /tmp/etalonops-npm-cache --no-audit --no-fund
npm run build
npm run test:server
python3 deploy/template.py .runtime/azure-deployment.json > .runtime/azure-template.json
az group create --name "$rg" --location eastus --tags etalonops=poc --output none
# The What-If report is retained for review; the script is already within approved spending scope.
az deployment group what-if --resource-group "$rg" --template-file .runtime/azure-template.json --no-pretty-print > .runtime/azure-what-if.json
python3 - <<'PY'
import json
r=json.load(open('.runtime/azure-what-if.json'))
if r.get('status') not in [None,'Succeeded']: raise SystemExit('ARM what-if did not succeed.')
for change in r.get('changes',[]):
    if change.get('changeType')=='Delete': raise SystemExit('Unexpected deletion in ARM what-if; stopped.')
print('ARM preview checked: no deletions. Creating only approved POC infrastructure.')
PY
az deployment group create --name etalonops-base --resource-group "$rg" --template-file .runtime/azure-template.json --output none
runtime=$(az webapp identity show -g "$rg" -n "$app" --query principalId -o tsv)
remember runtimePrincipal "$runtime"
# Scope Blob access to this one POC account, not subscription or other storage.
blob_scope=$(az storage account show -g "$rg" -n "$(value storageName)" --query id -o tsv)
blob_role=$(az role assignment list --scope "$blob_scope" --query "length([?principalId=='$runtime' && ends_with(roleDefinitionId, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')])" -o tsv)
if [ "$blob_role" = 0 ]; then
  az role assignment create --assignee-object-id "$runtime" --assignee-principal-type ServicePrincipal --role 'Storage Blob Data Contributor' --scope "$blob_scope" --output none
fi
# Exact outbound IPv4 addresses only. No blanket Allow Azure Services rule.
ips=$(az webapp show -g "$rg" -n "$app" --query possibleOutboundIpAddresses -o tsv)
python3 -c 'import ipaddress,sys;[print(ipaddress.IPv4Address(x)) for x in sys.argv[1].split(",") if x]' "$ips" > .runtime/app-outbound-ips
[ -s .runtime/app-outbound-ips ] || { echo 'No verified outbound IPs; stopped.' >&2; exit 1; }
i=0
while IFS= read -r ip; do
  i=$((i+1)); az sql server firewall-rule create -g "$rg" -s "$sql_name" -n "EtalonOpsApp$i" --start-ip-address "$ip" --end-ip-address "$ip" --output none
done < .runtime/app-outbound-ips
# Azure SQL's rejected connection identifies the caller's public IPv4 address.
# Only that exact address is temporarily allowed; no third-party IP service.
npx --no-install tsx scripts/azure-probe.ts > .runtime/shell-ip
shell_ip=$(cat .runtime/shell-ip)
cleanup() { az sql server firewall-rule delete -g "$rg" -s "$sql_name" -n EtalonOpsCloudShellBootstrap --output none >/dev/null 2>&1 || echo 'Remove EtalonOpsCloudShellBootstrap firewall rule manually.' >&2; }
if [ "$shell_ip" != already-allowed ]; then
  python3 -c 'import ipaddress,sys;ipaddress.IPv4Address(sys.argv[1])' "$shell_ip"
  trap cleanup EXIT
  az sql server firewall-rule create -g "$rg" -s "$sql_name" -n EtalonOpsCloudShellBootstrap --start-ip-address "$shell_ip" --end-ip-address "$shell_ip" --output none
fi
npx --no-install tsx scripts/azure-migrate.ts
if [ "$shell_ip" != already-allowed ]; then cleanup; trap - EXIT; fi
# Ship dependencies built in Linux. No credentials, deployment state, caches or local fixtures.
python3 deploy/package.py
az webapp deploy -g "$rg" -n "$app" --src-path .runtime/app.zip --type zip --async false --output none
url="https://${app}.azurewebsites.net"
python3 deploy/check-cloud.py "$url"
echo "Cloud pilot: $url"
echo 'Sign in with your assigned owner account. Live AI and catalog image administration are not yet enabled.'
echo 'Preserve .runtime/azure-deployment.json (non-secret identifiers) before this ephemeral Cloud Shell closes.'
