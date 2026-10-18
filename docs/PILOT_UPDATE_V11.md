# Existing-pilot update v11

This source-only update includes the Administration workspace and Product research review page, plus previous named drafts, users/access and catalog/Excel-import updates. Release marker: `product-research-v11`.

Live research remains disabled; no new subscriptions, resources or paid AI are provisioned. Product research accepts prepared JSON and supports selection, editing, completeness checks, canonical-material matching and atomic insertion of provisional records. See PRODUCT_RESEARCH.md. This update also fixes explicit “pipe” translations being suppressed for conduit without removing diameter/schedule checks.

Upload EtalonOps-pilot-update-v11.zip to the existing owner's Bash Cloud Shell. Preserve the deployment directory, dependencies and .runtime state:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v11.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

This rebuilds/redeploys the existing app, applies only previously defined idempotent schema migrations, preserves checksums and verifies the release and Azure SQL health. It does not import Workbook 005. Keep its separate private import ZIP until ready to run that import. No need to create another Web App, database, subscription or plan.

After success, refresh the live site, open Administration → Product research and confirm live research is disabled. Use downloaded research instructions to generate a JSON candidate file, review/edit/select, preview and add. Test a part-number search afterward. Microsoft sign-in acceptance must still be tested on the actual live deployment.
