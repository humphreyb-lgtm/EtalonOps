# v49.2 — reviewed search coverage

Search changes are shared by Azure SQL and SQLite. They do not rewrite catalog
identity, descriptions, specification data, images, products, or saved MRFs.

- Symmetric fractions/decimals, dimension separators, inch/foot notation,
  contextual spoken sizes, plurals and controlled finish abbreviations.
- Generic Unistrut retrieval, with explicit brand-only requests requiring a linked
  manufacturer product. Channel-stock requests exclude accessories.
- Explicit dimensions, threads, gauge, coating, slot pattern, spring/retainer,
  conduit system, actual OD, cap fit, pad geometry and post orientation override
  even an exact learned phrase. Missing requirements remain marked for review.
- Broad searches return up to 200 options instead of silently stopping at 20.
  Existing ranking and job restrictions still apply.
- Incomplete/brand-specific requests have plain-language guidance.

## Owner-supplied strut package review

All three original workbook SHA-256 values and all 297 description/reference pairs
match the reviewed strut import. Proposed Material Keys were blank. The updater
resolves the current live Material Keys by canonical structured identity, refuses
missing/retired/ambiguous matches, and appends translations only. It refuses to
create materials or apply description/specification/image updates in this mode.
Existing translations remain intact. Repeated runs reuse existing phrases.

7,131 proposed phrase associations: 7,097 accepted; 34 withheld:
30 half-slot associations on six wide-oblong double-channel records, and four
PVC-material aliases for vinyl caps without a documented PVC-resin identity.
Two existing hard-cap aliases are retained but hardness remains unverified.

The 666-query acceptance suite has five documented corrections: broad cross-plate,
corner-plate, hinge and conduit-clamp queries include valid additional variants;
half-slotted searches exclude six wide-oblong double channels. The original
PVC-adapter no-match test is strut-fixture-only, not a global prohibition.

The regression fixture retains source coordinates and original translations.
The translation package contains no live catalog export, credentials, user/job
records, or images. Deployment and live reconciliation must run in the owner's
Cloud Shell; local tests do not certify the current live import has completed.

## Validation and installation

The full-catalog isolated rehearsal retained 1,169 active materials and verified
all 7,097 accepted associations. The resulting 10,349 translation records include
prior translations. A repeated first batch added zero phrases. Existing materials,
profiles, manufacturers, products, aliases and image records were unchanged.
The original source snapshot predates the owner's live strut import, so the actual
live keys/completion are checked again by the Cloud Shell installer.

Translation-only batches use the native reviewed JSON-in-CSV import; literal
semicolons and quotation marks remain inside their phrases. Disabled phrases are
held for review, rather than silently reactivated. Backups and checks use bounded,
tenant-scoped paged export. GUID cursor ordering is consistent across SQL Server
and SQLite, including previously imported uppercase GUIDs. Interactive snapshot
and workbook upload size limits remain unchanged.

The bundled updater installs the source-only app update, validates all existing
identities, and writes additive translations in resumable batches. It uses the
existing container lease and private progress reports. Temporary exact-IP SQL
access and scoped container OAuth access, when necessary, are removed on exit.
It makes no AI or Bing calls. It does not deploy or write live data until the
owner runs the provided Cloud Shell command.
