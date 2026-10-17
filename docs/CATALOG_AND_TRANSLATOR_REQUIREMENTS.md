# Catalog and translator development decisions

Recorded October 17, 2026, from the owner's discussion and instruction to track these requirements. This is the decision log; the linked milestone records implemented behavior and remaining gaps. They supersede earlier guidance to wait for PO reconciliation before learning translations.

Implementation evidence and remaining limits: [Catalog relationships milestone](CATALOG_RELATIONSHIPS_MILESTONE.md). Development authorization covers this portion only; additions incurring costs or subscriptions always require express owner approval before commitment for the life of development.

## One material per meaningful specification

Maintain one canonical catalog material for a specification such as `1" PVC SCH 40 10FT`. Vendor names and manufacturer brands alone must not create duplicate materials. Meaningful specification differences—diameter, schedule, length, end connection, material/application type and other defining attributes—can require separate materials. Pipe and conduit must not be assumed interchangeable.

Before inserting a material, compare structured defining specifications with existing materials. Alias similarity or matching display text alone is insufficient to establish equivalence. Design explicit uniqueness rules per material category; incomplete specifications must not cause guesses or unsafe consolidation.

## Manufacturers and manufacturer products

Create separate manufacturer records and manufacturer-product records. Each manufacturer product links a manufacturer and its manufacturer part number to the canonical material whose specifications it satisfies. One material can have many manufacturer products. Manufacturer part numbers are distinct from supplier SKUs; future supplier offers/listings should reference the appropriate product/material rather than duplicate the catalog material.

Verify meaningful specification equivalence before linking a manufacturer product. Preserve source evidence and verification status. The brands named in the discussion were invented examples and must not be inserted as real verified manufacturers.

Plan for future job-specific allowed-manufacturer restrictions using these relationships. Build the supporting relationships and validation now, but leave actual-job enforcement inactive initially (updated by the later discussion below). Canonical materials must remain reusable across jobs with different allowed brands.

## Learn translations from user selections

When a user searches and selects a catalog material from the results, save the original search phrase as a potential translation linked to that selected material if the relationship does not already exist. Do not wait for purchase-order reconciliation. Merely displaying a result list must not create links to every suggested item.

Record original wording, user, timestamp and selection provenance. Keep user-selection translations distinguishable from administrator-reviewed translations. Deduplicate equivalent phrase-to-material relationships without discarding provenance. A phrase may map to multiple materials; preserve ambiguity instead of overwriting an earlier association. Provide a path for correction/rejection and retain traceability.

Defining specifications still constrain matching: a learned phrase must not make explicitly conflicting size/schedule/length values interchangeable.

## Catalog growth from selected AI discoveries

When a user selects an AI-found product, check for an existing canonical material by its defining specifications. Reuse that material when equivalent; otherwise add the new material with supported specifications. Add or link the manufacturer product/part number when supported, and save the user's phrase as a translation to the canonical material.

Do not duplicate materials by brand/vendor. Retain discovery sources and distinguish user-selected, AI-sourced records from administrator-verified records. User selection documents a choice; it does not independently verify all extracted product specifications. Missing defining information must remain explicit and must not be invented to force a match.

External product discovery is not currently enabled. This requirement does not itself select a search provider, authorize new service-chain costs, activate AI, or establish live integration readiness.

## Generate additional potential search phrases

After selection of an AI-found product, generate a bounded set of reasonable alternative search phrases from supported product facts and link them to the canonical material. Store their AI-generated provenance separately from the user's actual phrase and administrator-reviewed translations. They may assist future ranking without being presented as verified human wording.

Examples for a supported PVC conduit specification:

- `1 inch schedule 40 PVC conduit 10 foot`
- `1" sch40 pvc conduit 10ft`
- `10 foot stick of 1 inch schedule 40 PVC conduit`

Do not invent dimensions, brands, equivalencies, applications, or synonyms such as pipe for conduit. Avoid misleading variants that erase meaningful distinctions. Validate and deduplicate generated phrases, preserve sources, and allow rejection/correction. Exact generation bounds and category-specific rules remain implementation choices to document during development.

## Database search without AI

Ordinary deterministic search should handle word order and controlled shorthand/unit normalization, including `10'` versus `10 foot`, `stick` as a common stock-length term, and `PVC 40` as a possible Schedule 40 PVC reference in the appropriate context.

