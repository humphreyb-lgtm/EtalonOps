# MRF review, submission and revisions

Saving a draft and submitting an MRF are separate actions. Submission records a material request; it does not create a purchase order, send email, contact a vendor or authorize a purchase.

## Foreman workflow

1. Build a named request with its materials, quantities, units and dates. Select **Review and submit MRF**. Unsaved changes are saved first; a conflicting save preserves the on-screen work instead of silently replacing the other version.
2. Inspect the complete saved request: project, foreman, requested descriptions/specifications, original input, quantities, units, effective item delivery dates, manufacturer/part references and No Substitutions instructions.
3. Resolve blocking purchasing issues. A retired material/product, a disallowed manufacturer or a missing required job-specific product prevents submission. An empty request cannot be submitted.
4. Review warnings about requester descriptions, fictional local fixtures, provisional catalog/manufacturer facts, unlinked manufacturer references or changed catalog details. Acknowledge that unverified items require purchasing review. Submission does not verify those facts.
5. Confirm **I reviewed this MRF and want to submit it**, then submit. The server rereads the saved draft and current requirements in the same transaction and checks that they match the reviewed state. A changed draft, catalog state or job rule requires a new review.

## Submitted records

A submitted request receives a tenant-wide number such as `MRF-000001`. The saved draft is locked and leaves My Drafts. **My Submitted MRFs** lists the signed-in user's records in the selected assigned project, including revisions. Reloading a submitted draft's URL retains its locked status.

The submitted snapshot, recorded warnings and catalog/job-rule review context are immutable to the runtime application identity. The record preserves the request as reviewed even if catalog descriptions, preferred products, users or project rules later change. Retry protection returns the same submission for the same saved draft/review, rather than creating another MRF number after an uncertain response. A reused request identifier for a different submission is rejected.

Submitted MRFs remain owned by the original requester. Administrator status does not grant access to another person's submitted records. Project removal and application deactivation also apply to submitted records and exports. Tenant/owner/project checks are enforced by the API, not just by the list screen.

## Changes after submission

Open the latest submitted record and select **Create revision draft**. This creates or resumes one pending draft copied from that submitted request, with the same MRF name and a parent link. Original item snapshots, quantities, manufacturer references and dates carry forward without silently substituting current catalog values.

Edit and review the revision normally. It receives a number such as `MRF-000001-R2` and links to its predecessor. The previous submission remains unchanged and downloadable. A revision based on an older, superseded submission cannot be submitted; start from the latest record. Current purchasing checks still apply, so retired or newly restricted parts carried from the original must be resolved before submitting the revision.

The server serializes submitting and saving the same draft. Concurrent submissions of different requests receive distinct numbers. There is no destructive edit, deletion, cancellation or approval workflow for submitted records in this milestone; later purchasing workflow work must preserve this history.

## Purchasing handoff

**Download purchasing CSV** exports the immutable submitted record, not the current mutable catalog. Fields include MRF number/revision, name, project, foreman, item descriptions/specifications, exact requested quantity/unit, product unit for reference, effective item date, manufacturer, manufacturer part number, No Substitutions, original wording, verification and recorded warnings. Spreadsheet formula-leading values are escaped for safe viewing. No quantity conversion is inferred.

**Print submitted MRF** prints the request and its recorded review warnings without the underlying builder controls. This is a manual handoff: no email, vendor integration, purchasing queue, PO or reconciliation is created. Sharing with purchasing remains the user's action; there is no background message or paid integration.

## Migration and acceptance

Forward migration 007 adds immutable `mrf_submissions` and nullable draft revision links. Existing drafts remain intact. SQL runtime permissions allow SELECT/INSERT only on submissions, with no UPDATE or DELETE. Source drafts and parent submissions are retained through foreign-key relationships. Checksums of prior migrations remain unchanged.

Validate a normal MRF, a No Substitutions request, a restricted-manufacturer conflict, explicit unverified-item acknowledgment, stale reviews, repeated submission, simultaneous edits, an original/revision pair, CSV/print output and another user's denial. Local fixture demonstrations remain visibly fictional and cannot be saved in the cloud runtime. Live Microsoft/Azure acceptance and a real initial catalog are still required.

Development validation: production/type build, 58 backend tests, 35 actual SQL Server tests, 56 browser tests and nine deployment checks passed. Additional phone/desktop browser walkthroughs passed against SQL Server. The print regression renders a PDF and checks its extracted text for the MRF number and quantity while excluding underlying builder controls. Submitted-record and CSV endpoints are also tested after project revocation and account deactivation. Live Azure acceptance remains separate.
