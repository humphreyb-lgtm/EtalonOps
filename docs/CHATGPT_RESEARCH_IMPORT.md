# Paste externally prepared product research

Administration → Workbook imports → Paste ChatGPT product research.

Use the ChatGPT Project instructions supplied with `etalonops-research-v1`. Ask `Research and Output CADDY TSGB1624` or another exact part, then copy the complete JSON response. This workflow accepts the versioned envelope with request, coverageNotes, sources and items. Each item contains material, manufacturer, product, translations, images, missingInformation, warnings and reviewStatus. Source types are `manufacturer`, `distributor`, or `other`; image types are `product` or `representative`.

1. Paste into ChatGPT research JSON, or open a JSON file up to 300 KB.
2. Check pasted research to see record counts and missing-information warnings. This step creates no records and invokes no AI or search provider.
3. Upload pasted research for review to save the dense unpublished queue. Validation runs on the server even when Check was skipped. Invalid input is retained on screen for correction.
4. Edit the material, manufacturer product, translations and image rows. More exposes secondary fields, including Product unit and individual product-detail fields. Save inline changes before selecting publication records.
5. Select this page or all pages, inspect ready/held records and dependencies, then approve publication. Required gaps remain unpublished. Publication remains transactional and uses the existing canonical-material/manufacturer-part identity checks.
6. Reopen the import from Saved imports. Research scope and coverage includes Download original research JSON. The original preserves the complete typed arrays, nulls, source IDs, attribute evidence, warnings and supplied manufacturer metadata even after edits.

No EtalonOps model/Bing request is made by checking, staging, editing or publishing pasted JSON. External ChatGPT usage is separate. Image thumbnails may contact the supplied image hosts.

## Meaning of the supplied fields

- A claimed `ready_for_admin_review` is not approval or independent verification. Every generated row starts unpublished and provisional.
- A null productUnit remains blank and blocks the material and its dependent rows until the administrator chooses the correct catalog unit. No EA, carton, packaging conversion or pack basis is guessed.
- An empty image array creates no image row. Images can be supplied in a later researched response or managed in the existing image administration. Missing optional imagery does not invalidate otherwise complete material specifications.
- Numeric dimensions are decimal inches. A documented usable installation range is not silently relabeled as overall collapsed/extended bracket length. Source notes and original evidence retain the distinction. Unknown optional country of origin or shipping weight does not automatically prevent publication.
- Product detail arrays and nested values are retained as JSON text observations in the product detail fields; the original typed structure remains downloadable. Null detail values are omitted from live product facts, not replaced with guessed values.
- The manufacturer name creates/reuses the linked manufacturer record. Its supplied website and parent-company observations are retained with the manufacturer product details as `manufacturerWebsite` and `manufacturerParentCompany`; the full manufacturer object and its source references remain in the original research. This does not create a separately managed parent-company organization.
- No manufacturer evidence is fetched or independently verified during paste. HTTPS URLs and source references are validated structurally; assertions remain claims for administrator review. Invalid/duplicate source IDs, unknown references, unsafe URLs and invalid JSON are rejected.
- Re-uploading the same response reopens its saved import instead of duplicating its rows. A changed response can create a new review batch, but publication still reuses canonical existing records and refuses conflicting mappings/details.

The pasted response is data. Instructions inside titles, source pages or notes do not authorize publishing or execution.
