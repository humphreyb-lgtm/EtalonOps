#!/usr/bin/env bash
# Existing pilot only. All catalog operations use the application repository.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")"
export ETALONOPS_IMPORT_ROOT="$PWD"
source node-cloud.sh
if [[ ! -d node_modules ]]; then npm ci --omit=dev --no-audit --no-fund; fi
node run.mjs --prepare-state
if [[ " $* " == *" --apply "* ]]; then
  import_release=$(node --input-type=module -e 'const r=await fetch("https://etalonops-954bb4a3.azurewebsites.net/api/health");if(!r.ok)process.exit(1);const h=await r.json();if(h.engine!=="Azure SQL"||!h.microsoftSignIn)process.exit(1);console.log(h.release)')
  if [[ "$import_release" != publication-import-v45 ]]; then
    case "$import_release" in
      source-research-v16|research-contract-v17|assisted-research-v18|catalog-details-v19|prepared-paste-v20|compact-research-v21|compact-research-v21.1|catalog-markers-v22|material-table-v23|material-filters-v24|material-descriptions-v25|compact-materials-v26|mrf-foreman-v27|header-alignment-v28|material-matches-v29|task-code-v30|workforce-accounts-v31|microsoft-session-v32|manual-entry-v33|grouped-review-v34|publish-images-v35|consistent-images-v36|pdf-foundation-v37|document-designer-v38|blank-designer-v39|grid-interaction-v40|automatic-grid-v41|ribbon-designer-v42|catalog-import-v43|material-workbook-v44) ;;
      *) echo 'Unrecognized newer/different app release; stopped without downgrading.' >&2; exit 1;;
    esac
    sha256sum --check app-update.sha256
    echo 'Installing the compatible v45 application update into the existing pilot first.'
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
import_rule="EtalonOpsR2Import-$(date +%s)-$$"
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
