# EtalonOps — electrical strut research and workbook handoff

Use the attached EtalonOps-Strut-Catalog-Research-Starter.xlsx. Research the 254 candidates in Research Scope and return populated, downloadable XLSX import batches. This is a generic MATERIAL catalog, not a manufacturer-product or supplier-price catalog. The scope is a research checklist, not evidence of commercial availability. Do not import or publish anything yourself.

## Deliverables

1. One or more actual XLSX files with a worksheet named Materials using the exact 34 supplied column headers, in order. Put only complete, evidence-supported new materials there. Other supplied worksheets are research/reference guidance and are not imported.
2. An updated research workbook tracking every Source Scope ID as completed, duplicate, not available, or unresolved, including a reason and the corresponding output description/batch. One scope candidate may yield zero, one or several actual materials. Nine accessory/support entries are family-level placeholders requiring enumeration; do not import a family as one unspecified part.
3. A short reconciliation and image report: candidates reviewed, unique ready materials, duplicates consolidated, unresolved candidates, image coverage, and batch names. Do not claim readiness from row counts alone.

Begin with 50–100 confirmed materials per batch. Each batch must stay below 1,000 material rows, 3 MB and 2,000 generated review records (each material, search phrase and image may contribute). Use 4–6 useful phrases per material rather than punctuation variations. Do not fill the upload workbook with unresolved research. Preserve blank Materials when nothing is ready.

## Exact application contract — use these supported values

- Strut channel, fittings, clamps, post bases, caps and support accessories: Category = general; Material Family = generic-material.
- Channel nuts and square plate washers: Category = hardware-fasteners; Material Family = generic-hardware.
- These are actual existing category/family IDs. Do not invent strut-* family IDs, unistrut categories, or hardware_fasteners with an underscore. The bracket category has unrelated required span fields; do not use it for strut fittings.
- Every ready row needs Description *, Category *, Material Family, Unit *, Type / Name *, Defining Specifications, Evidence URL, Notes, and Configuration Status = confirmed, plus the relevant physical fields. Leave Catalog Status blank.
- Every NEW Material Key stays blank. STR-0001 etc. are scope tracking IDs, NOT catalog keys. Put Source scope: STR-0001 in Notes and the scope tracker. If an actual existing Material Key is later supplied in a catalog baseline, preserve it exactly; never replace it with a scope ID or renumber it.
- Only Materials is imported. Do not emit JSON etalonops-catalog-v2 for this task. Do not add columns, formulas, macros, external workbook links, merged header cells or multiple header rows to Materials.

## Research scope and order

Review core channel first, then angle/connector fittings and post bases, then nuts/washers, then clamps/caps. Leave the nine additional accessory families until the core is reconciled. The submitted matrix proposes combinations of profiles, patterns, finishes and lengths; confirm each combination rather than asserting the entire Cartesian product exists. Keep candidates unsupported by exact catalog tables on Research Gaps. Similar products from different makers do not establish identical compatibility.

Use direct manufacturer catalogs and electrical supply-house pages, then their linked PDFs. Start with the reference clues supplied in Research References; clues and ticket descriptions are not verified specifications. Useful manufacturer sources include Unistrut/Atkore, Power-Strut, Eaton B-Line and ABB/Superstrut where applicable. Useful supplier sources include NEFCO, Graybar, Rexel/Gexpro, City Electric Supply, Gordon Electric, Elliott Electric, Platt, Border States, Crescent Electric and White Cap. Build and reuse a small source directory per family. Reuse verified tables instead of searching independently for every size. General web search is a fallback; this handoff requires no Azure AI/Bing API calls.

Open and read the supporting page/PDF. In Notes identify the catalog/page/table/row and what was confirmed. Evidence URL must be a public HTTPS page or PDF, not an image search results URL. If access is blocked, use another accessible source or mark unresolved. Do not invent source claims, URLs, load ratings, certifications, gauges, dimensions or compatibility.

## Physical identity and units

A material means one physical, orderable configuration. Different channel depth/width, construction, gauge, slot pattern, stock length, finish, nut thread/spring, fitting geometry/hole pattern, profile compatibility or clamp conduit fit can require distinct materials. Different brands, supplier stock codes, photographs and spelling do not.

Channel is STICK for this scope. A 10 ft stick and a 20 ft stick are separate rows; Length (in or ft) holds 120 / 240 or 10 ft / 20 ft. Accessories, fittings, nuts, washers and complete clamp assemblies are EA even when sold in boxes of 25 or 100. Do not convert EA to BOX or use package counts as requested quantities. A two-piece clamp sold as one assembly is one EA, not two EA; verify what the assembly includes. If a different ordering unit is later requested, ask before changing the established unit.

Do not use the Trade Size (in) column for a channel's depth. For channel use Width (in) and Depth (in), Length (in or ft), Material and Finish; put construction, gauge, pattern and required slot dimensions in Other Specifications. For nuts use threadSize, threadPitch and springType in Other Specifications. For conduit clamps, Trade Size (in) may identify conduit trade size; record conduit system and actual OD fit separately. See Strut Rules and Field Map.

Use dedicated columns where available. Other Specifications has one camelCase key=value per line, no JSON, no repeated dedicated fields and no manufacturer/brand/vendor/partNumber/source/image/research identifiers. Up to 25 total attributes are allowed, so keep extra attributes focused on physical distinctions. Extra inch dimensions should use decimal inches consistently; ordinary extra fields have text semantics unless defined otherwise by the app. Do not place notes, optional product marketing, shipping weight, ticket clues or research status among physical attributes. Keep canonical physical wording identical across batches so deduplication does not depend on prose variations.

