# Local database and translator milestone

**Update:** the publication/access blocker below was subsequently resolved. SQL Server schema, repository, TLS, permissions, browser integration and recovery have now been validated locally; see [SQL Server milestone](SQL_SERVER_MILESTONE.md). The SQLite results and original blocker details below are retained as milestone history.

The owner approved the desktop/mobile screenshots and authorized implementation of persistence and the translator. The approved layout is retained. Azure provisioning, financial commitments and DNS remain unapproved.

## What runs now

Node 24 runs a loopback-only Express API and an on-disk SQLite development database. The browser can use the API by adding `?database=1` to the local development application's address. The default app and downloaded HTML remain standalone visual previews with browser storage. The database mode explicitly labels its engine, test identity and scripted AI. It is not a production Microsoft-authenticated application.

```bash
cd /workspace/EtalonOps
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
ETALONOPS_AUTH_MODE=local npm run api
```

Run `npm run dev` in a second terminal. API: port 3001; frontend: port 5173. Both bind to loopback. No public preview or tunnel is created. Local test identities are `foreman-one`, `foreman-two` and `admin`; choose an identity with the `identity` query parameter alongside `database=1`. The local session endpoint grants only these predefined test identities and is absent in Entra mode. Never expose local test sign-in to the Internet.

The API issues signed, expiring test tokens held only in browser memory. The server derives tenant, owner and role from the validated token, checks project membership, and includes tenant/owner predicates on draft reads and writes. A guessed foreign draft identifier returns 404, including for an administrator. The client cannot supply an owner field. Optimistic versions reject stale saves with 409 while retaining on-screen work. All draft-line writes are transactional with their header and audit event.

Entra JWT validation scaffolding uses a fixed tenant authority, API audience, RS256 signature verification, expiry, API scope and assigned application roles. The local launcher refuses to start unless its local mode is explicit. Actual tenant registration, Microsoft browser login, claims from real test accounts, managed identity and Azure authorization are **not configured or validated**.

## Data and units

The database stores versioned drafts, ordered lines, original input, requested quantity/UOM, catalog snapshots, source flags, delivery inheritance versus override, project membership and audit events. Decimal quantities remain strings across JSON and SQLite boundaries; validation permits at most 12 whole and 6 fractional digits. No feet/stick/box conversion is performed. A catalog candidate's unit is stored separately from the requested unit. No selected item or fallback creates a verified translation.

The local bootstrap imports only four explicitly fictional fixtures through the review/import code path, in a separate `fixture` dataset class. Reviewed records remain distinct; importing fixtures is forbidden through the Entra-mode apply route. No 150–250-item production seed has been invented or imported. Real catalog records require administrator review and evidence.

Search checks active, same-tenant records first, using normalized aliases and descriptions. Exact aliases rank ahead of all-term matches and bounded one-edit spelling corrections. Numeric sizes are constraints, not fuzzy text; `2 inch PVC` cannot silently become `1 inch PVC`. Electrician shorthand includes reviewed fixture aliases for PVC and electrical tape. `self tappers` remains a genuine catalog miss in the fixture database. Search results include match reasons, provenance and fixture/reviewed status. This is deterministic local search, not a claim of live AI discovery.

Migration `db/migrations/001-local.sql` is applied once, transactionally, with checksum drift detection. Database files, journals, exports and backups are kept under ignored `.runtime/`, with a restrictive process umask and database mode 0600. There are no credentials in the repository or database configuration.

## Import/export contract v1

The exact UTF-8 CSV header is:

```text
schema_version,external_key,description,aliases_json,requested_uom,product_uom,manufacturer,manufacturer_part_number,specifications_json,conversion_basis_json,source_url,verification_basis,dataset_kind
```

The API accepts at most 1,000 records per batch, with bounded field/body sizes. JSON array fields must parse and contain valid strings. Conversion basis must be JSON `null` in v1; extending conversions requires its own reviewed contract. Reviewed records require an HTTPS evidence URL and a verification basis. Missing manufacturer/part number stays blank. Image approval is not part of a translation import.

An admin previews the file to get row-level validation and conflict reports. Preview does not populate the catalog. Duplicate keys, active alias conflicts, invalid units, malformed fields and unsupported conversions prevent apply. Apply requires the exact confirmation `I reviewed this batch` and rechecks conflicts inside its transaction. A tenant-scoped file hash makes repeat apply a no-op. Existing catalog keys are never silently overwritten. CSV export escapes cells beginning with formula characters, leading whitespace or apostrophes with a reversible leading apostrophe convention.

