# Approved pilot deployment through Azure Cloud Shell

The owner approved the approximately $25/month base estimate and the illustrated AI expenses on October 17, 2026, following the roughly $30/month combined planning estimate and its exclusions. This is an operating estimate, not a hard cap. Existing Azure charges are additional. AI stays disabled until its complete service chain is verified within the approved scope. DNS remains unapproved.

## Scope and identities

Target: Azure Standard, subscription `a428f249-9b2a-4314-8619-6b3fd33c805e`, East US, new `rg-etalonops-poc`. Resource providers were registered by the owner. B1 Linux lists East US; actual capacity and SQL availability are established only by deployment. No existing MaterialsManagement resources are changed.

The script creates one single-tenant Entra SPA/API application and service principal. Only the signed-in owner receives its Admin application role and consent to its own `access_as_user` scope; service-principal assignment is required. No client secret or new directory role is created. This requires appropriate existing Entra permissions; subscription Owner alone does not establish them. Identity failures stop before paid infrastructure is created. If an identity already exists without matching state, stop and recover its identifiers rather than creating another.

The resource group contains a one-instance B1 Linux plan/web app, Entra-only Azure SQL logical server/Basic 2 GB database, Hot LRS private Blob container, Log Analytics with 0.1 GB/day ingestion cap, workspace-based Application Insights and a $30 monthly resource-group budget with Owner-role alerts at 50/80/100%. Alerts/daily quotas can be delayed and do not cap all charges. The budget excludes existing resources and any future AI service outside this group. Azure Monitor resources are prepared, but full application trace instrumentation is not connected yet.

The app uses a system-assigned managed identity, encrypted SQL connections, restricted table grants and Blob Data Contributor scoped to its own storage account. SQL DDL is executed separately through the owner's Entra admin connection. The SQL server identity receives no directory-wide Graph permissions. Explicit-SID contained user creation avoids directory lookup for the runtime identity. SQL firewall rules allow only app outbound IPv4 addresses and an exact temporary Cloud Shell address during bootstrap. No blanket Allow Azure Services rule is used. Blob anonymous access/shared keys are disabled; its public HTTPS endpoint is protected by Entra authorization. The runtime has no database password or embedded cloud credentials.

Microsoft browser sign-in uses MSAL authorization code with PKCE, a dedicated redirect bridge and memory-only token cache. The API independently validates tenant, issuer, audience, delegated scope and assigned role. Local mock sign-in is absent from the production launcher; fixture imports/saves are rejected. No fixture catalog is loaded in Azure. The two project names are explicitly pilot examples; owner memberships are initialized. Real project/catalog onboarding and image administration remain separate work. Cloud AI discovery stays disabled, with manual description fallback.

## Owner execution

Use the approved Azure Standard account in an ephemeral Bash Cloud Shell. Download `EtalonOps-cloud-deploy.zip` from the repository's `preview-download` branch, then use Cloud Shell **Manage files → Upload**. The package contains source/instructions only, with no credentials or local database.

```bash
unzip EtalonOps-cloud-deploy.zip -d etalonops-deploy
cd etalonops-deploy
bash scripts/deploy-cloud.sh
```

Review scripts before execution. The script verifies the exact subscription, Node 24 runtime listing, B1 East US listing and Entra setup, builds and tests source, creates only the owned POC group, saves/checks the ARM What-If report for deletions, then deploys within approved scope. It refuses to adopt an existing unmarked group. Its generated names use a deterministic subscription hash; global name/capacity conflicts surface as deployment errors rather than overwriting unrelated resources.

If Cloud Shell lacks Node 24, the helper downloads official Node 24.19.0 into its own local directory, verifies its published SHA-256 before extraction and uses it without root access. Download/verification failures stop before resource creation. Do not change engine constraints or bypass certificate verification. Do not enter a database password or GitHub token. The dependency install/build uses this source ZIP, avoiding private-repository credentials.

No secrets are written by the scripts. Azure CLI's existing Cloud Shell credential cache remains outside the package. SQL access tokens are passed from CLI stdout directly into Node's driver and never printed/saved. `.runtime/azure-deployment.json` contains non-secret resource/application IDs and must be downloaded before an ephemeral Cloud Shell closes. Preserve this file to resume. Other runtime files include manifests, ARM preview and app ZIP; do not upload unrelated Cloud Shell credential caches.

## Verification and failure recovery

Local verification passed: strict TypeScript/production and server-bundle builds; 8 backend/configuration/host-security tests; 6 actual SQL Server integration tests; 29 browser tests (including cloud-mode query bypass checks, responsive accessibility, native 200% zoom and offline preview); one generated-template scope/security test; shell/Python syntax checks; and no known production dependency vulnerabilities. The Node 24.19.0 download/install path was executed with official published SHA-256 verification. Python/bash checks validate generated deployment artifacts and packaging. No actual Azure deployment, Graph role/consent operation, managed-identity SQL session or real browser Entra login has been executed from this workspace; its interactive CLI login is blocked by tenant Security Defaults. Cloud Shell execution is required for these checks. Template syntax/local tests do not establish cloud readiness.

After deployment, the script checks live Azure SQL health and rejects anonymous access to protected APIs/dev sessions. Then test real Microsoft sign-in, draft persistence in a new browser session, and a separately assigned second user's isolation. Do not accept customer data before acceptance. Confirm real SKU/rates, budget contacts/notifications, SQL 7-day PITR and Blob 7-day deletion/version retention. A local restore drill does not verify Azure recovery. AI, external search, image administration, catalog data review and DNS are pending.

A failed script can leave billable POC resources running. It never auto-deletes the group or customer data to hide a failure. Report the first error for repair; preserve state. Retry after diagnosis, not by changing resource names or relaxing security. If temporary SQL firewall-rule cleanup fails, remove only `EtalonOpsCloudShellBootstrap` on the POC server. For application rollback, retain a known-good `.runtime/app.zip` outside the ephemeral shell and redeploy it with the same Entra-aware cloud launcher; never deploy the standalone demo to the public site. Schema changes require checksum-preserving forward migrations.
