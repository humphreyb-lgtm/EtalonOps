# Existing pilot update v3

This source-only package supersedes update v2 and includes all its session, draft, catalog, import, image metadata and restriction editor changes. Apply v3 directly to the original West US 3 directory after the SQL identity v2 repair; there is no need to apply application update v2 first.

New in v3:

- Direct-to-disk large catalog export in supported desktop browsers, with bounded cursor reads, an integrity footer, per-account concurrency protection and interrupted-file abort handling.
- Offline streaming checksum verifier: `scripts/verify-catalog-export.py`.
- Search relationship grouping to avoid repeated per-material scans, preserving ambiguity, usage priority, exact brand/part constraints and job rules. Database search still reads tenant catalog data; full-text indexing remains a future scale decision.
- Photos load near the viewport instead of requesting every image in a long MRF; existing request limits remain unchanged.
- Scoped/focused restriction history so rules just saved remain easy to find beyond the first page.

Download and upload `EtalonOps-pilot-update-v3.zip`, then run in the authenticated owner Cloud Shell:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v3.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

The runner updates only the existing app and preserves `.runtime`, database contents and image files. No services, migrations, extra grants, plan changes or paid AI activation are introduced. The regular small JSON export is retained where direct file saving is unavailable. See [large export behavior](LARGE_CATALOG_EXPORT.md) and [the v2 acceptance checklist](PILOT_UPDATE_V2.md). Live Entra/Blob/cloud recovery acceptance remains separate from local automated checks.

Validation: production/type build, 45 backend tests, 25 SQL Server tests, 47 browser tests, and nine deployment checks passed. The export regression exceeds 10,000 translations. The photo regression displays 80 MRF lines and verifies offscreen rows do not immediately request their images. Native OS file-picker permissions and live Azure behavior still require deployed acceptance.
