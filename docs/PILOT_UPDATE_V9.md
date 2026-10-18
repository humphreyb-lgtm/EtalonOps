# Existing pilot update v9 — Catalog readiness and saved-request usability

This combined update includes v8 and all earlier catalog, user-access, named-draft and immutable-submission work. It adds:

- Organization-scoped catalog counts and paged review queues for specifications, structured identities, missing manufacturer products/search phrases/approved images, provisional products and pending uploaded images.
- Direct queue links into material or image administration. Work is reviewed explicitly; refreshing the queue reflects completed changes.
- My Drafts search by name and inclusive delivery-date filters, applied before pagination in both SQL and browser modes. Results remain scoped to the original owner and project.
- Item movement up/down with original input, quantity, manufacturer intent, No Substitutions and delivery overrides preserved.
- A Pilot status screen showing the installed release, current database connection and sign-in mode.
- The offline catalog delivery preflight command and demonstration runbook.

No schema changes are added beyond existing migrations 001–007. No new services, subscriptions, paid AI activation or purchasing communications are introduced.

Download `EtalonOps-pilot-update-v9.zip` using **Download raw file**, upload it to the original authenticated Azure Cloud Shell, and run this line once:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v9.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Preserve the existing dependencies, data and `.runtime/azure-deployment.json`. The guarded updater validates the existing subscription/app/identity, builds, verifies forward migrations, updates the existing pilot only and checks release `catalog-readiness-v9`. Temporary exact-IP SQL access follows the existing cleanup guard.

After deployment, use [the demonstration runbook](DEMONSTRATION_RUNBOOK.md). Real Microsoft reload restoration, second-user isolation and deployed recovery acceptance remain required. Development has no authenticated Azure session and does not claim to have installed this update in the live pilot. Use forward fixes rather than rolling back to versions without submitted-request locks or access-revocation checks.
