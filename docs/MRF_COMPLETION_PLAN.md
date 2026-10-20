# MRF creation completion plan

Goal: a demonstrable workflow in which an assigned foreman can find materials, save and resume several named requests, resolve purchasing requirements, and submit a traceable MRF. Existing pilot costs remain unchanged; new subscriptions, services or paid AI activation require the owner's express approval.

| Phase | Deliverables | Exit checkpoint |
|---|---|---|
| 1 — Named drafts and session reliability (implemented; live acceptance pending) | MRF name; multiple drafts per person per project; My Drafts list with name, project, delivery date, item count and save time; explicit New MRF and resume; preserve existing drafts; protect unsaved edits and concurrent saves. Confirm installed version and Microsoft session restoration on reload. | Demonstrate two differently named MRFs in one project, reload the older one by its own link, edit it without changing the other, and show another user cannot access it. Live Microsoft reload acceptance remains required. |
| 2 — Users and project access | Administrator user directory and application access management; roles; project assignments; access deactivation that preserves history. Microsoft Entra remains the sign-in authority; do not create a second password system. Define safeguards against removing the last administrator or granting access across tenants. | Admin can assign/revoke the intended permissions; a deactivated user's protected requests fail while historical MRF ownership remains intact. |
| 3 — Starter catalog and deterministic search | Establish import templates now, before a large AI-generated dataset is prepared. Review a representative starter batch of frequently ordered parts. Validate canonical specification identities, manufacturer products, dimensions/units, images and phrase origins. Expand through reviewed CSV imports. Improve ambiguity handling and selection learning using the starter dataset. | Foreman finds and adds representative common materials without AI; meaningful size differences remain distinct; manufacturer-specific searches and learned phrases behave correctly. |
| 4 — Complete MRF editing and purchasing checks | Quantity/unit validation; MRF and line delivery dates; manufacturer/part references; No Substitutions; job rules; retired/provisional item handling; clear final review. | Demonstrate an ordinary request and a restricted-manufacturer request, with conflicts clearly identified and the original requester intent retained. |
| 5 — AI-assisted discovery (develop alongside phases 3–4) | Integrate missing-item discovery, evidence retrieval and specification verification; user selection creates/reuses canonical material and manufacturer product, records the search phrase and bounded variations, and retains AI origin/provisional status. Present provider, costs and limits for approval before activation. | Selected missing items enter the catalog with traceable facts and no brand-based canonical duplicates. Paid activation is separately approved; a useful catalog-backed demonstration must work with AI disabled. |
| 6 — Submission and purchasing handoff | Final validation; MRF identifier; submitted status; preserved submission snapshot; traceable post-submission revisions; agreed purchasing handoff. Keep draft names after submission. | Request can be submitted, found later and distinguished from a draft. Changes after submission are traceable. No order is placed merely by saving or submitting. |
| 7 — Acceptance and release | Foreman/admin walkthroughs on phone and desktop; poor connections and conflicts; isolation/access revocation; larger requests; production sign-in, storage and recovery acceptance; operating/import instructions. | Agreed scenarios pass with no unresolved defect that risks losing or silently changing a request. |

## Demonstration milestone

First demonstrate named drafts, independent saved contents and dates, item selection, manufacturer references/No Substitutions, and catalog administration. Clearly identify example projects and fictional fixture data. This milestone is not a claim that submission, live AI, user administration or production acceptance is complete.

## Existing work

Canonical materials, linked manufacturer products, selection learning, high-use priority, inactive job rules, structured CSV imports, image review, catalog corrections/history and restricted SQL runtime identity are implemented. Update v4 contains the catalog correction milestone; source availability does not prove deployment to Azure. Microsoft session restoration is implemented with the MSAL session cache and API revalidation, but the user's reported repeat-login behavior remains an open live acceptance issue until the deployed version and account policies are checked.

## Dependencies and boundaries

Catalog preparation starts now and need not wait for AI activation or final submission. Large imported datasets must use the agreed schema and retain AI provenance. Manufacturer restrictions and No Substitutions are core requirements. Purchase-order reconciliation, automatic vendor ordering, vendor pricing integrations and broad reporting follow MRF creation. Live cloud deployment requires authenticated owner Cloud Shell access; no extra paid infrastructure is authorized by this plan.

## Phase 1 implementation evidence

Named drafts, project-scoped owner lists, explicit resume URLs, unsaved-change navigation protection and legacy migration are implemented in update v5. The production build, 51 backend tests, 30 actual SQL Server tests, 51 browser tests and nine deployment checks passed. Additional browser walkthroughs verified named requests with different material lines against SQL Server and at phone width in browser storage. Live Azure deployment, the reported Microsoft reload issue and a second assigned real user remain acceptance items. At that milestone user administration was still planned; it was subsequently implemented in v6. No paid AI has been activated.

## User-administration milestone

Update v6 implements the application-user directory, registration of existing Microsoft object IDs, role restrictions bounded by Microsoft assignments, project access, deactivation on subsequent protected requests and append-only before/after access history. Existing drafts remain owned by their original users. Microsoft invitation/account creation and Microsoft role assignment remain external identity-administration tasks; this app introduces no password system or Graph permissions. See USER_ADMINISTRATION.md. Live acceptance is pending deployment.

