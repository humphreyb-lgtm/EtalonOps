# v47: Shared trade vocabulary and catalog-wide search audit

FA and MA already existed as material translations. Specification-aware retrieval skipped residual terms shorter than three letters, so adding schedule requirements to those phrases could still hide the intended material. Retrieval now accepts meaningful short letter codes while retaining numeric and physical checks.

A shared trade-terms module expands context-qualified FA/MA (including F.A./M.A.), adaptor spelling, cplg/conn/jbox and common material noun plurals consistently in ranking, requirement comparison and physical constraints. Manufacturer identifiers such as FA-123 and MA/456 remain intact; FA without fitting context remains ambiguous and is not expanded. Gender, size, radius, schedule, manufacturer and job restrictions remain in force. No database rewrite or paid search is required.

Deploy with scripts/update-cloud-app.sh. Do not rerun the material import. Health release: trade-search-v47.

The broader audit also corrected accessory-versus-base-material interpretation (PVC-compatible solvents, plugs and steel supports), repair-adapter gender from connection fields, center-stop facts from structured specifications, fractional bend angles, explicit diameter labels, and the ambiguity between stock length and a long-line coupling name.

Validation: 4,447 offline searches against the user-supplied live export passed (872 active descriptions, 3,455 stored translations, 120 generated shorthand cases), with the linked material present in each result. This checks known catalog coverage, not every possible future wording. Regression suites: 157 server tests, 62 SQL tests, browser tests for coupling warnings and FA/MA gender separation. The reusable offline audit is scripts/audit-catalog-search.ts; exported data/reports stay private.
