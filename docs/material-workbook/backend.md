# Materials workbook backend

Administrator authentication, normal CSRF protection and tenant-scoped repository transactions apply.

- GET `/api/admin/material-workbook.xlsx`: current active materials, translations and approved generic image URLs. `?empty=1` exports a blank workbook.
- POST `/api/admin/material-workbook?mode=preview`: raw XLSX body with application/octet-stream and URL-encoded x-catalog-filename. Returns row results, before/after changes, summary and previewHash, with no writes.
- POST the same file using `mode=apply` and x-preview-hash to confirm updates and stage new records/image changes. `mode=stage` supports new-only files. A stale preview or any invalid row prevents application. Existing update records are audited within the transaction.

Limits: 3 MB, 1,000 material rows, 2,000 new approval records including phrases/images. Only Materials is imported. Instructions and Family Reference are ignored as data. Formulas, macros, external links and oversized expanded archives are rejected. Previous 25-column materials-only workbooks remain readable.

Blank keys generate new keys. Existing keys identify updates. Blank cells preserve data; [CLEAR] clears optional scalar fields. Search phrases are additive; removals use the phrase editor. Description edits preserve IDs, manufacturer links and verification. Physical corrections to linked materials are held for the reviewed correction workflow. New and replacement generic image URLs require publication; uploads remain preferred.

Family metadata and configuration status do not define physical identity. Shared definitions validate relevant numeric/text attributes and produce descriptions. The family reference is generated from those same definitions, never executed from user-authored workbook content. Proposed configurations are held outside publication; confirmed new family records require an evidence URL plus explanatory source notes. This checks completeness, not independent truth of research.

No SQL schema migration or paid research request is required. Initial catalog exports retain the existing material keys and text; family inference currently covers recognizable existing PVC conduit only. Unknown/custom materials retain the existing category/specification workflow.
