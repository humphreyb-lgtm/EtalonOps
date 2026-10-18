# Existing pilot application update v2

This update targets the existing West US 3 pilot after the SQL identity v2 repair. It adds no services, pricing-plan changes, migrations or paid AI activation.

Changes:

- Session restoration within the browser tab and selected-project restoration on reload.
- Correct cloud wording and signed-in user initials; cloud administration hides the old fixture-only importer.
- Paged material browsing, translation provenance, image reference and restriction histories.
- Structured import record review, persisted batch history, source CSV restoration, apply/rollback after reopening, and duplicate-identity checks before apply.
- Material specifications and source evidence visible alongside independent review controls.
- Material-specific manufacturer/part rule editing plus entire-job/category manufacturer editors. New rules remain inactive unless explicitly activated.
- Explicit fractional-inch entry, keeping actual spread separate from nominal spacing.
- Versioned catalog relationship snapshot export, including inactive/provenance records but excluding image bytes.

## Applying the prepared update

Download `EtalonOps-pilot-update-v2.zip` from the repository's preview-download branch and upload it to the owner's Cloud Shell. Use the original `etalonops-westus3` deployment directory containing dependencies and `.runtime/azure-deployment.json`:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v2.zip" -d "$HOME/etalonops-westus3" && bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

The runner verifies subscription, tenant, existing app and managed identity, builds using existing dependencies, deploys the runtime ZIP to that app only, and checks health and anonymous API denial. The source patch and runtime packaging use explicit allowlists; credentials/state are not included. Database contents and image files are not replaced. Do not rerun infrastructure provisioning for this application update.

## Acceptance still required

After deployment, sign in once, change and save the Northside delivery date, reload in the same tab, and verify the office/date are restored without a fresh sign-in prompt when organizational policy permits. Repeat for Riverside to check independence. Use a reviewed pilot dataset for cloud import and image acceptance; automated fixtures are fictional and were not loaded into Azure.

Local validation covers production/type builds; backend and real SQL Server relationship/permission tests; browser workflows at mobile and desktop sizes, accessibility, offline preview and 200% zoom; and existing deployment guards. These checks do not substitute for real Entra session restoration, a second authorized user, Azure Blob review, or cloud recovery acceptance. This workspace's outbound proxy denies the Azure app URL, so an attempted direct health check could not establish live readiness here.

Live web discovery remains unconfigured and disabled. Selecting/activating paid providers needs express cost approval. Search indexing and large snapshot paging beyond the documented pilot bounds remain scale-dependent follow-up work. Purchasing readiness checks do not submit an order.
