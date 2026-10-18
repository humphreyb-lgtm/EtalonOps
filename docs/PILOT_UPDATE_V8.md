# Existing pilot update v8 — Administration workspace

Includes all prior user access, named drafts, catalog and immutable MRF submission work. Adds a dedicated Administration workspace with users/access, catalog/imports, product images, job restrictions and read-only AI usage. No new services, subscriptions or paid AI activation.

Download `EtalonOps-pilot-update-v8.zip` using **Download raw file**, upload to the original authenticated Azure Cloud Shell, then run this line once:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v8.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Preserve dependencies and `.runtime/azure-deployment.json`. The guarded updater builds and verifies migrations through 007, then updates only the existing pilot application. Existing data and permissions remain intact. No new database migration is required for this workspace. The health checker expects `admin-workspace-v8`.

Follow [Administration verification](ADMIN_WORKSPACE.md) after deployment, then verify real Microsoft sign-in restoration and second-user isolation. Live Azure deployment is not performed from the development workspace, which has no Azure credentials. Use forward fixes rather than deploying older code without submitted-MRF locks or user-deactivation checks.