For generic families, Defining Specifications and the other physical attributes participate in duplicate identity. Use one stable concise specification pattern per type. Do not add source-specific commentary to that text. Preserve existing descriptions/physical data unless an explicit correction is authorized; a different physical item gets a new blank-key row. Deduplicate across this batch, previous batches, and any supplied current catalog baseline before export.

## Type-specific checks

Channel: research actual width AND depth (7/8 in. shallow is depth, not conduit trade size); solid/slotted/half-slotted are distinct. Verify steel gauge or wall thickness; 12 ga is a preference, not a fact. Single and back-to-back/double constructions are not interchangeable. Do not infer combined dimensions or treat double channel as two single sticks. Slot dimensions/pitch must distinguish genuinely different patterns where meaningful.

Finishes: pre-galvanized, hot-dip galvanized, electro-galvanized, zinc plated, and documented green paint/epoxy systems are distinct. Green color alone does not prove epoxy. Do not default every steel fitting to the same finish. Do not expand to stainless, seismic, solar or specialty industrial systems without a separate request.

Angles/plates/connectors: record actual angle, inside/outside orientation, geometry, hole count and the dimensions/spacing/bolt-hole size that distinguish variants. A four-hole plate is not automatically a four-hole angle or clevis. Keep adjustable/swivel and fixed geometries separate.

Post bases: verify channel profile and construction, centered/offset/flush arrangement, base plate size and anchor/channel hole pattern. Descriptive scope labels and reference part numbers are insufficient by themselves.

Nuts: thread diameter AND pitch are required (1/2-13, not merely 1/2 in.). Standard, short, long, springless and plastic-retainer types are distinct. Verify compatible channel depth/profile rather than assuming any 1-5/8-width channel accepts all springs. One nut explicitly compatible with several profiles remains one material with that supported compatibility set, not multiple duplicate nuts.

Clamps: EMT, rigid/IMC and documented universal clamps are distinct. Verify trade size versus actual OD/range and channel interface, assembly and included fastener requirements. An EMT 1 in. claim does not establish 1 in. rigid fit. Do not generate every 1/2–6 in. size for every clamp type without evidence.

Washers/caps/supports: record bolt-hole or thread fit separately from outside dimensions; verify washer thickness when it distinguishes the item. End closures and exposed-edge safety caps are different. Verify single/double/shallow profile fit. Research load ratings only when available or a required distinction; do not hold an otherwise complete generic item merely for an optional shipping weight or country of origin. Never invent structural interchangeability or a load rating.

## Consistent descriptions

Use dimensions/thread first, then generic material/type, construction/pattern, angle/holes/fit as relevant, length, finish. No brands, catalog codes, package counts, warnings or source citations in the generic description. Templates (replace ALL placeholders with verified values; these are not ready rows):

- [width] × [depth] in. steel strut channel, [gauge] ga, [slot pattern], [single/back-to-back], [length] ft. length, [finish].
- [angle]° steel strut angle fitting, [inside/outside], [holes]-hole, [defining dimensions], [finish].
- Steel strut flat T plate, [holes]-hole, [defining dimensions], [finish].
- [thread] strut channel nut, [spring type], [documented profile fit], [material/finish].
- [trade size] in. [EMT/rigid/IMC/documented universal] strut conduit clamp, [documented channel fit], [finish].
- [bolt-hole size] in. square strut washer, [width] × [height] × [thickness] in., [finish].

Do not use a manufacturer's series as a generic type. “Unistrut” may be useful as a common search phrase when clearly generic trade wording, not a claim that a manufacturer product or proprietary system was verified.

## Search phrases and compatibility

Include useful electrician wording and abbreviations with identifying size/profile/finish where relevant: strut, channel, shallow strut, deep strut, spring nut/channel nut, standard/short/long spring, angle bracket, flat T plate, end cap, strut strap. Put one phrase per line. Do not make different depths, thread pitches, spring types, hole patterns or conduit systems synonyms. Broad phrases can legitimately return multiple candidates; do not assert exact equivalence. Brand/reference part identifiers belong only in the separate research references, not generic material translations.

## Representative photos — part of the research task

Find and verify a direct public HTTPS image URL for each visual type. Put the URL on EVERY ready row to which it applies. It may be shared across sizes when it represents the same shape/construction; do not reuse one universal strut image across fittings. Separate solid/slotted/half-slot channel, shallow/deep/back-to-back profiles, nut spring variants, L/T/cross/clevis/plate shapes, post-base arrangements, clamp types and caps. Prefer an image without irrelevant branding or misleading dimensions; a visible finish should reasonably represent the row.

Inspect page image/gallery elements, srcset/lazy-load URLs, structured product image metadata and linked media; use image search only as a fallback. Open the final image, verify that it shows the intended type, and record Image source: [page URL] and Representative image: [group/type] in Notes and Image Register. A PDF/product page/search-results URL is NOT a direct image URL. Do not infer correctness from a filename. Preserve any existing approved uploaded image. Do not assert image ownership/reproduction permission or exact manufacturer-part identity without evidence.

If a verified direct URL cannot be obtained but an image can be legitimately retrieved for owner review, return the local image files separately with Image Register mappings; do not put local paths in Image URL. Missing photos do not silently become complete: list every missing group and affected scope IDs. Do not invent URLs or insert a mismatched photo to satisfy a completeness count. Specifications must be supported independently of the representative photo.

## Final checks before delivering

Materials contains only confirmed, supported configurations; all NEW keys/statuses blank; exact headers and supported family/category IDs; no manufacturer/product import fields; required type/specification/unit/evidence/notes present; dimensions and units coherent; no duplicate configurations or repeated attributes; meaningful safe phrases; image URLs verified with page provenance or explicitly listed gaps; every scope ID reconciled; all unresolved candidates excluded from Materials. Return real XLSX files, not only a narrative.
