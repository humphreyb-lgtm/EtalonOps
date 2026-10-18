# Catalog corrections and duplicate review

Administrators can select a catalog material and open **Corrections and duplicate review**. Each change requires a reason, a preview of original/proposed facts and affected references, and explicit review before applying. Previews are bound to the current records: a changed record or replacement target requires another preview. Retrying the identical apply request returns the original revision.

Material evidence and nominal spacing may be corrected on the same identity. Defining specifications or units require a new stable material key. The system creates or reuses the matching active canonical material and retires the incorrect record. It never rewrites old MRF descriptions, manufacturer snapshots, translations, pictures or job rules onto the replacement. A retained canonical identity that is already retired requires separate review.

Linked manufacturer products have the same protection. Evidence/title corrections preserve their identifier. Changing the manufacturer or part identity creates or reuses an active product on the same canonical material and retires the old product. A wrong material mapping requires a separate review; this editor cannot silently move a manufacturer part to a different material. Changes to the spelling/case of an existing normalized manufacturer or part identity do not rename the shared manufacturer or historical part number.

Corrections enter as provisional and retain the material's original AI/admin origin. Independently reviewed replacement targets retain their existing facts and verification. Use the existing separate material/product verification controls after checking corrected evidence.

Saved MRFs keep the original candidate and purchasing snapshots, including No Substitutions. Their quantity, delivery date and other draft fields can still be edited. The server accepts a historical candidate only when it exactly matches that owner's previously saved line and material/source. A new or altered historical snapshot cannot bypass source validation. Purchasing checks identify retired materials or products and require selection of an active replacement; draft saving does not approve purchasing.

## Duplicate retirement

This is an explicit review, never an automatic merge based on wording or brands. Enter the retained item's exact stable key, inspect its structured specifications, confirm equivalent defining specifications and units, and preview the retirement. The retained material must be independently verified. A classified source with different specifications is rejected. Legacy sources without structured specifications require the administrator's comparison against the retained structured specification; wording alone is not evidence of equivalence.

Source-linked active manufacturer products and enabled material-specific job restrictions block retirement until separately reviewed. The workflow does not reparent products, images or restrictions. It can explicitly copy the source description as a newly admin-reviewed potential search phrase; existing source translations and their provenance remain recorded. The API also accepts selected recorded source phrases, but does not generate or infer additional equivalents during retirement.

## History and migrations

Forward migration 004 adds `catalog_revisions` to SQLite and SQL Server. Original/proposed records, reason, actor, timestamp and replacement identifiers are recorded in the same transaction as the change. The SQL application identity receives SELECT and INSERT only on this table, with no UPDATE or DELETE. Corrections are visible from the source material and replacement material, and product corrections appear in the related material history. History is included in both catalog export formats. Image bytes and MRFs remain separate from catalog exports.

To amend a mistake, correct the active replacement through a new reviewed revision. There is no destructive history edit or automatic undo that could invalidate newer MRFs or restrictions.
