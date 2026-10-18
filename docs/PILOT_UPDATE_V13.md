# Pilot v13 — compact inline rows, fractions and imported images

Release marker: `compact-catalog-v13`. Update the existing app using the source-only ZIP and the existing update script. No new services, schema migrations, subscriptions or paid AI.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v13.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Workbook imports now use 56px form rows with directly editable primary fields and a compact More popover for additional fields. Save inline changes commits every edited row together as unpublished, using version checks to prevent lost updates. Any edit invalidates publication approval; publishing stays disabled until edits are saved. Selection, approval, deletion and saved imports retain the v12 lifecycle. Existing uploads remain available; no re-upload or data migration is needed. The rows remain compact on small screens using horizontal table scrolling. Saved imports collapse while an upload is open. Administration and MRF lists have reduced spacing.

Trade inch measurements display as exact fractions, including mixed fractions, without changing canonical numeric specifications, catalog identities or historical snapshots. Inline inch fields accept fractions when saved. Technical dimensions without an exact common fraction remain exact rather than being rounded. Catalog descriptions continue to be generated from defining specifications; their presentation uses fractions.

Imported image rows can be selected and published with products. Image usage responsibility is owner-managed, per the owner's explicit instruction; publication records that basis and preserves the imported note. Image URLs remain unpublished until the admin publishes them. Thumbnails are available to the administrator in the queue; published image links are available to catalog/MRF image components, scoped by tenant/material/manufacturer product. Uploaded approved image content still has priority. A manufacturer-specific result uses that product's image. Browser image requests use HTTPS and no referrer, and never receive Azure/API authorization tokens. The server does not fetch arbitrary remote URLs. Images remain hosted at their source URLs, so availability depends on the source host; this update does not copy images into Azure storage or introduce storage writes. A broken/unavailable URL can be edited in the unpublished row.

The earlier blanket hold on imported images is superseded by owner-managed publication. Do not falsely describe permission as independently verified. Pending, withdrawn or rejected references do not display until explicitly published by an administrator. Wrong or incomplete material specifications remain blocked independently of image permission handling.
