# Pilot v15 — bulk publication and exact-product entry

Release: `publication-entry-v15`. Existing uploads, drafts and catalog records remain intact. No new infrastructure, dependencies, schema changes or paid AI.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v15.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Workbook review now checks a publication plan. Ready selected rows can publish while invalid rows stay unpublished with reasons. Required parent materials/products outside the selected page are listed and included in approval. The server rechecks the plan before atomic publication. Page and all-pages deletion remove only selected unpublished rows; published catalog records remain intact.

Allow Changes is checked by default beside Find Matches. Unchecking defaults results to No Substitutions. Each match and Use My Description offers its own No Substitutions checkbox. Select a linked manufacturer/part, or enter both values for an unmatched description. Exact requests cannot be added without both values. The MRF description turns red and retains its textual No Substitutions label and saved purchasing requirement.

After deployment, open the existing import, select a page or all pages, inspect ready/held/required counts, approve and publish. Test deletion on unwanted unpublished rows only. In a new MRF, uncheck Allow Changes, choose a manufacturer product and add it; confirm red description and save/reload persistence. Manual descriptions require manufacturer and part number when No Substitutions is selected.
