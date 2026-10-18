# Existing pilot update v5 — named drafts

Includes the v4 catalog corrections and previous session/draft fixes, and adds multiple named MRF drafts per person per project. The update does not add services, change pricing tiers or activate paid AI.

Download `EtalonOps-pilot-update-v5.zip` using **Download raw file** on the repository's `preview-download` branch, upload it to Azure Cloud Shell, and run this single line once:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v5.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

The original authenticated deployment directory, existing dependencies and `.runtime/azure-deployment.json` are required. This source-only package preserves runtime state and private files. The guarded updater builds, applies checksum-verified forward migrations through version 005, and deploys only the existing pilot app. The SQL migration removes the old one-draft-per-owner/project constraint and supplies editable names for older requests. Existing draft IDs, line snapshots, versions, owners and timestamps are retained. SQLite uses a transactional table rebuild with foreign-key verification; SQL Server uses a transactional constraint/column migration.

The migration helper can temporarily add Cloud Shell's exact public IPv4 address under `EtalonOpsSchemaUpdate`; it removes that rule afterward and refuses to overwrite an existing rule with that name. Schema failure stops app deployment. Back up and retain the known-good application package as usual. Do not deploy older application code after enabling multiple drafts: older code assumes one draft per project. Use a forward fix and preserve the database instead of restoring that assumption.

The post-deployment checker requires health release `named-drafts-v5`, Azure SQL health and rejection of anonymous protected requests. Real Microsoft sign-in restoration and browser acceptance remain live checks. Use [the demonstration walkthrough](NAMED_DRAFTS_DEMONSTRATION.md), including creating two requests in the same project, reopening the older request, reloading it and checking a second user's isolation.

[The completion plan](MRF_COMPLETION_PLAN.md) includes user administration, starter catalog/translation preparation, complete purchasing checks, separately approved AI activation, submission/handoff and release acceptance. These are not represented as already complete by this update.
