# Existing pilot update v6 — user administration

Supersedes v5 and includes its named MRFs, catalog corrections and prior session work. Adds application-user registration, display names, role restrictions, project assignments, deactivation and retained access history. No new service, subscription or paid AI is activated.

Download `EtalonOps-pilot-update-v6.zip` using **Download raw file**, upload it to the existing authenticated Azure Cloud Shell, then run this single line once:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v6.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

The existing dependencies and `.runtime/azure-deployment.json` are required. The updater builds, runs checksum-verified forward migrations through version 006 in the existing SQL database, preserves restricted runtime permissions and deploys only the existing pilot app. Its temporary exact-IP SQL firewall rule is cleaned up; no pricing tiers or infrastructure resources change. Existing accounts, project memberships, draft IDs, lines, versions and history are retained.

The health checker requires `release: user-access-v6`, Azure SQL health and rejection of anonymous protected requests. Sign in as an assigned Microsoft administrator to see User administration. Microsoft remains the identity authority: this screen cannot create Microsoft accounts or assign Microsoft roles. See [user administration](USER_ADMINISTRATION.md) for role and revocation boundaries.

The initial catalog-preparation kit is in `docs/catalog-starter/`: empty CSV templates, clearly fictional syntax examples and instructions for the AI preparing the dataset. The example facts are not real products and must not be loaded into the live catalog. No catalog is seeded by this update.

This source package is locally tested; live Microsoft sign-in, a second assigned real user's isolation, and cloud acceptance remain to be performed after deployment. Do not roll back to pre-user-management code: it does not enforce the directory's deactivation and role restrictions. Preserve data and use a forward fix.
