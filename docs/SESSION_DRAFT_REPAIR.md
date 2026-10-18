# Reload session and project draft repair

The cloud sign-in cache previously used memoryStorage, requiring another interactive sign-in after a page reload. It now uses MSAL sessionStorage, restores one active/cached account silently, and revalidates `/api/me` before mounting the application. Closing the browser tab ends that cache; account or organizational policies can still require interaction. No app-created token copies or credentials are put in the URL.

The application previously always initialized Riverside on reload. A draft saved for Northside therefore appeared missing. Successful project changes now put the project ID in the page URL, and initialization reads that ID when loading the authenticated project draft. Existing server ownership and role checks remain in effect.

Production build and five relevant browser tests passed, including a date-only Northside save/reload and isolation from Riverside. Real Microsoft session restoration requires acceptance in the deployed browser. The patch also corrects cloud project-load messaging and makes the cloud readiness checker retry socket timeouts.

Run `scripts/update-cloud-app.sh` in the original authenticated deployment directory after extracting the targeted patch. It validates the existing subscription, tenant, app and managed identity; builds using existing dependencies, packages the runtime, updates only that app, and checks health. It does not run infrastructure provisioning, change pricing plans or enable AI. Update v4 also applies checksum-verified forward migrations to the existing SQL database before deploying; see PILOT_UPDATE_V4.md.
