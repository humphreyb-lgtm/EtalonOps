# SQL Server validation after network publication

Microsoft artifact/pricing/documentation access now works. The previously blocked SQL Server image downloaded successfully with Docker checksum verification. No paid Azure resources or DNS records were created.

## Implemented and tested

The existing API now supports either the SQLite development repository or a SQL Server repository through the same async-compatible boundary. SQL Server uses parameterized requests, tenant/owner predicates, explicit admin checks and serializable transactions for imports and parent-row locking for versioned draft reads/saves. The approved desktop/mobile interface is retained. Default downloaded HTML remains a standalone demo; it cannot start a database.

The initial SQL Server migration was executed on **SQL Server 2022, build 16.0.4305.5**. Engine validation caught a reserved identifier (`file`) in the draft schema; it is now correctly quoted. A checksum ledger rejects editing already-applied migration history. Initialization is idempotent for the development and test databases.

Verified checks:

- **6 SQL Server integration tests:** trusted TLS, rejection of untrusted certificates, non-admin application login, denied DDL/audit deletion, dry-run/import/idempotency/conflicts/export/rollback, ranked matching, tenant/owner isolation, exact decimal strings and requested/package units, date inheritance/override, reconnection, preserved historical references, simultaneous stale-save conflict, 50 alternating concurrent clear/save rounds for independent owners and HTTP authorization.
- **27 Playwright browser tests with the API configured for SQL Server**, including actual database-backed desktop/390 px save/resume in a new browser context. Other tests cover 320/375/390/768/1440 and landscape layouts, accessible interaction, long descriptions, typed conversation, native 200% zoom and the standalone artifact.
- **6 SQLite/backend regression tests**, strict TypeScript, production build and standalone preview build.
- **Native SQL recovery drill:** checksum backup of the nonempty fixture test database, `RESTORE VERIFYONLY`, restore into a unique temporary database, matching material/draft/line counts, and `DBCC CHECKDB`. Only the uniquely generated restore database is dropped; original databases are retained. This is not an Azure recovery or SLA claim.

A repeated desktop/mobile run exposed a SQL Server deadlock on draft-line key ranges. The engine's system-health deadlock report confirmed the cause. Draft transactions now use read-committed isolation with update/hold locks on the parent draft, keeping header and line reads together. Imports retain serializable isolation. Transactions retry only confirmed SQL error 1205 (a rolled-back deadlock victim), at most twice; uncertain commit/connection failures are never retried.

## Reusable local setup

Requirements: Node 24, Python 3, OpenSSL and a working Docker daemon. Docker access is supplied in this cloud environment. Use the existing isolated checkout; no Git worktree is needed.

```bash
cd /workspace/EtalonOps
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run sql:prepare
npm run test:sql
ETALONOPS_AUTH_MODE=local ETALONOPS_DB_ENGINE=sqlserver npm run api
```

In another terminal, run `npm run dev`. The API is loopback-only on port 3001 and Vite on 5173. Use the application's `database=1` query parameter for database mode. Test identities remain explicitly local; this is not Microsoft sign-in.

```bash
npm run build
npm run build:preview
npm run test:server
npm run test:browser:sql
npm run sql:recovery-check
```

Browser tests use the separate `EtalonOpsSqlTests` database and ports 3002/5174. Run one Playwright invocation at a time. `npm test` still selects the SQLite-backed test API unless `ETALONOPS_TEST_DB_ENGINE=sqlserver` is supplied.

## Local security and retained state

The official Developer image is pinned to digest `sha256:cf8f0ab2ebe61feec2eed2629061a07d247f791c2a8ddda74a4ac9f06a291718`. It is licensed/configured for development, limited to 2 CPUs and 3 GiB, and publishes port 1433 only on loopback. The startup helper checks ownership labels before reusing containers/volumes and refuses to reset unknown state.

The helper creates a local CA and a localhost server certificate. Connections use encryption with `trustServerCertificate=false` and explicitly trust that CA; untrusted connections are tested to fail. Certificate/key and randomly generated local passwords stay under ignored `.runtime/sqlserver` or Docker volumes. They are not in Git, saved setup instructions or chat. The container serves TLS with non-root SQL Server user permissions; the setup helper's temporary root container only initializes its own labeled volumes.

Separate logins are used for migration/setup and runtime. The runtime login has DML grants on the application tables, insert/select access to audit events, no schema modification privileges and no audit deletion grant. These are local SQL authentication identities. Cloud runtime identity will use the approved managed-identity strategy after Azure authentication and deployment review.

Docker daemon state/volumes and live processes must not be assumed to survive environment snapshots. `sql:prepare` recreates or starts the owned local container, checks certificates, applies/checks migrations and grants, and verifies application connectivity. It never provisions Azure services. Do not delete/reset the developer data volume to make setup pass. The local CA expires after 365 days; the helper reports expiry rather than disabling verification.

## Remaining gates

Actual Entra registration/browser login, tenant tests, managed identity, Azure SQL deployment/recovery, live AI discovery and image administration remain pending. Local engine validation does not establish these capabilities. See [current retail pricing and proposed spending scope](COST_UPDATE.md).

Azure CLI is prepared locally for a provider-approved sign-in flow. Credentials must be entered only on Microsoft's secure sign-in page, never in chat. Read-only tenant/subscription inspection precedes resource creation. New paid resources, broad privilege changes and DNS still require the owner's explicit approval.

Azure CLI 2.91.0 and its pinned Python dependencies were installed and checked successfully. No existing default Azure profile was present, and `az account show` confirmed that sign-in is required. The helper `scripts/azure-readonly-login.sh` has been syntax-checked but has **not** authenticated: the current runtime proxy still rejects the sign-in/management/Graph hosts until the next network draft is applied. The helper stores its provider-managed cache in a private directory outside the checkout and performs no resource creation or role assignment.

The tested SQL setup/install steps and three additional destinations (`login.microsoftonline.com`, `management.azure.com`, `graph.microsoft.com`) have been saved together in a new environment draft, preserving the four working Microsoft domains and package-manager presets. Review/save and publish that draft to proceed to secure sign-in. This is a new sign-in prerequisite, not a failure of the now-working download policy. Credential caches must never be committed or published; no cloud credentials have been cached yet.
