# Catalog administration workflow improvements

The cloud pilot now presents the structured catalog workflow directly; the old fixture-only CSV importer is hidden in cloud mode. Local regression/demo mode retains that importer.

## Browse, review and paginate

Administrators can browse active materials without first knowing a matching phrase. Description/key filtering treats wildcard characters literally. An explicit option includes inactive materials. The selected material displays defining specifications, product unit, source evidence, review basis, record origin, active status and verification status. All active linked manufacturer products show their part numbers, titles, source URLs and verification status before independent review.

Material browsing, translation provenance, job restriction history, imported image references and structured batch history use tenant-scoped database pages (25 rows in the UI, at most 100 per API request). Page order has a stable ID tie-breaker. Oversized page requests fail validation; a page beyond the end resolves to the last available page. Read/write ownership and administrator requirements remain enforced on the server. The old overview operation is retained for compatibility, while these UI paths use the bounded page operation. Search ranking still needs separate indexing work at larger launch volumes.

## Structured batch review and resume

Structured import previews show records with labeled specifications, keys, manufacturer/part details, provenance and source evidence. Records are shown 25 at a time; changing pages clears the review checkbox. Row errors retain their CSV row numbers. Approval confirms the operator reviewed the batch; it does not turn provisional AI facts into verified facts.

Batch history is persisted and paginated. Reopening a batch after reloading restores its records and preview/applied/rolled-back state. An applied batch can be reviewed for rollback; confirmation deactivates only records created by that batch and preserves historical references and independently learned translations.

The preview checks repeated semantic identities inside a file, including material keys and defining specifications, normalized manufacturer/part combinations, phrases per material and origin, and repeated image references. Contradictory or duplicate rows must be fixed before apply. One record kind per file remains required; materials precede dependent products, translations and image references.

## Manufacturer and product restrictions

For a selected material, administrators can allow a manufacturer (all its linked parts), particular part numbers, or both. If both lists are populated, both constraints apply. Rules default inactive. The history exposes scope, list counts, status and edit/deactivate controls. Editing a material rule retains its ID rather than adding a second rule; cancellation clears the unsaved edit.

The API rejects parts from another material and parts excluded by the selected manufacturer list. GUID lists are normalized so equivalent uppercase IDs do not silently exclude valid products. Manufacturer-only restrictions apply to subsequently linked parts of that same manufacturer. No Substitutions never overrides restrictions. A separate job-wide manufacturer editor supports entire-job and category allow lists without first selecting a material. It browses manufacturers in pages, preserves selections across searches, defaults new rules inactive, and supports editing/deactivating persisted rules. Rules containing specific part lists are not rewritten by that manufacturer-only editor, so those limits cannot be accidentally discarded. Category and job rules combine with material rules and No Substitutions validation.

No migrations, additional services, paid AI requests or new costs are introduced by these changes. Real Azure acceptance is still required after the owner runs the existing-app update.

## Explicit inch measurements

Manual specification entry accepts positive decimal inches and explicit fractions, including common Unicode fractions. For example, `15 3/4`, `15¾` and `15.75` all produce 15.75 inches. Measurements are not extracted from manufacturer part numbers, and other units are rejected rather than converted. Actual bracket spread and optional nominal spacing remain separately recorded. Structured imports retain their explicit numeric inch contract.

## Search relationship grouping

Search now groups profiles, translations, products, usage counts and applicable rules once per request rather than repeatedly scanning all those arrays for each material. It preserves exact phrase ranking, specification constraints, brand/part filtering, job rules, frequency-derived high use and administrator priority. Duplicate phrase scoring and spread-argument limits are avoided. This reduces repeated CPU work but still loads tenant catalog data; it is not a database full-text index or a claim of enterprise-scale latency. Multi-material regression scenarios run on both SQLite and SQL Server.

Restriction history follows the selected material. After a job/category manufacturer rule is saved, its history view focuses that rule until the administrator refreshes the full list. This keeps newly saved rules discoverable after the catalog has accumulated more than one page of history; editing still updates the existing ID.

## Long MRF photo loading

Product photos now begin loading when they approach the viewport, including inside scrollable review dialogs. Offscreen MRF rows retain placeholders until needed. Object URLs and observers are released on unmount or scope change. This prevents long saved drafts from consuming the account request budget merely by opening or reloading a page; request limits and image authorization remain unchanged. An 80-line browser regression checks request counts before and after scrolling, and approved/pending/rejected image workflows remain covered.
