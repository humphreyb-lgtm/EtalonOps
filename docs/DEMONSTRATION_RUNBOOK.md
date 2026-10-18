# MRF demonstration and acceptance runbook

Use the existing pilot and its assigned Microsoft accounts. The standalone HTML supports browser drafts only. Do not load fictional development fixtures into the live catalog or enable paid AI to run this walkthrough.

## Prepare the demonstration

1. Apply the combined v9 source update to the existing pilot. Open Administration → Pilot status and confirm `catalog-readiness-v9`, an Azure SQL connection and Microsoft sign-in. The page reports the installed version; a successful source push alone does not prove deployment.
2. Register or review the demonstrators' existing Microsoft identities and project access under Users and access. At least one real foreman and one administrator are needed. Deactivation, role limits and project changes remain subject to the existing safeguards.
3. Prepare a small source-backed catalog delivery. Run the offline preflight, then preview and explicitly apply each file against the live catalog. Keep imported AI facts provisional until independently reviewed.
4. Open Catalog readiness. Work through specification, manufacturer-product, phrase and image queues. Use a filtered stable material key to review one item without confusing it with similarly named sizes. Refresh after saving a correction. Missing phrases, images or product links are completeness gaps; they are not all submission blockers. Counts are not a certification of source accuracy.
5. Configure only the intended demonstration job restrictions. Rules are inactive by default. Keep a clearly unrestricted case and one restricted case; do not change a real job's purchasing rules just to make a demonstration pass.

## Foreman workflow

- Create and name an MRF with an identifiable delivery date. Add materials using generic wording and exact manufacturer/part wording. Verify meaningful specification differences remain distinguishable.
- Check the quantity and requested unit. No quantity conversion is assumed. Choose a manufacturer example for an ordinary line and an exact product for a No Substitutions line.
- Set one item delivery override. Move that line up or down; its quantity, original input, manufacturer, No Substitutions requirement and override must travel with it.
- Save, reload and verify the selected draft and item order. Check whether Microsoft sign-in restores without another interactive prompt. Record the installed version and account-policy conditions if it does not.
- Save a second, differently named MRF. Use My Drafts to search names and filter an inclusive delivery-date range. Clear the filters to recover the broader list. Search treats `%`, `_` and `[` as literal characters. Results are filtered before paging.
- Continue the older draft. A navigation attempt with unsaved changes must offer stay, discard or save-and-continue. Changing one draft must not alter the other.
- Run purchasing checks. An incompatible product or missing exact No Substitutions identity must be explained without silently changing the request.
- Review and submit. Acknowledge provisional/unverified-item warnings as appropriate. Confirm a numbered immutable record, download its purchasing CSV and print it. Saving or submitting must not send an order.
- Create a revision draft from the submitted record. Make a change and submit the revision; the prior submitted snapshot must remain intact. Submitted originals cannot be reordered or edited.

## Access and recovery acceptance

- A second assigned foreman can create their own request but cannot read or modify the first person's drafts or submissions. Administrators do not automatically gain access to private MRFs.
- A foreman has no Administration entry point. Authenticated direct readiness/user-management calls must still be denied.
- Remove a demonstration user's project access or deactivate the account from another administrator session. Subsequent protected requests must fail; saved history must remain intact. Restore authorized access afterward.
- Open the same saved draft in two tabs. Save a change in one, then attempt a stale save in the other. The stale editor must retain its items and show a conflict rather than overwrite the newer version.
- Interrupt connectivity during a save and verify visible error handling. Do not describe a timed-out response as an accepted save until the saved record has been checked.
- Follow the existing database/image recovery procedures before accepting production use. An export or passing local test suite does not prove recovery of the deployed data.

Record the release, account roles, project, actual cases, pass/fail outcome and unresolved issue for each live check. Automated development tests cover both database adapters and representative phone/desktop workflows; they do not replace Microsoft policy, real catalog evidence or live recovery acceptance.