Starter dataset preparation is also underway: docs/catalog-starter contains import templates, fictional contract examples and instructions for the AI creating the initial catalog and translation dump. The examples pass the actual staged import contract in an isolated test database; they are not a production seed catalog or verified product research.

## Submission milestone

Update v7 implements server-validated final review, numbered immutable submitted records, My Submitted MRFs, saved-draft locking, linked revision drafts, manual purchasing CSV export and print output. This supplies a demonstrable draft → review → submission → revision workflow. It does not create purchase orders, contact vendors or implement a purchasing queue. See MRF_SUBMISSION.md. Existing user administration and named-draft work remain included. Real catalog onboarding, live AI activation approval, live Microsoft session acceptance and release/recovery checks remain outstanding.

The submission milestone passed 58 backend, 35 SQL Server and 56 browser tests, including immutable original/revision behavior, exact No Substitutions export, stale previews, duplicate-request handling, simultaneous save/submit protection and unique numbering under concurrent submissions. PDF output and phone/desktop SQL-backed walkthroughs passed as well. These results support a demonstrable workflow; they do not replace live sign-in/recovery acceptance or actual catalog review.

## Administration workspace milestone

Update v8 brings the existing protected user, catalog/import, image, job-restriction and AI-usage workflows into a dedicated Administration workspace. Section changes preserve form entries and the MRF editor remains intact behind it. Existing review/history controls and owner isolation remain in force. See ADMIN_WORKSPACE.md and PILOT_UPDATE_V8.md. Deployment and real Microsoft acceptance remain pending; no new paid capability is enabled.

## Initial catalog delivery checks

An offline preflight command now rehearses ordered multi-file deliveries in an empty in-memory catalog, checks real import rules and replay, flags cross-file conflicting canonical keys, and reports relationship/phrase coverage and file hashes. See CATALOG_DELIVERY_READINESS.md. The production build, 62 backend tests and CLI success/failure checks passed. No live data was changed, source facts were not externally verified and no paid AI was invoked. The real source-backed starter delivery is still needed before live catalog acceptance.


## Combined v9 demonstration phase

Catalog readiness now exposes tenant-scoped counts and bounded, filtered review queues with links to the existing correction/review and image controls. My Drafts supports name and inclusive delivery-date filters before paging. MRF lines can be reordered without changing original intent or delivery settings. Pilot status identifies the installed release and current database/sign-in connection. No new schema or service is required. The offline catalog preflight is included in the combined update.

Use DEMONSTRATION_RUNBOOK.md to exercise draft creation, resume/filtering, purchasing checks, submission/revision and real-account isolation in one session. Source completion and automated checks remain distinct from deployment and acceptance. Remaining external dependencies are a real source-backed starter catalog, authenticated installation of the combined release, live Microsoft session/access checks and deployed recovery acceptance. AI product evidence retrieval and paid activation are still separate unfinished work; they are not prerequisites for a catalog-backed demonstration.

V9 verification: production and standalone builds, 64 backend tests, 37 actual SQL Server tests, 65 browser tests and nine deployment checks passed. Nine additional administration/readiness/draft walkthroughs ran with the SQL Server repository, including submitting reordered lines and locking their submitted originals. The combined source ZIP also built successfully over v8 while preserving an existing runtime-state marker. These results do not claim installation or live Microsoft acceptance.


## Excel catalog preparation

V10 replaces the starter files' JSON cells with ordinary CSV columns and includes a blank native Excel workbook with category-specific material sheets, manufacturer products, one-phrase-per-row translations and optional image references. The workbook preserves identifiers as text and offers filters, header guidance and dropdowns. Export populated sheets as CSV UTF-8 for the reviewed import workflow; direct XLSX upload is not implemented. The importer accepts the column format and retains previous JSON batch compatibility. No new application dependency, migration, paid service or AI call is introduced.

## Workforce/account milestone — v31

Implemented: responsive Microsoft/site login, invited registration, password reset, company-scoped administration, managed active/archived jobs, multi-job assignments, per-job roles/reporting supervisors, contact fields, account suspension, audit history, site session/link revocation and assigned-job switching. Original Input and Move are removed from the builder item list. Mail delivery uses the optional authenticated HTTPS adapter described in SITE_ACCOUNTS_AND_JOBS.md; administrator-delivered links work without it.

Next approval milestone: configure per-job MRF approval rules independently of reporting hierarchy, delegates and effective dates, self-approval prevention, immutable approval-route snapshots, decisions/comments/history, reapproval after edits, and release to purchasing. Submission behavior has not been changed into approval or order placement by v31.

## PDF foundation v37

Job export contacts, requester phone snapshots, MRF work area/packaging/default task code, draft/revision persistence and fillable AcroForm exports are implemented. Administration includes starter PDF settings and preview. Next: visual block designer, logo/font assets, multiple company/job templates, versioned template publication and release-time layout snapshots. Excel remains optional import assistance rather than the primary rendering engine.
