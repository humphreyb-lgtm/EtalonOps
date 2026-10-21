# EtalonOps workbook population instructions for ChatGPT

Use the attached revised workbook as the source of truth. Treat its existing rows as the catalog baseline, not examples to replace.

When I say **Populate EtalonOps: [scope]**, research and append the requested generic materials to that workbook, following every rule below. Return an actual downloadable XLSX workbook. Do not replace the workbook with JSON, CSV or a narrative.

Before appending, compare the proposed physical configuration and ordering unit with existing rows. Reuse an existing material instead of adding another for a new spelling, description or image. Preserve all existing Material Keys, physical specifications and legitimate phrases. Existing rows may receive a representative Image URL and image-source notes; do not alter their specifications to fit a new item.

Start with a manageable batch of 100–150 new materials. Do not exceed 1,000 total material rows or 2,000 new review records (one material plus each phrase/image is a record). Use concise meaningful phrases rather than dozens of punctuation variations. If more batches are needed, carry forward all prior material keys and check previous batches for duplicate configurations.

If a source cannot be read, search for another accessible source. Do not fill gaps with guesses. Put unresolved configurations in a separate research report or a separate workbook copy marked proposed; exclude them from the import-ready workbook. Missing images may remain blank and must be listed in the report.

**Example request:** Populate EtalonOps: electrical PVC Schedule 40 and Schedule 80 conduit in 10-foot and 20-foot stock lengths, and standard male/female adapters and center-stop couplings. Add only commercially verified size/end configurations. Find representative images, preserve existing keys, and return the populated workbook with an unresolved-items report.


## Scope

Build a generic electrical construction materials catalog. Use only Materials for import data. Instructions and Family Reference are guidance only. Do not add manufacturer-product records, part numbers, supplier references or prices. Include representative generic image URLs.

## Existing keys — never overwrite

Keep every existing Material Key exactly as supplied, including RESEARCH- keys. Do not renumber, replace, shorten or reuse them. Existing keys identify updates, not new records. Existing catalog rows must be preserved unless a specific correction is requested.

## New materials

Append one row for each distinct, commercially supported physical configuration. Leave Material Key and Catalog Status blank. When copying an existing row to create a different size/configuration, CLEAR its key and status. Do not create separate rows for synonyms.

## Initial PVC scope

Start with Schedule 40/80 electrical PVC conduit, standard electrical PVC fittings, factory elbows/sweeps, boxes/bodies, duct-bank spacers and accessories. Exclude DB/EB duct, split conduit, ENT, liquidtight and specialty raceways, expansion/deflection couplings, flexible PVC couplings and 5-degree deflection duct couplings from this initial build. Missing specialized family definitions must be reported rather than invented.

## Family

Use an exact Family ID and Category from Family Reference. Do not invent family IDs or categories. Family Reference lists required field keys, types and a description pattern. Missing coverage should be reported for application extension.

## Required fields

Each new family row needs Family, Category, Unit, Type / Name, all family-required specifications, Configuration Status, Evidence URL and Notes. Description may be blank to use the application generated description.

## Type / Name

Use the canonical type in Family Reference for specific fitting families. Generic hardware/drill-bit/material, boxes, supports, caps and consumables may use a more precise physical type. Do not put a brand into Type / Name.

## One configuration per row

Different size, schedule, angle, actual radius, stock length, end configuration, material, finish, grade or box/spacer configuration means a distinct material where physically meaningful. Keep ordering unit separate from supplier packaging.

## Verify availability

Never generate a Cartesian product of every size, schedule, angle, radius and end type. Confirm each actual combination. For new family rows use confirmed only with evidence supporting the exact configuration and Notes locating it. Use proposed for unresolved rows; these are held out of import.

## No fabricated verification

Existing exported rows may say existing. Preserve that value; it is not a new verification claim. A reachable URL alone does not verify a configuration. Do not call a combination confirmed based on an image filename, assumption or another size.

## Evidence

Use a public HTTPS source URL and Notes with page/table/section and a concise description of the verified configuration. Manufacturer literature may be evidence without importing manufacturer identities. Do not manufacture citations or source claims.

## Required columns and extra fields

Use the matching dedicated column whenever present. Put remaining required family fields in Other Specifications, one key=value per line. Do not repeat a field in both places. Use exact field keys and consistent values.

## Numbers and dimensions

Dedicated inch columns accept decimals or fractions (1/2, 1 1/4, 1-1/4). Length accepts 10 ft. Other Specifications fields typed inches use inches; numeric fields contain numbers only. Store actual centerline radius, not outside radius.

## Compatible size sets

For spacers put compatibleSizesIn=2,3,4 (decimal inches, comma-separated). Use one row for one physical spacer fitting that set. Do not invent intermediate compatible sizes. horizontalSpacingIn and verticalSpacingIn mean center-to-center distance.

## Reducing fittings

End A is the larger trade size; End B is the smaller. Keep each connection associated with its end. A 3 x 2 reducer is distinct from a 3 x 1.5 reducer.

## Connections

Use consistent terms such as socket, male threaded and female threaded for end connections. End Connection describes conduit/bend configurations, e.g. bell end or plain end. If both ends differ, state the complete configuration consistently. Never equate male and female fittings.

## Bends