For `10' Stick PVC 40`, retrieve relevant potential catalog matches without an AI call. Diameter and pipe-versus-conduit type are unspecified: do not silently assume 1-inch conduit or promote one candidate as an exact verified match. Return multiple possibilities or request the missing specification. After selection, learn that exact phrase through the selection rule above. If it becomes associated with several diameters, retain those alternatives.

These particular rules need implementation and tests; the existing shorthand foundation does not establish that this entire example works today.

## Bulk catalog and translation imports

The owner plans to commission another AI to prepare a large initial parts catalog and a separate translation dataset. Support administrator bulk file imports in CSV or a comparable structured format for launch seeding and subsequent updates. Exact columns, table layouts and file relationships will be agreed later; do not freeze a schema or demand reformatting now.

Extend the existing reviewed CSV import foundation to cover canonical materials, defining specifications, manufacturer/product relationships and phrase-to-material translations as those relationships are implemented. Catalog and translation files must be linkable through stable identifiers rather than guessed description matches. Support staged imports so material records can be loaded before their related products and translations.

Provide a validation/preview step, counts and actionable row-level errors, duplicate/conflict detection, explicit administrator apply, import provenance and a batch history. Re-importing the same dataset must not duplicate materials or relationships. Reject or isolate unresolved references and conflicting specifications; do not silently overwrite reviewed records. Preserve the ability to correct or roll back a batch without breaking existing MRF references or removing subsequent independently learned translations.

Record supplied evidence and AI origin. An administrator approving an import batch does not by itself verify every AI-generated product fact or phrase. Preserve explicit verification states rather than converting a large AI-generated dump into verified manufacturer data. Bound file processing and use staged/batched application where needed; agree supported launch volumes and test with representative large datasets once the format/volume is known. Do not claim large-dataset readiness from the existing small-fixture import tests.

## Additional agreed product behavior

- Store category-specific structured specifications and build consistent catalog descriptions from supported facts. Bracket actual span and nominal stud spacing are separate attributes. Do not infer dimensions from a part number. Manufacturer web/document retrieval with evidence is required for future AI discovery; the current clarification client is insufficient.
- Preserve explicit manufacturer intent in search: requested-brand products first; any other-brand alternatives must be clearly distinguished. Exact part-number searches prioritize that product; generic searches may group equivalent manufacturer products under one material.
- Track material selection frequency and allow administrator high-use designation. Boost relevant high-use results without overriding explicit dimensions, brand or part constraints.
- Permit a preferred manufacturer product on a canonical material. It can populate an MRF line as the normal purchase example without creating another material or silently asserting No Substitutions.
- Show manufacturer and manufacturer part number on MRF lines. A per-line No Substitutions restriction requires both values and communicates the exact required product to purchasing. For unrestricted lines these values are examples and substitutions are allowed subject to job rules. Snapshot them with the line so later catalog changes do not silently change requests.
- Build job manufacturer/product restriction relationships and validation now, while leaving actual-job enforcement inactive initially. Support allowed manufacturers and specific manufacturer products at appropriate job/category/material scope. When active, filter choices and validate before submission; flag conflicting drafts rather than silently changing them. No Substitutions is a separate, stricter line constraint and cannot bypass job restrictions.
- The owner later wrote TSGB1426 after previously discussing TSGB1624. The exact intended part number remains unresolved; do not treat those strings as aliases or create a verified product from this discussion. The preferred-product design was agreed independently of that identifier.

## Implementation and acceptance checklist

- [ ] Define category-specific material identity and duplicate-prevention rules; inspect existing data before any merge.
- [ ] Add checksum-preserving forward migrations for manufacturer/product and translation provenance relationships as needed; preserve draft and image references.
- [ ] Implement idempotent selection learning with tenant boundaries, attribution and correction history.
- [ ] Implement selected-discovery reconciliation/insertion with explicit verification states and source evidence.
- [ ] Implement bounded, validated AI phrase generation within existing usage controls; preserve manual operation when AI is off.
- [ ] Implement deterministic shorthand matching and ambiguity handling for the example above.
- [ ] Test that different brands link to one material; meaningful specification differences stay separate; repeated selections do not duplicate links; ambiguous phrases retain alternatives; AI content never becomes verified automatically.
- [ ] Build and test job manufacturer/product restriction relationships and validation, keeping actual-job enforcement inactive initially.
- [ ] Extend reviewed bulk imports to the revised catalog/manufacturer/translation relationships after file formats are agreed.
- [ ] Implement high-use/preferred-product ranking and MRF manufacturer snapshots/No Substitutions validation.

No schema migration, data consolidation, new live AI call or catalog behavior change was performed solely to record this discussion.
