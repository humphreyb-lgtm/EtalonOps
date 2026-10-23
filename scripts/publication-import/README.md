# Owner-run publication import

This source code prepares and runs a credential-free import package from the user-supplied R2 directory plus a current catalog snapshot. The generated data package is separate from application source. Do not commit snapshots, .runtime state, Azure access tokens, storage keys, owner identities, account data, or MRFs.

## Preparation

Run `npx tsx scripts/publication-import/prepare.ts EXTRACTED_R2 LIVE_SNAPSHOT OUTPUT`. This reads the 537 Reference Records and three 110-row Materials sheets, validates the known schema, constructs domain inputs, records protected existing-key signatures, and copies only explicitly mapped photo assets. The Hold workbook is never consumed. Compile run.ts using esbuild with platform=node, format=esm, packages=external. Include production package.json/package-lock.json, node-cloud.sh and run-import.sh.

## Execution

`bash run-import.sh` performs live preflight without changing catalog materials. `bash run-import.sh --apply --approve-images` confirms the prepared materials and representative images for publication. The script validates its own existing Azure owner/context and uses the existing repository/domain operations. This is an explicit owner-operated alternative to the admin upload page; it does not weaken anonymous API authentication or install a public import endpoint.

The apply command can install the bundled compatible application update into the existing application first. It never downgrades an unknown release. Data is written in protected, audited batches of 50. Images are normalized to WebP and content-checked before approval. Existing approved images are preserved. The retained image-association cap is checked before data changes. No external photo downloads, Azure AI, or Bing calls are made.

If interrupted, rerun the same command. It rechecks keys/physical identities, reuses committed materials and images, and does not blindly repeat INSERTs. In-progress unpublished batches may remain; reviewed publication is idempotent. A concurrent change to one of the protected existing keys requires a new export rather than an overwrite. New conflicts stop subsequent work; completed batches remain and are recorded in `.runtime/result.json`.

Blob and SQL work cannot form a single distributed transaction. A storage readiness probe occurs before material changes; later blob failures stop with a resumable report. Unreferenced content-addressed blob writes are harmless to catalog visibility. The script does not delete original material IDs, manufacturer relationships, submitted MRFs or historic revisions.

Tests: scripts/publication-import/*.test.ts, shared SQL publication scenario, and the private complete-data rehearsal. Source and assets remain provisional research: the runner validates consistency, not independent manufacturer availability or licensing.

Cloud Shell uses OAuth for blob access. If the owner lacks an inherited Storage Blob Data Contributor role, the wrapper creates a uniquely named temporary assignment limited to the existing catalog-images container and deletes only that assignment on exit. Existing assignments are preserved. Account keys remain disabled. Interrupted shells may leave a temporary assignment; the Azure assignment ID is scoped to the container and can be removed by its owner. The runner retries 403 responses briefly to allow RBAC propagation before any material changes.

## Strut package and v49.1

Use `prepare-strut.ts EXTRACTED_STRUT LIVE_EXPORT OUTPUT` for the corrected three-batch strut package. It includes 297 material records, 94 unique images and one excluded held scope record. Tenant IDs, catalog snapshots, users and settings are not included in the output. The wrapper installs the bundled CMS v49.1 maintenance update only over recognized compatible older releases, never an unknown/newer release. The retained image cap is 5,000 in this release.

`start-import.sh` launches the owner-run job with nohup. `status.sh` reports six material batches, image counts and final verification. Publication additionally holds a renewable 60-second blob lease; a dead process releases its lease by expiration. Progress reports are also stored privately at `import-reports/<packageHash>/result.json` in the existing catalog-images container. On rerun, completed records are rediscovered by physical identity, existing keys and approved images are preserved, and per-range batch entries are replaced rather than duplicated. No Azure credentials are packaged or printed.

## Search coverage / translations only

`prepare-search-coverage.ts EXTRACTED_COVERAGE ORIGINAL_MATERIAL_MANIFEST OUTPUT [FIXTURE]`
validates source coordinates/descriptions and builds an append-only package.
The CLI-only coverage parser accepts the larger static acceptance-test worksheet;
it does not change public workbook upload limits. Search-Rules.json is review
input, never evaluated as executable code.

`mode: translations-only` requires every material identity to exist. The runner
uses native reviewed translation imports with JSON-in-CSV to retain punctuation,
reuses existing active translations across origins, rejects disabled-phrase
reactivation, verifies all expected associations and checks protected data against
the private backup. It uses paged export rather than the small snapshot endpoint.

After building the application ZIP, run
`python scripts/publication-import/build-search-update.py PREPARED APP_ZIP OUTPUT_ZIP`.
The generated installer has a fixed archive checksum. Never package a live catalog
snapshot, `.runtime`, account/job data, tokens or credentials.

For v49.3 joining fittings, run `prepare-couplings.ts ORIGINAL_MATERIAL_MANIFEST OUTPUT`.
It generates an append-only manifest plus `Coupling-Search-Phrases.csv` for review.
Use `build-search-update.py PREPARED APP_ZIP OUTPUT_ZIP v49.3` for the versioned
archive; its installer directory derives from the output archive name and its
status counts derive from the manifest, rather than the older 297-record package.

For the v49.4 UI-only release, use
`build-search-update.py EMPTY_PREPARED_DIR APP_ZIP OUTPUT_ZIP v49.4 --app-only`.
This needs no catalog export or material manifest. The resulting archive excludes
material/phrase data, starts with `--apply --app-only`, and exits after exact-release
health verification, before any SQL catalog import or temporary storage access.
Its status report shows release and completion rather than material batch counters.
