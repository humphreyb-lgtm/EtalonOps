# Lookup context and reviewed catalog administration

Historical milestone: subsequent image review, stricter shorthand matching and guarded model clarification are documented in [Images and AI](IMAGES_AND_AI_MILESTONE.md). Live AI remains disabled.

## Implemented while Azure quota is pending

The owner accepted direct Azure model calls backed by EtalonOps' reviewed catalog and application-owned context, rather than adding a separate agent service. The earlier Bing grounding price is an illustrative agent-tool meter, not a verified external-search API for this direct-call design. Do not add an agent service just to reuse that estimate; verify a compatible search service and its full cost/terms before enabling it. Saved catalog aliases already participate in ranked matching. Searches, conversations, item selection and description fallback do not create verified translations. Controlled initial dataset imports remain an explicit admin action; ongoing reconciliation remains outside this POC.

The clarification UI now starts from the original request, preserves user answers when switching options, asks one missing fastener detail at a time and handles “not sure” without inventing specifications. A small deterministic context preparer recognizes explicit thread, length and finish wording. It is **not** a live model, comprehensive natural-language interpretation, product discovery or persistent company-preference service. It does not assume a diameter from a screw-head size or label arbitrary application wording as a thread. Unparsed replies remain in the transcript and fallback instead of becoming numeric product facts. Corrections and later answers can replace previously unspecified details.

“Use My Description” now includes the user’s clarification replies. The foreman can review/edit the exact description before adding it, or restore the conversation wording. Edits are preserved until the next lookup; the original input, explicit quantity/UOM and source remain separate in saved drafts. Fallbacks are limited to 2,000 characters to match the API contract, without silently truncating the request. Verified candidate descriptions stay canonical. Quantity/package conversions are not inferred.

The new Catalog administration dialog is shown only after the API identifies an Admin role and every endpoint independently enforces that role. It supports bounded CSV upload/paste, record-level preview, aliases/requested and product UOM/source evidence inspection, errors/conflict reporting, explicit review confirmation, apply, active-catalog export, 50-batch history and separately confirmed rollback. Editing/replacing CSV invalidates its preview and review checkbox. Fixtures are labeled in local mode and cannot be applied in cloud mode. Approval does not approve any images. There is no foreman “teach a translation” button or automatic mapping growth.

Both SQL Server and SQLite provide tenant-scoped admin history. No schema changes or migration checksum edits were required. Rollback deactivates the imported materials; existing MRF references are retained. This remains an initial reviewed-seed workflow, not a general product correction/editing system. The production catalog stays empty until actual source-backed data is reviewed and imported; test fixtures are not that dataset.

## Azure continuation

Support request **2610170040001486** is open for East US B1 quota 0→1. The owner’s Cloud Shell build and 8 original backend checks succeeded, then ARM preflight stopped with `SubscriptionIsOverQuotaForSku` before paid service deployment. The pilot Entra registration and marked resource group may already exist. Do not recreate them or infer that a web app/database is live.

The deployment script now handles both current `NODE|24-lts` runtime-table output and legacy `NODE:24-lts` output. Nested ARM `resourceId` dependencies use separate parent/child name arguments. If an ephemeral Cloud Shell loses local state during the quota wait, the script recovers only one exact, marked pilot identity with the expected audience, redirect, roles and scope and no additional credentials/permissions. Ambiguous or changed identities stop without adoption. Credentials are never reconstructed or printed.

Preserve `.runtime/azure-deployment.json` if it is available. Once quota is approved, use the refreshed deployment package while retaining existing deployment state. Do not overwrite the project directory while deployment is running. No new spending scope, DNS change, security-policy weakening, live AI call or existing MaterialsManagement resource change was needed for this milestone.

## Verification and remaining work

Verification includes 34 Playwright tests against the SQL-backed API, including two sizes of the admin flow/accessibility/focus restoration, foreman denial, context retention across option changes, unknown answers, edited fallback persistence and original input. Backend tests cover tenant isolation, preview/state transitions, request authorization and context parsing; actual SQL engine tests include admin history isolation. Generated-template tests cover approved SKU/security scope, nested dependencies, CLI runtime formats and strict identity recovery.

Screenshots `390-catalog-admin-preview.png` and `1440-catalog-admin-preview.png` under `artifacts/screenshots` capture the new admin dialog. The existing compact layout, mobile cards, keyboard navigation and native 200% zoom checks remain in place. The standalone preview has the updated clarification flow; catalog administration requires the API and is intentionally absent in an offline file.

Pending: actual B1 deployment/quota resolution, real Entra browser acceptance, managed-identity SQL/Blob access and Azure recovery checks; live direct-model integration with bounded persistent usage accounting and verified external-search service costs; a reviewed real catalog; image asset validation/storage and admin image review. Those capabilities are not established by local UI tests. The image metadata table and private Blob infrastructure are foundations, not an implemented image-review workflow.
