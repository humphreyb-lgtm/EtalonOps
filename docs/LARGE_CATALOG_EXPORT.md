# Large catalog export

**Export large catalog to file** is available to administrators in desktop browsers supporting direct file saving (currently Chrome/Edge). A native save dialog chooses the destination. Tokens remain in the Authorization header, not in URLs. The browser writes the authenticated response directly to a temporary file, then commits it only after a valid completion footer. Canceling the dialog does not start a download. Network errors, invalid records or a missing footer abort the write rather than accepting a partial export. The regular bounded JSON snapshot remains available on other browsers.

The server reads tenant-scoped cursor pages rather than constructing a whole snapshot in memory. Most pages have 250 records; import-batch pages contain one record because they include original CSV content. Composite legacy aliases use material ID plus normalized phrase as their cursor; SQL Server GUID ordering is tested against the actual engine. The HTTP stream respects socket backpressure and stops reading after disconnection. One export per account can run at a time; administrator checks and an allowlisted table schema apply to every page. No additional runtime grants or migrations are required.

The `.jsonl` file starts with a versioned manifest, contains one table-tagged record per line, and ends with counts and a SHA-256 digest. The digest covers the exact UTF-8 bytes of the manifest and record lines, including newlines, excluding the completion footer. A successful footer is mandatory. To verify counts, tenant scope and the full checksum without loading the file into memory:

```bash
python3 scripts/verify-catalog-export.py /path/to/etalonops-catalog-stream.jsonl
```

The browser checks format, record counts, tenant scope and completion while streaming; the offline script additionally verifies SHA-256. Its line reader rejects records over 8 MB. Image associations and source/rights metadata are included; image bytes are not. Drafts, memberships and credentials are excluded. Inactive records and original catalog import files remain included.

This is a portable review export and uses paged reads. Concurrent catalog changes can be reflected differently across pages/tables; it is not a point-in-time database backup or a directly importable CSV dataset. Use database/blob recovery procedures for recovery. Neither this feature nor its tests activates paid AI or creates Azure resources.

The export regression dataset includes 10,001 translations, beyond the small snapshot's record cap. Tests verify all records arrive, validate the checksum independently, reject tampering, deny overlapping exports for one account, and recover after a failed export. Browser tests use a file-writer substitute to verify successful commit, abort on truncation, and save-dialog cancellation; they do not claim to test operating-system file permissions.
