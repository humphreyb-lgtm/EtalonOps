# Catalog relationship snapshot v1

Catalog administration now offers **Export catalog relationships**, alongside the existing active-material CSV export. The new download is `etalonops-catalog-snapshot.json` and is available only to an authenticated administrator for their tenant. The response is not cacheable.

The snapshot includes materials, aliases, canonical profiles, manufacturers, manufacturer products, translations, selection events, job restrictions, structured and legacy import batches, image references, and image association metadata. Inactive/rejected records and source/evidence fields are retained. IDs preserve relationships. Database JSON columns remain encoded strings and native SQL bits/dates may serialize differently from SQLite; consumers must use the versioned schema and normalize those types. Aliases are scoped through their owning material.

It excludes draft requests, memberships, authentication credentials and image bytes. It is a review/portability snapshot, not a database recovery backup, and cannot be fed directly into the staged CSV importer. Staged import still requires preview and administrator review. Approved image files and database recovery remain separate processes.

The initial pilot export is bounded to 10,000 total rows and 20 MB serialized JSON. An oversized snapshot fails explicitly rather than silently omitting records. The separate [streaming export](LARGE_CATALOG_EXPORT.md) handles larger catalogs without these whole-snapshot limits. The operation uses the repository transaction and records an audit event. SQL Server uses its repository's transaction isolation; this is not a point-in-time database backup during concurrent writes.

Verification covers tenant/role boundaries, preserved inactive translation provenance, manufacturer/product relationships, learned selections, pending image references, HTTP download/cache headers, and browser downloads on mobile and desktop against the existing admin workflow. No SQL schema, runtime grants or external service change is needed.
