# Agreed development scope and acceptance queue

The owner authorizes routine development and fixes for the agreed catalog/MRF portion without repeated approval. New services, subscriptions, paid AI activation or other new cost commitments require express approval. This is not blanket authorization for unrelated future features.

## Current acceptance

- West US 3 app starts against Azure SQL; owner reached the UI through Microsoft sign-in and confirmed fields and office selection.
- Session/project reload fix prepared; real Microsoft session restoration and the Northside save/reload need deployed browser acceptance.
- Local canonical catalog, manufacturer links, selection learning, high-use ranking, No Substitutions snapshots, inactive-by-default job rules, staged imports and scoped image review have automated coverage.
- No real catalog fixtures were imported into Azure. Blank search results are expected until an approved dataset is imported.

## Next work within scope

1. Deploy prepared session/project fix to the existing app and confirm save/reload and office isolation with the owner.
2. Exercise cloud catalog import preview/apply/rollback and Azure Blob image review with a small owner-approved dataset. Preserve provisional AI provenance and rights review.
3. Agree the external bulk-data exchange format when the owner's catalog is available; preserve canonical identity and manufacturer relationships. Relationship snapshot export and paged administration are implemented. Structured previews now include records, persisted history, resumable rollback and duplicate-identity validation. Streaming exports now handle larger catalogs; search indexing remains volume-dependent work.
4. Build provider-independent discovery integration and source-evidence handling using fixtures, leaving paid providers disabled. Real product specifications must cite a source; do not infer dimensions from part numbers.
5. Validate cloud recovery and a second authorized account before broader pilot use.

## Separate decisions

Live discovery/provider selection and costs need express approval. Actual purchasing submission, unrelated modules and DNS are outside the current completed pilot; readiness checks submit no orders. Do not call the system production-ready until live acceptance and recovery are complete.
