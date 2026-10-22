#!/usr/bin/env bash
# Existing pilot only. All catalog operations use the application repository.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")"
export ETALONOPS_IMPORT_ROOT="$PWD"
mkdir -p .runtime
exec 9>.runtime/import.lock
flock -n 9 || { echo "An import process is already running in this folder. View .runtime/run.log for progress."; exit 0; }
source node-cloud.sh
if [[ ! -d node_modules ]]; then npm ci --omit=dev --no-audit --no-fund; fi
node run.mjs --prepare-state
if [[ " $* " == *" --apply "* ]]; then
  import_release=$(node --input-type=module -e 'const r=await fetch("https://etalonops-954bb4a3.azurewebsites.net/api/health");if(!r.ok)process.exit(1);const h=await r.json();if(h.engine!=="Azure SQL"||!h.microsoftSignIn)process.exit(1);console.log(h.release)')
  if [[ "$import_release" != cms-suite-v49.1 ]]; then
    case "$import_release" in
      publication-import-v45|specification-search-v46|trade-search-v47|manual-review-design-v48|appearance-studio-v49|cms-suite-v49) ;;
      *) echo 'Unrecognized newer/different app release; stopped without downgrading.' >&2; exit 1;;
    esac
    sha256sum --check app-update.sha256
    echo 'Installing the compatible CMS v49.1 image-capacity update first. Existing CMS content is preserved.'
    mkdir -p "$HOME/etalonops-westus3"
    unzip -oq app-update.zip -d "$HOME/etalonops-westus3"
    bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
  fi
fi
import_storage_assignment=''
import_sql_rule_created=false
cleanup() {
  local cleanup_failed=0
  if [[ "$import_sql_rule_created" == true ]]; then
    az sql server firewall-rule delete -g rg-etalonops-poc -s etalonops-954bb4a3-sql -n "$import_rule" --output none >/dev/null 2>&1 || { echo "Remove temporary SQL rule $import_rule manually." >&2; cleanup_failed=1; }
  fi
  if [[ -n "$import_storage_assignment" ]]; then
    az role assignment delete --ids "$import_storage_assignment" --output none >/dev/null 2>&1 || { echo "Remove temporary storage role $import_storage_assignment manually." >&2; cleanup_failed=1; }
  fi
  return "$cleanup_failed"
}
trap cleanup EXIT
if [[ " $* " == *" --apply "* ]]; then
  import_storage_name=$(node -p "JSON.parse(require('fs').readFileSync('.runtime/state.json')).storageName")
  import_owner_id=$(node -p "JSON.parse(require('fs').readFileSync('.runtime/state.json')).ownerId")
  import_storage_scope="/subscriptions/a428f249-9b2a-4314-8619-6b3fd33c805e/resourceGroups/rg-etalonops-poc/providers/Microsoft.Storage/storageAccounts/$import_storage_name/blobServices/default/containers/catalog-images"
  import_storage_role='ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  import_existing_role=$(az role assignment list --assignee "$import_owner_id" --scope "$import_storage_scope" --include-inherited --query "length([?ends_with(roleDefinitionId, '$import_storage_role')])" -o tsv)
  if [[ "$import_existing_role" == 0 ]]; then
    import_assignment_name=$(python3 -c 'import uuid; print(uuid.uuid4())')
    import_storage_assignment="$import_storage_scope/providers/Microsoft.Authorization/roleAssignments/$import_assignment_name"
    az role assignment create --name "$import_assignment_name" --assignee-object-id "$import_owner_id" --assignee-principal-type User --role "$import_storage_role" --scope "$import_storage_scope" --output none
    echo 'Temporary OAuth image-upload access granted for the existing catalog-images container; it will be removed on exit.'
  fi
fi
node run.mjs --probe > .runtime/sql-source-ip
import_source_ip=$(cat .runtime/sql-source-ip)
import_rule="EtalonOpsReviewedImport-$(date +%s)-$$"
if [[ "$import_source_ip" != already-allowed ]]; then
  python3 - "$import_source_ip" <<'PY'
import ipaddress,sys
ipaddress.IPv4Address(sys.argv[1])
PY
  if [[ $(az sql server firewall-rule list -g rg-etalonops-poc -s etalonops-954bb4a3-sql --query "length([?name=='$import_rule'])" -o tsv) != 0 ]]; then echo 'Unexpected existing import firewall rule; stopped.' >&2; exit 1; fi
  import_sql_rule_created=true
  az sql server firewall-rule create -g rg-etalonops-poc -s etalonops-954bb4a3-sql -n "$import_rule" --start-ip-address "$import_source_ip" --end-ip-address "$import_source_ip" --output none
fi
node run.mjs "$@"
cleanup
trap - EXIT
