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
node run.mjs --probe > .runtime/sql-source-ip
import_source_ip=$(cat .runtime/sql-source-ip)
import_rule="EtalonOpsR2Import-$(date +%s)-$$"
if [[ "$import_source_ip" != already-allowed ]]; then
  python3 - "$import_source_ip" <<'PY'
import ipaddress,sys
ipaddress.IPv4Address(sys.argv[1])
PY
  if [[ $(az sql server firewall-rule list -g rg-etalonops-poc -s etalonops-954bb4a3-sql --query "length([?name=='$import_rule'])" -o tsv) != 0 ]]; then echo 'Unexpected existing import firewall rule; stopped.' >&2; exit 1; fi
  cleanup() { az sql server firewall-rule delete -g rg-etalonops-poc -s etalonops-954bb4a3-sql -n "$import_rule" --output none >/dev/null 2>&1 || { echo "Remove only temporary rule $import_rule manually." >&2; return 1; }; }
  trap cleanup EXIT
  az sql server firewall-rule create -g rg-etalonops-poc -s etalonops-954bb4a3-sql -n "$import_rule" --start-ip-address "$import_source_ip" --end-ip-address "$import_source_ip" --output none
fi
node run.mjs "$@"
if [[ "$import_source_ip" != already-allowed ]]; then cleanup; trap - EXIT; fi
