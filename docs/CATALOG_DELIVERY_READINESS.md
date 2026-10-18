# Catalog delivery readiness

The next launch step is a small, source-backed initial delivery, followed by administrator review and real-user search checks. There is no real catalog delivery in this checkout; fictional template examples are not launch stock.

1. Prepare canonical material files, then manufacturer products, potential phrases and image references using `docs/catalog-starter`. Keep actual dimensions, nominal sizes and product units distinct. Confirm manufacturer alternatives meet the same specification.
2. Run `npm run catalog:preflight -- <ordered CSV files>`. Fix errors across the entire delivery. Review materials with zero product links or zero phrases in the coverage report. Several manufacturers for one material are expected; one manufacturer part linked to two materials is a conflict.
3. Independently review exact product specifications and evidence. AI-generated records stay provisional. Placeholder sources and invented parts cannot be accepted as real catalog data.
4. On the existing pilot, preview each real file using Administration → Catalog and imports. Apply only reviewed batches in relationship order. Live preview can detect conflicts against existing records that the empty offline rehearsal cannot detect.
5. Test generic wording, shorthand, exact manufacturer/part searches and meaningful size differences. Confirm relevant high-use items rank appropriately without hiding a size or brand mismatch. Check images and No Substitutions/manufacturer restrictions separately.
6. Save, resume, submit and revise an MRF using the reviewed items. Confirm historical descriptions and manufacturer/part intent remain unchanged after subsequent catalog corrections.

Live AI evidence retrieval, product discovery and generated phrase activation remain separate work requiring cost approval before paid calls. Current import validation does not verify external facts automatically. Neither an empty-catalog rehearsal nor the existing small fixtures prove readiness for an unspecified large launch dataset.
