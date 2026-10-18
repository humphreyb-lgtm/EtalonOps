# Existing pilot update v10 — Excel-friendly catalog files

The catalog starter files now use ordinary spreadsheet columns instead of JSON cells. The starter kit includes a blank `.xlsx` workbook with category sheets, manufacturer products, translations and optional image references; a separate workbook contains fictional formatting examples. Identifiers and part numbers are formatted as text to preserve leading zeros.

Keep your master workbook as XLSX. Save each populated data sheet as **CSV UTF-8 (Comma delimited)** for import. Direct XLSX upload is not supported. The v10 importer accepts these flat columns and retains compatibility with previous `kind,data_json` batches. Empty rows are ignored; identity, provenance, evidence, relationship, size and explicit-review checks remain in force.

The workbook can be used immediately for preparation. Install this combined update before importing its column-format CSVs into the pilot:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v10.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Download the ZIP with **Download raw file** and upload it to the original authenticated Cloud Shell first. Preserve existing dependencies, data and `.runtime/azure-deployment.json`. All prior v9 and earlier changes are included. No new database migration, application dependency, service, subscription or paid AI activation is added. The health checker expects `excel-catalog-v10`.

Workbook regeneration uses `python3 scripts/build-catalog-workbook.py` with openpyxl, a development artifact-generation tool only; the application does not need Python or openpyxl. Prebuilt workbooks are included in the starter kit. Never load fictional examples as launch stock.

Live Azure installation and real Microsoft/recovery acceptance remain pending. See `docs/catalog-starter/README.md` for field and Excel editing instructions.

Verification: 69 backend tests, 38 SQL Server tests and nine deployment checks passed. The 65 existing browser checks passed; the two new column-format upload walkthroughs passed on phone and desktop after fixing the panel's next-file behavior, alongside the legacy structured-import walkthroughs. Native XLSX sheets, comments, filters and exact text-identifier save/reopen behavior were checked with openpyxl. The combined package built over v9 while preserving an existing runtime-state marker. Live Excel application rendering and Azure installation were not performed in this workspace.

The two new phone/desktop CSV upload walkthroughs also passed using the SQL Server repository.