Rollback deactivates the batch's records rather than destroying history. Previously saved MRF snapshots remain readable and editable; new lines cannot use inactive catalog records. A rolled-back batch cannot be implicitly reapproved or reapplied. Correction/replacement requires a new reviewed process.

Local developer tools (not production authentication):

```bash
ETALONOPS_AUTH_MODE=local npm run catalog -- preview path/to/catalog.csv
ETALONOPS_AUTH_MODE=local npm run catalog -- apply BATCH_ID --reviewed
ETALONOPS_AUTH_MODE=local npm run catalog -- rollback BATCH_ID --confirm-deactivate
ETALONOPS_AUTH_MODE=local npm run catalog -- export .runtime/new-export.csv
ETALONOPS_AUTH_MODE=local npm run db:backup -- .runtime/new-backup.sqlite
```

Export and backup refuse to overwrite an existing file. Backup uses SQLite's consistent backup API rather than copying a live WAL database, then opens the backup and runs an integrity check. To inspect/restore a backup, stop only your local API and start it with `ETALONOPS_DB_PATH` pointing to a verified backup copy; preserve the original file first. This is a local recovery workflow, not an Azure SQL recovery drill.

Admin HTTP endpoints are `/api/admin/imports/preview`, `/api/admin/imports/:id/apply`, `/api/admin/imports/:id/rollback`, `/api/admin/catalog.csv` and `/api/admin/memberships`. Every route performs server-side role checks. Foremen cannot approve imports or assign project members. Image-association schema is reserved for the later image-review milestone; no image approval UI/API is claimed here.

## Validation

Verified in this instance: **6 backend test groups and 27 browser tests passed, with no failed or skipped tests**; strict TypeScript/production and standalone-preview builds passed; `npm audit` reported zero known vulnerabilities. Local catalog preview/export and consistent-backup CLI commands were executed successfully. These results apply to the local engines and test identities described below, not to Azure SQL or real Entra authentication.

`npm run test:server` tests the actual SQLite engine and HTTP boundaries: tenant/owner isolation, forged tokens, admin denial, invalid input, candidate provenance validation, stale-save protection, unit preservation, import dry-run/idempotency/conflicts/rollback, formula escaping, membership denial, process/store restart and historical references after rollback. An Entra-mode negative test checks that local session creation is unavailable; it is not a real Entra login test.

`npm test` starts isolated API/frontend test services on ports 3002/5174 and uses `.runtime/playwright.sqlite`, leaving the developer database separate. Browser tests exercise database-backed draft save/resume in a new browser context at 1440 and 390 px, preserve date overrides/original input, and verify foreign-owner reads fail. Existing responsive, keyboard, touch, native 200% zoom and accessibility tests remain in the suite. Run only one Playwright invocation at a time.

## Explicit Azure SQL blocker

The official `mcr.microsoft.com/mssql/server:2022-latest` manifest is reachable, but artifact downloads redirect to **centralus.data.mcr.microsoft.com**, which the execution proxy rejects with HTTP 403. No signature/TLS/checksum verification was disabled, and the incomplete image is not used.

`db/001-azure-sql.sql` contains a separate proposed SQL Server/Azure SQL schema. It has **not** been executed against that engine. A SQL Server repository adapter, engine-specific migration tests, least-privilege migration/application identities, managed identity, real Entra sign-in and cloud recovery testing remain outstanding. SQLite tests are not evidence that the Azure SQL deployment works. The local database is not a silent replacement for the approved cloud architecture.

Before a cloud deployment, regain access to Microsoft's artifact/pricing/documentation hosts, verify the current region/SKU rates and complete the approved security model. Paid provisioning still requires a concrete verified quote and express spending approval. DNS remains a separate later approval. No existing production system has been changed.

The setup/start scripts and these four custom network additions were saved successfully in the environment configuration draft: `centralus.data.mcr.microsoft.com`, `prices.azure.com`, `azure.microsoft.com`, and `learn.microsoft.com`. Existing package-manager presets were preserved. Saving the draft does not apply runtime networking or publish a filesystem snapshot. Review/save the draft in environment settings, then publish the environment; after the relevant runtime update, retry the blocked operation. Fresh-task restoration and Azure deployment have not been validated.

Local limitation: this POC currently resumes one working draft per project/test owner. A saved-request list or multiple concurrent requests per project is not implemented. The downloaded single-file preview continues to use browser storage; it cannot start the Node API or database by itself.
