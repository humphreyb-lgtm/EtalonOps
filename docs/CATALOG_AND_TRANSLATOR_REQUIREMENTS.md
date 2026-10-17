# Catalog and translator development decisions

Recorded October 17, 2026, from the owner's discussion and instruction to track these requirements. These are requirements for subsequent development, not a claim that the current database/search implements them. They supersede earlier guidance to wait for PO reconciliation before learning translations.

## One material per meaningful specification

Maintain one canonical catalog material for a specification such as `1" PVC SCH 40 10FT`. Vendor names and manufacturer brands alone must not create duplicate materials. Meaningful specification differences—diameter, schedule, length, end connection, material/application type and other defining attributes—can require separate materials. Pipe and conduit must not be assumed interchangeable.

Before inserting a material, compare structured defining specifications with existing materials. Alias similarity or matching display text alone is insufficient to establish equivalence. Design explicit uniqueness rules per material category; incomplete specifications must not cause guesses or unsafe consolidation.

## Manufacturers and manufacturer products

Create separate manufacturer records and manufacturer-product records. Each manufacturer product links a manufacturer and its manufacturer part number to the canonical material whose specifications it satisfies. One material can have many manufacturer products. Manufacturer part numbers are distinct from supplier SKUs; future supplier offers/listings should reference the appropriate product/material rather than duplicate the catalog material.

Verify meaningful specification equivalence before linking a manufacturer product. Preserve source evidence and verification status. The brands named in the discussion were invented examples and must not be inserted as real verified manufacturers.

Plan for future job-specific allowed-manufacturer restrictions using these relationships. Do not enforce brand restrictions in the initial implementation; this is a later feature. Canonical materials must remain reusable across jobs with different allowed brands.

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

## Implementation and acceptance checklist

- [ ] Define category-specific material identity and duplicate-prevention rules; inspect existing data before any merge.
- [ ] Add checksum-preserving forward migrations for manufacturer/product and translation provenance relationships as needed; preserve draft and image references.
- [ ] Implement idempotent selection learning with tenant boundaries, attribution and correction history.
- [ ] Implement selected-discovery reconciliation/insertion with explicit verification states and source evidence.
- [ ] Implement bounded, validated AI phrase generation within existing usage controls; preserve manual operation when AI is off.
- [ ] Implement deterministic shorthand matching and ambiguity handling for the example above.
- [ ] Test that different brands link to one material; meaningful specification differences stay separate; repeated selections do not duplicate links; ambiguous phrases retain alternatives; AI content never becomes verified automatically.
- [ ] Keep future job-brand restrictions documented but inactive in the initial release.

No schema migration, data consolidation, new live AI call or catalog behavior change was performed solely to record this discussion.
