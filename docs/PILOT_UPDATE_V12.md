# Pilot update v12 — direct Excel upload and unpublished review

Release: `workbook-publishing-v12`. Source-only update for the existing pilot; contains no user workbooks, database contents, credentials or runtime state. Installs locked open-source parsing dependencies, builds the app and redeploys the existing resources. No new Azure resources, schema versions or paid AI services.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v12.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

After success, hard-refresh the live site and open Administration → Workbook imports. Choose the original catalog `.xlsx` file. It is saved unpublished and out of search. Inspect/edit rows, select valid records, approve and publish selected records. Leave the rest unpublished or delete unwanted staged rows. Keep product/material/translation relationships together when publishing a new material.

See WORKBOOK_PUBLISHING.md for limits, provenance and permission rules. The older Workbook 005 Cloud Shell import bypasses this new staging queue, so use the browser upload instead of that earlier command. Workbook 005 remains private and is not bundled in this release.
