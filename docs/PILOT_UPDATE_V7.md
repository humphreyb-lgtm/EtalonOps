# Existing pilot update v7 — MRF submission

Includes all prior named-draft, user-administration and catalog work. Adds final review, purchasing validation, numbered immutable submitted MRFs, My Submitted MRFs, linked revision drafts, printing and manual purchasing CSV export. No new service, subscription, vendor messaging or paid AI activation is introduced.

Download `EtalonOps-pilot-update-v7.zip` with **Download raw file**, upload it to the original authenticated Azure Cloud Shell, then run this single line once:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v7.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Keep the existing dependency installation and `.runtime/azure-deployment.json`. The guarded updater builds, applies checksum-verified forward migrations through version 007 to the existing database, preserves restricted runtime permissions and deploys only the existing pilot app. Existing users, project memberships, drafts, catalog data and history remain intact. Temporary exact-IP SQL access is cleaned up as in v6.

The health checker requires release `mrf-submission-v7`, Azure SQL health and denial of anonymous protected requests. After deployment, test real Microsoft sign-in restoration and a second assigned user's isolation. Use [the MRF submission walkthrough](MRF_SUBMISSION.md) to submit a request, reopen it, export it, create a revision and confirm that the original remains unchanged.

Do not roll back to pre-submission application code: it does not enforce submitted-draft locks. Preserve the database and use a forward fix. The immutable submitted snapshot is the authoritative reviewed record; later catalog or draft edits must not replace it.

The standalone HTML remains a browser-only named-draft demonstration. Real submission, user administration and permission checks require the database-backed pilot. The starter-catalog templates remain in `docs/catalog-starter`; no fictional example catalog is seeded into Azure.
