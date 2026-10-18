# Existing pilot update v4

Includes prior session/draft, catalog administration and export improvements, plus reviewed catalog corrections and duplicate retirement. No new subscription, AI activation, service or pricing tier is introduced.

Download `EtalonOps-pilot-update-v4.zip` from the repository's `preview-download` branch using **Download raw file**, then upload it to Azure Cloud Shell. Run this single line once:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v4.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

This source-only update requires the existing deployment directory, installed dependencies and `.runtime/azure-deployment.json`. It does not contain credentials, runtime state, catalogs or photos. It builds before changing the cloud schema, applies checksum-verified forward migrations to the existing database, preserves restricted identity permissions, packages the app, and deploys only the existing `etalonops-954bb4a3` app in `rg-etalonops-poc`. The account/tenant/app/identity guards stop unexpected targets.

If Cloud Shell does not already have SQL access, the migration helper temporarily adds only its exact public IPv4 address under `EtalonOpsSchemaUpdate`, and removes that rule on success or failure. An existing rule with that name stops the helper rather than being overwritten. Migration failure stops app deployment. If a later app deployment fails, the additive history table remains compatible with the previous app; do not delete migration history or retry a broad infrastructure deployment.

After deployment, sign in once. Save a draft with a changed date under the selected project, reload, and confirm both the selected project and saved date remain. In Catalog administration, select a material and inspect correction preview, cancellation and history. Correcting defining specifications retains the old record and its saved MRF references. Re-run purchasing checks on MRFs that refer to retired materials or products.

See [catalog corrections](CATALOG_CORRECTIONS.md) for the behavior and review boundaries. This package was tested in the development environment; live Azure deployment and acceptance require the owner's authenticated Cloud Shell.
