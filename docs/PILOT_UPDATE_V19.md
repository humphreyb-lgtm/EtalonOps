# Catalog details and direct-page controls — v19

Release: `catalog-details-v19`. This updates the existing app and adds one product-details JSON column using migration 008. No new Azure resource or paid test is created. Existing AI settings and saved research are preserved.

## Install

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v19.zip" -d "$HOME/etalonops-westus3" &&
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Existing web discovery activation remains valid; no API-key setup is needed again. If Cloud Shell lost its runtime settings, use the existing workspace recovery first. Success output and `/api/health` now identify `catalog-details-v19` distinctly.

## Reuse the saved CANTEX research without a paid call

1. Refresh EtalonOps → Administration → Product research.
2. Reopen the saved CANTEX A52BA12 research from the dropdown. Its recorded cost is the historical request cost, not a new charge.
3. Check catalog for duplicates. Packaging, nominal trade-size display and descriptive specification observations no longer redefine conduit identity. Actual dimensions, length, schedule, end connection and meaningful construction differences remain defining. Existing material profiles are compared compatibly without rewriting their stored observations or changing historical MRFs. Conflicting manufacturer/part mappings still stop publication.
4. Expand Product observations. Packaging quantity/weight values remain unverified observations with their original labels; no conversion, per-stick assumption or guessed packaging unit is applied. Review/correct them before publication.
5. Click Find page images (no AI charge). This reads up to two saved manufacturer-page sources; it does not invoke a model or Bing. Choose an observed representative image and review its preview. A page image can be shared across sizes; selection does not claim unique SKU photography. Blocked pages may still require manual image upload through the existing image administration.
6. Select the product and save unpublished. Review the resulting material, product, phrases and image records in Workbook imports before publishing.

Additional observations are stored on manufacturer products, separately from generic material identity, and appear in linked manufacturer-product details and catalog exports. Repeated imports can enrich missing detail fields on an existing part. Different values for an already stored product detail require review; they are not silently overwritten. All AI-origin records remain provisional.

Saved v18 research is normalized on reading/staging; no model rerun is needed to separate its observations. Potential translations and original source evidence remain retained. Unsaved edits still need saving to the unpublished queue before closing Administration.

## Direct-link research and cost

The exact manufacturer page and accessible linked documents are tried first. For supplied links, paid discovery fallback is **off by default**. Enable the explicit checkbox only when desired. Without fallback, an unreadable supplied page returns its source-loading reason before any paid AI/Bing reservation, while incomplete readable products remain reviewable. Manufacturer/part-only requests continue to use discovery automatically.

Source loading now supports standard gzip, deflate and Brotli HTTP content encodings within existing extracted size limits, alongside HTML/XHTML and searchable PDFs. HTTP/content-type/encoding errors are reported; this does not bypass a site's login requirements or access controls. Access to nVent from the Codex environment was denied by its network proxy, so live Azure reachability has not been verified here. A supplied page that requires browser rendering or blocks server requests can remain unavailable.

A readable supplied page may yield zero Bing requests while still incurring model extraction cost. Sources, missing details and actual usage must be assessed per live test. Failed discovery that returned known usage now includes its completed-cost estimate and Bing count in the source-access error. Unknown/failed API usage retains the conservative budget reservation.

The older prepared-JSON workflow is collapsed under Import prepared research (optional). It remains available without occupying the main research page.
