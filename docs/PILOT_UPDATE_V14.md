# Pilot v14 — select a page or every filtered page

Release: `bulk-selection-v14`. No schema, resource, dependency or cost changes. Saved unpublished imports remain intact.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v14.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Administration → Workbook imports offers Select this page, Select all pages, and the existing Select valid filtered records option. The table header checkbox selects/clears the current page and shows partial selection. All-pages selection spans every page matching the active type/status/text filters, including invalid unpublished rows so they can be deleted. Published and deleted rows are excluded. Current selections outside the filter are retained until explicitly cleared. Changing selection clears approval and deletion confirmation. Publication still requires explicit approval and valid records; deletion still requires confirmation. Neither bulk-select action publishes or deletes data by itself.

Search grouping is unchanged: each canonical material is one result, with manufacturer/part choices inside that row. Eight equivalent manufacturers do not produce eight material rows. Length, end connection and other meaningful physical specification differences can produce separate rows. Manufacturer queries and active job restrictions narrow available manufacturer choices.