Use pvc-factory-bend for factory elbows and sweeps. angleDeg is numeric. radiusClass is standard, long radius or custom; radiusIn is the actual verified centerline radius. A standard elbow has a trade-size-specific radius. Do not guess it.

## Couplings and terminology

Center-stop and slip/repair couplings are different materials. Repair coupling means no center stop. Do not turn different physical configurations into aliases. Terminal/male adapter terminology must be checked before adding separate records.

## Description order

Use size, material, type, schedule if applicable, length or bend angle/radius, then connection and other defining details. Similar materials must follow the same pattern. Do not put evidence caveats, brands or supplier packaging in descriptions.

## Conduit description

1 in. PVC conduit, Schedule 40, 10 ft. length, bell end. Dedicated Length may contain 120 or 10 ft; both mean 120 inches. Use feet in the description for whole-foot stock lengths.

## Bend descriptions

1 in. PVC factory elbow, Schedule 40, 90°, standard radius, [verified radius] in. radius, bell end. Long sweep: 4 in. PVC sweep, Schedule 40, 90°, 36 in. radius, bell end. Replace brackets with evidence-backed values; never upload placeholders.

## Other description patterns

1 in. PVC female adapter, socket × female threaded. Reducing: 3 × 2 in. PVC reducing coupling, socket × socket. Boxes: PVC junction box, 8 × 8 × 4 in., cover, mounting, entries, rating. Follow Family Reference.

## Units

Supported: EA, FT, STICK, BOX, ROLL, PAIR. Hardware/fittings/elbows/boxes/spacers usually EA. Conduit may use EA or FT according to the requested workflow; preserve existing units. Supplier box counts do not change EA to BOX. CAN/BOTTLE are not currently supported; use EA with container volume.

## Search phrases

One phrase per line or semicolon separated. Include useful electrician abbreviations, alternate spelling, common wording and fractional/decimal equivalents. Every phrase belongs to its row/material. Do not enumerate punctuation-only variations unnecessarily. New material description is also added as a phrase.

## Search safety

Never make different sizes, schedules, radii, angles, reducer combinations or male/female connections synonyms. Broad phrases may find multiple choices. Do not claim interchangeability. Retain existing legitimate phrases.

## Updates

An existing key updates that same material after administrator preview confirmation. Blank cells preserve current values. [CLEAR] explicitly removes optional values; required fields cannot be cleared. Search phrases are additive; remove phrases in their editor.

## Physical corrections

Changing an existing material into a different physical item is not normal updating. Append a new row with blank key. Physical corrections to records with manufacturer links are held for reviewed correction; description edits preserve links.

## Generic images

Find a direct public HTTPS image URL for every material where possible. Reuse the SAME URL for the same representative visual type: straight PVC conduit can share a photo, and matching 90-degree sweep types can share a photo across sizes/radii. Do not use one universal image for every material.

## Distinct image types

Use separate representative photos for straight conduit, standard-radius elbows versus visibly different long-radius sweeps, bends of different angles, male adapters, female adapters, center-stop couplings, slip/repair couplings, reducers, box/body configurations and spacer configurations. Do not depict an incompatible connection or construction type. Physical specifications, not the photo, determine identity.

## Finding image URLs

Inspect source-page product galleries, actual image elements, lazy-load/srcset links, structured product image metadata or image search. Open the final candidate image URL to verify that it resolves to the intended photo. An image-search results page, product page, gallery page or PDF is NOT a direct image URL. Never invent a URL or infer correctness from a filename alone.

## Image review and evidence

Prefer a clear neutral product photo without branding, watermarks or dimension overlays. Manufacturer/distributor images can serve as representative references after checking appearance. In Notes include Image source: [page URL] and Representative image: [type / why shared]. Do not assert reuse permission or exact part identity without evidence. If a suitable image cannot be verified, leave Image URL blank and report it missing.

## Image publication

Put the direct URL in Image URL on EACH applicable row, including existing materials that need an image. The app stages new/replacement URL images for administrator publication review; it does not fetch them through AI. Uploaded images continue to take precedence for display. No uploaded image data is embedded into this workbook.

## Status and publication

Configuration Status controls research readiness. Catalog Status is exported information, not a publication command. New records enter unpublished review; the administrator decides publication. This workbook makes no AI or Bing requests in EtalonOps.

## Duplicate handling

Duplicate matching uses structured physical attributes and unit, not description alone. Use consistent names, numeric values and canonical type wording. Existing keys update, unchanged rows skip, duplicate configurations are reported, invalid rows must be fixed or removed before applying.

## File safety

Keep sheet names and column headers unchanged. Save .xlsx with values only; no formulas, macros, external workbook links, extra data columns or executable instructions. Only Materials is imported. Do not type example placeholder data into real rows.

## Batch limits

At most 1000 material rows, 3 MB, and 2000 new review records including phrases/images per batch. Aim for 100–150 new materials with a focused set of phrases. Return multiple workbook batches when necessary; keep keys unique across all batches.

## Chat deliverables

Return a downloadable populated .xlsx retaining all sheets and headers, plus a short report: existing rows retained, proposed new rows, confirmed rows, unresolved configurations and missing families. Do not output only a narrative or JSON. Do not import anything yourself.

## Starting catalog snapshot

The initial populated workbook reflects the user-provided catalog snapshot dated 2026-10-21, not a fresh authenticated query. Use Download current materials in the app for subsequent bulk updates.
