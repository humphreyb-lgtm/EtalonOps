# Named MRF demonstration

This milestone demonstrates multiple named drafts, not submitted MRFs or a completed purchasing system. Live AI remains disabled. Microsoft Entra access roles and project membership checks exist; the user administration interface is now implemented in update v6; see [the completion plan](MRF_COMPLETION_PLAN.md).

## Offline review

Download and extract `EtalonOps-preview.zip` from the repository's `preview-download/review-download` folder, then open `EtalonOps-preview.html` in Chrome or Edge. The file runs without external assets or paid calls. Browser storage must be available; private browsing, different browsers or moving the file may use different local storage. This fictional-data demonstration is not the Azure catalog and does not provide real user isolation or Microsoft sign-in.

1. Enter **Level 2 Rough-In** in **MRF name** and choose a delivery date.
2. Add a demonstration material, then **Save as Draft**.
3. Choose **New MRF**, enter **Parking Lot Lighting**, use a different date and add another material. Save it.
4. Open **My Drafts**. Both requests should appear under the selected project, with item counts, delivery dates and last-saved times.
5. Continue Level 2 Rough-In and reload. Its name, date and items should return, even though Parking Lot Lighting was saved later.
6. Edit the first request, then continue the second. **Stay here** keeps the unsaved work; **Save and continue** saves that specific request before opening the other. Neither saved request is overwritten by creating a new one.
7. Switch projects to see that each project has its own draft list. A draft cannot be moved between projects through a forged save.

## Database/cloud acceptance

Repeat the same demonstration against the deployed pilot. Database lists and resume endpoints are limited to the signed-in owner's tenant and assigned project. A second assigned user must not see or open the first user's drafts, including by copying its draft URL. An administrator does not automatically receive permission to read another person's drafts.

Previously saved database drafts retain their identifiers, versions, items and timestamps. Forward migration 005 supplies names such as `Saved MRF - riverside - 2026-11-10`; edit these names as needed. Older browser drafts remain available and get an editable default name.

The current project and selected saved draft appear in the page URL so reloading the older request restores that exact request. With no selected draft URL, the latest saved request in the project is the starting view. **New MRF** starts a new unsaved request; leaving unsaved work still requires a decision. A name is required and limited to 120 characters; names may repeat, while database identifiers stay distinct.

Saving an existing draft uses its identifier and expected version. Conflicting edits fail instead of silently overwriting another save. Creating a new draft uses POST with version 0; updating an existing request requires its identifier. If a network failure leaves the outcome of a new save uncertain, check My Drafts before submitting the new save again. The application does not currently deduplicate uncertain creation retries.

## Sign-in reload issue

The previous Microsoft session restoration fix is included, and no persistent credential workaround is introduced. Check `https://etalonops-954bb4a3.azurewebsites.net/api/health` after deployment: `release` must be `user-access-v6`. This distinguishes deployed code from an older running version.

Sign in once in the same browser tab and reload the saved draft. The session cache should restore the account and revalidate API access. Test this live; local mock sessions and the offline file cannot prove Microsoft session behavior. If the current release still requests a new login, retain the displayed error and check account/organizational session policies and browser storage restrictions. Do not paste tokens or credentials into troubleshooting messages.
