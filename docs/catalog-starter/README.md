# Starter catalog exchange files

Use the empty `*-template.csv` files for real submissions. The `*-FICTIONAL-EXAMPLE.csv` files explain syntax only and must not be loaded into the live catalog. Their dimensions, manufacturer, part number and image rights are deliberately fictional.

Start with **EtalonOps-catalog-template.xlsx** for normal Excel editing. It has separate Conduit, Supports, Boxes, Other Parts, Manufacturer Products, Translations and Image References sheets, plus instructions. Columns are ordinary cells: no JSON, arrays or nested objects are required. Headers have explanatory comments; units/status/origin fields offer dropdowns. The workbook is blank; EtalonOps-catalog-FICTIONAL-EXAMPLE.xlsx is a separate syntax example only.

Keep the master file as **.xlsx**. When ready to import, save each populated data worksheet as **CSV UTF-8 (Comma delimited)**. Upload CSV sheets one at a time through Administration → Catalog and imports. Direct .xlsx upload is not supported; the workbook is for Excel editing. Do not export the Instructions sheet. Completely empty CSV rows are ignored.

The `*-template.csv` files also use ordinary columns. `kind` identifies the record type. Material dimensions have separate columns such as `diameterIn`, `lengthIn`, `minSpanIn` and `maxSpanIn`; the application converts these cells into its internal structured specifications. Additional defining text specifications may use `attribute.fieldName` columns. Do not add notes or arbitrary renamed headers to import files: unknown columns are rejected so data is not silently lost. Legacy `kind,data_json` files remain supported.

One kind per file. Split files above 800 KB or 2,000 populated rows. Prepare a small representative batch first and preview it before scaling up.

**Preserve identifiers:** the workbook formats catalog IDs, manufacturer part numbers and schedules as Text. Keep that formatting so `00001` and `001E02` remain exact. When opening an existing CSV in Excel, use Data → From Text/CSV and set those columns to Text; opening CSVs directly may remove leading zeros or convert part numbers to dates/scientific notation. The importer cannot recover characters Excel has already changed.

**Translations:** use one phrase per row. Repeat `materialKey` for each additional phrase. Do not put several phrases in an array or comma-separated list inside a single cell.

Import in order: **materials → products → translations → image references**. The material's `externalKey` is the stable relationship key; related files use `materialKey`. Canonical identity is determined by category, defining specifications and product unit, rather than the wording of a key or description. Brands/vendors/part numbers never belong in canonical material attributes.

## Material specification fields

| Category | Required attributes | Optional descriptive attribute |
|---|---|---|
| conduit | `diameterIn` and `lengthIn` as positive numbers; `material`, `type` (pipe or conduit), `schedule`, `endConnection` as strings | Additional verified defining attributes must remain consistent across equivalent records. |
| bracket | `minSpanIn` and `maxSpanIn` as positive numbers; `mounting`, `material` as strings | `nominalSpacing`, with units, kept separate from actual adjustable span. |
| box | `type`, `material`, `knockouts` as strings; `widthIn`, `heightIn`, `depthIn` as positive numbers | Verified additional defining attributes only. |
| general | `type`, `specification` as strings | Verified defining attributes needed to distinguish the item. |

Use decimal inches in numeric fields: 15 3/4 inches becomes `15.75`; a verified 10-foot length becomes `120`. Do not infer measurements from a model number. Actual spread and nominal framing spacing are separate facts. Confirm the exact manufacturer part number: TSGB1426 and TSGB1624 must not be treated as interchangeable labels without evidence.

Allowed product units: EA, FT, STICK, BOX, ROLL, PAIR. Choose the stocking/product unit deliberately; do not invent quantity conversions. Attribute strings are limited to 200 characters and there may be at most 25 attributes.

## AI provenance and evidence

AI-prepared materials/products must use `origin: ai_import` and `verification: provisional`. A CSV import cannot independently verify the facts it imports. Material `sourceUrl` and product `sourceUrl` must identify actual HTTPS evidence for that exact product/specification. Material `verificationBasis` must explain what the source supports, including unresolved uncertainty. Keep conflicting or unverified identity facts in a separate research report; do not guess a catalog record.

Potential phrases use `origin: ai_generated` for generated variations or `ai_import` for externally collected phrases. Both need `sourceUrl`. Do not label generated phrases as administrator-reviewed or user-selected. Real user selection is recorded by the application, not invented in this dump.

Generic phrases may legitimately match several materials. Never add a different diameter, schedule, thread size, material, finish, length or spread merely to increase phrase coverage. A phrase for a particular manufacturer/part must refer only to its linked canonical material and preserve the correct manufacturer/part identity.

Image entries are references, not downloads or approvals. Record the exact product relationship, source and usage-rights basis; a publicly visible image does not imply permission to reuse it. Actual upload, identity review and rights approval happen separately.

## Initial review batch

Start with representative frequently ordered conduit, supports, boxes and fasteners. Include cases with meaningful size differences, several verified manufacturer alternatives, and both broad and exact search phrases. Determine the high-use list with your staff rather than treating AI popularity claims as company usage data. Review specifications and trial searches before expanding to a large catalog. The initial dataset is separate from paid live AI search activation.

See [AI dataset instructions](AI_DATASET_INSTRUCTIONS.md).

## Check a complete delivery offline

The development checkout includes an isolated delivery rehearsal. With Node 24+ and the repository dependencies installed, run:

```bash
npm run catalog:preflight -- materials.csv products.csv translations.csv images.csv
```

Pass the actual files in import order. Multiple files of each kind are supported (up to 50 files and 20 MB total, with the existing 800 KB / 2,000-row per-file limits). This command always uses a new in-memory database; it does not use a configured local or cloud database, connect to Azure, fetch source pages, download images or invoke AI.

The JSON report lists each filename, SHA-256, row count, accepted status, created/reused counts, material/manufacturer/product/translation/image-reference totals, row errors and per-material product/phrase coverage. It rehearses the real import transactions and their idempotent retry. Cross-file duplicate specifications using different material keys are flagged so related files can be corrected before loading. Placeholder evidence URLs are warnings.

A successful report means this delivery is structurally consistent against an **empty** catalog. It does not certify manufacturer facts, image rights, adequate phrase coverage, performance at launch volume, or compatibility with existing live records. Rehearse all prerequisite material files together with their related files. A rejected prerequisite may cause additional missing-reference errors; correct and rerun the delivery. The command leaves no accepted records behind after exit.

Exit code 1 means validation or command failure. Warnings remain visible even with exit code 0. Review the evidence and coverage, then use authenticated Administration → Catalog and imports to preview and explicitly apply each file against the actual catalog. This offline command does not replace live preview or administrator approval.
