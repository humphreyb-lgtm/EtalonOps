# EtalonOps — MRF Builder POC | Codex Kickoff V2

**Supersedes:** `CODEX_KICKOFF.md` for this standalone exploratory proof of concept. Use this document and the three PNGs in `reference_images/` together. If prior mockups or briefs conflict, the **latest explicit rules in this document prevail**. Do not edit existing Etalon Ops systems, live materials-management workflows, production databases, or Power Automate flows.

**Website:** `EtalonOps.com` (GoDaddy DNS); proposed POC URL `dev.etalonops.com`. Do not change DNS without owner approval. Preserve mail and existing DNS records.

## 1. Your mission and working arrangement

You are the primary architect, frontend/backend engineer, database designer, Azure/DevOps implementer, security engineer, tester and technical writer. **Minimize owner effort.** Execute work directly when connected tools/permissions allow. Interrupt the owner only for secure sign-in/MFA, sensitive values entered through provider-approved secure workflows, explicit spending/DNS/destructive-action approval, or unresolved customer-facing workflow decisions. Never ask for passwords, MFA codes, access tokens, private keys or secrets in chat. Never store secrets in repositories or logs.

**First action: architecture and cost proposal.** Before any billable provisioning, domain changes, or broad permissions, show exact resource/SKU/region, expected idle and light-use monthly costs with assumptions, alternatives, authentication/security implications, rollback and specific owner action. **Wait for express approval** of these steps. After approval, work autonomously in verifiable milestones. If you lack authorization to perform an operation, give the shortest exact login or click path, then continue.

## 2. Design reference files — binding visual targets

The delivered ZIP contains three actual, latest screenshots:

- `reference_images/01_database_results.png` — verified translation results.
- `reference_images/02_ai_clarification.png` — no-match / conversational clarification including “Other / none of these.”
- `reference_images/03_ai_suggestions.png` — sourced AI material suggestions, per-row `+ Add`, and one MRF line with delivery override.

**Treat these as a design system and visual acceptance references**, not as static backgrounds. Reimplement as semantic, accessible, responsive components; do not use screenshots as the UI. Keep the consistent EtalonOps branding, project selector, compact left navigation, white/light-gray workspace, restrained blue actions, thin table dividers, small legible typography, and minimal iconography. No heavy dashboard aesthetic, dark left sidebar, broad cards, exaggerated shadows, or right-side Request Summary. Do not copy fictional demo product numbers as real catalog facts. Sample names/dates are *mock data only*.

**Latest visual refinements are mandatory:**
- Reduce gaps **between major content panels** versus earlier screenshots; use compact vertical rhythm without crowding content.
- Reduce corner radii across outer panels, fields, messages, buttons, dropdowns and tables. Aim for subtly squared corners (roughly 2–4px standard controls; allow a little more where justified).
- Use thin neutral borders/dividers, restrained active-row highlights, no large decorative colored callouts.
- Maintain practical, readable touch targets despite visually compact density.
- Have the owner approve a runnable frontend preview compared side-by-side to all three references before significant backend coupling.

## 3. Responsive web design — required, not optional

Implement **mobile-first responsive web design** using CSS Grid/Flexbox and tested breakpoints based on content, not one hardcoded desktop resolution. One codebase must support desktop, tablet and mobile in portrait/landscape, including at minimum 320px, 375px, 390px, 768px, and 1440px viewport checks. Do not use fixed desktop widths or allow primary task content to overflow the viewport.

**Mobile behavior:**
- Sidebar collapses to an accessible menu; navigation remains usable.
- Foreman, default MRF delivery date, and Save as Draft remain reachable near the top.
- Quantity/description inputs stack cleanly; Find Matches is prominent.
- Results tables collapse into readable product cards with image, description, specs, UOM and a clearly labeled `+ Add` control; **no tiny desktop table or mandatory sideways scrolling to find Add**.
- “None of these is what I want,” “Other / none of these,” free-text AI messaging, follow-up questions, and “Use My Description” work comfortably with an on-screen keyboard.
- MRF Item List becomes editable item cards on phone; each includes quantity, UOM, description, per-item delivery date (inherit or override), edit/remove action.
- Buttons and interactive targets target at least ~44×44 CSS px on touch devices where practical; keyboard focus is visible; semantic labels and screen-reader support; avoid reliance on hover.
- Validate at 200% browser zoom and with long descriptions. Use locale-appropriate date entry and avoid keyboard obstruction of the conversational input.

Capture responsive screenshots and test mobile flows in automated browser tests. Do not mark responsive work complete solely because the page shrinks.

## 4. Foreman-facing POC scope

**Header:** page title `MRF Builder`; slim horizontal area for **Foreman** and overall **MRF Delivery Date**; upper-right **Save as Draft**. On phone use compact stacked layout. Foreman may come from signed-in profile; do not invent an identity as production data.

**Item entry:** Foreman adds **one material at a time** with Quantity, Description, Find Matches. Preserve both raw input and resolved material/UOM. Search existing verified translation data **first**. Show plausible ranked verified matches with description, any approved product image, UOM and useful specifications; do not include supplier/merchant selection — Purchasing chooses supplier later.

**Database miss:** If results are unsatisfactory or user clicks **“None of these is what I want”**, enter the same AI clarification flow. Ask **“Are you looking for…”** with short options. If `Other / none of these` is selected, provide **conversational free-text input immediately**. Preserve context and permit continued ordinary-language clarification, then run material/product discovery and show sourced candidate items with real product photos when possible. Never hallucinate part numbers or product details; show unavailable data honestly.

**Suggestion selection:** Each result row/card has a compact **`+ Add`** control that appends the selected result as a line in **MRF Item List** (the MRF itself). The mockup may also depict radio selection; define one consistent interaction where clicking Add operates on its own clearly identified row/card to avoid ambiguity. After add, allow next entry without losing existing list. Provide item edit, quantity correction and removal. **No separate full-page “Add to MRF” action and no Request Summary sidebar.**

**Fallback:** If AI still cannot find the requested item, user clicks **“Use My Description.”** Add the original or user-edited text and quantity as an MRF line without creating a translation record.

**Delivery logic:** Overall MRF Delivery Date is the default for every line. Each line may specify an **Item Delivery Override**. Changes to default affect inherited lines, not explicitly overridden dates. A clear action returns an item to `Use MRF Date`. Persist these distinctions (not only a copied effective date).

**Drafts:** Save as Draft persists header and all lines, original inputs, resolution/source flags, quantity/unit information and dates. Resume after logout/new session; enforce per-owner access. A separate submit/approval workflow, purchasing workflow, PO import/reconciliation, emails and PDF generation are out of scope for this POC.

## 5. Translator and initial data strategy

Codex owns technical design of schema, search/matching/ranking, aliases/synonyms/fuzzy matching, indexing, normalization, AI prompts and retrieval technology; owner controls business behavior. Keep verified translations clearly separate from unverified AI discovery. Do not automatically insert verified mappings from foreman searches, chat, AI results or “Use My Description.” Later PO-to-MRF reconciliation is the intended path to grow verified translations, **not part of this POC**.

Units matter: `1000` and `1" PVC` do **not** by themselves prove feet vs sticks. Preserve entered quantity, explicit/inferred/requested UOM and any product/package UOM separately; ask concise clarification rather than silently assuming conversion. Calculate only defensible conversions with supporting basis. The screenshots' “1000 FT” is illustrative, not a blanket conversion rule.

Design migrations + schema + an idempotent CSV import/export contract, review/dry-run, duplicate/conflict reporting, safe rollback and sample test fixtures. **Build schema before preparing an initial 150–250-item reviewed dataset.** Do not present AI-generated guesses as verified. Admin may approve controlled initial seed data; actual ongoing translation growth remains reserved for future reconciliation. Search must handle electrician shorthand and general construction consumables including tape, fasteners, paint, drill bits, hardware, PPE etc.

## 6. Actual product images and admin-only approvals

Show images from approved internal records for verified matches. AI discovery can display appropriately labeled *provisional*, source-backed manufacturer/catalog thumbnails when lawful to display, with safe missing-image fallback. Do not use synthetic generated product photos as evidence of specific items; wrong pictures are worse than no image.

**Only admins can approve, reject, replace, remove, or permanently associate verified item images**; foremen only view them. Keep provenance, source URL, usage rights, content hash, product association, approval status/reviewer/time and rejected associations to prevent re-suggesting known false matches. Protect uploaded/downloaded assets and enforce image limits and content validation. Approval of a translation does not automatically approve its picture. Allow admins to manage reviewed initial seed imports; do not give a foreman translation-administration powers.

## 7. Microsoft/Azure platform, security, budget and deployment

Recommend a practical Microsoft-based stack; compare Azure Static Web Apps + Functions/API + SQL/other suitable database + Blob Storage + Entra auth + Microsoft Foundry (or lower-complexity equivalents), with current verified pricing/plan details and operating costs. Names here are options, not a mandate. Confirm **tenant-restricted login** and actual auth plan capabilities; the existence of Microsoft login alone does not restrict sign-in to one tenant. Use server-side access checks, resource-level authorization, least privilege, admin RBAC, secrets protection, secure storage, audit history, throttling, error handling, safe AI output handling and reasonable observability. Threat-model prompt injection, poisoned product metadata/images, access control failures and cost abuse. Report tradeoffs; never silently weaken security.

Set cost protection (budgets/alerts, quotas, rate limits and control of model/web-search usage), backup and recovery/rollback paths. Deploy to an Azure-provided temporary URL first, test with designated accounts, then propose `dev.etalonops.com` GoDaddy CNAME/validation only after separate DNS approval. Preserve apex DNS, MX, SPF, DKIM and DMARC; capture current DNS state before edits and verify HTTPS after.

## 8. Requested Codex sequence and approval gates

**A — Architecture only.** Inspect available repository and tenant after secure authorization. Produce design system implementation plan, schema and import contract, service/SKU/region/cost breakdown, auth/role strategy, threat model, rollout/rollback plan. **STOP for approval before costs, DNS or broad privilege changes.**

**B — Frontend visual slice, local/test data.** Deliver real interactive responsive versions of all three screenshots, item addition, conversational UI mocked if needed, default+override delivery dates, and draft save/resume (initially local mock or test DB clearly labeled). Capture desktop/mobile screenshots and request a single visual approval.

**C — Persistent database + verified translator search.** Implement import fixture, ranked match, aliases, no-match, row add, original-input preservation, UOM correctness and authorized draft data isolation.

**D — Conversational AI discovery.** Implement both escalation paths, follow-up question loop, sourced search/product candidates, inline thumbnails, original-description fallback and bounded cost/timeouts.

**E — Admin image review.** Build restricted approve/reject/replace UI, provenance and audit, and ensure unreviewed photos cannot become verified by search activity.

**F — Azure deploy + DNS.** Deploy secure preview, test rights/monitoring/budgets, then request a separate GoDaddy DNS approval and guide owner only where secure interaction requires it.

**G — Dataset review/import and handover.** Generate reviewed seed-data template and candidate list, admin approval process, controlled import, acceptance tests, known limitations, docs, real monthly spending and rollback instructions.

## 9. Acceptance demonstrations (minimum)

1. Desktop / 390px mobile / 320px mobile UI matches the references' intent: compact spacing, sharper corners, no overflow; tabs/buttons work by keyboard and touch.
2. Verified `1" PVC` search shows suitable approved choices; selecting and clicking `+ Add` creates one line and doesn't auto-add duplicates.
3. `self tappers` with no verified translation shows “Are you looking for…?”; choosing Other permits **actual typed conversational clarification**, AI response and refined product suggestions.
4. Clicking `+ Add` on an AI result adds that exact item; `Use My Description` adds the foreman's wording instead; neither writes a verified translation.
5. Overall delivery date carries to inherited lines; one override survives change of main date; reset restores inheritance.
6. Save draft, sign out, sign back in: own material lines and date choices persist; other test users cannot read/edit draft or approve images.
7. Admin rejects a mismatched image; it no longer displays as verified and the association cannot be re-approved implicitly.
8. Error and cost-limit conditions fail gracefully and preserve the MRF draft.

## 10. Reporting and owner workload

At the end of each milestone provide: completed work, URL or preview method, tests passed/failed, resources/cost estimate or actual spend, and **one next owner action** only if absolutely required. Make safe implementation choices autonomously. Raise business UX tradeoffs instead of silently changing flows. No existing EtalonOps or Power Automate assets are to be modified.

**Start with architecture proposal A. Do not provision billable infrastructure or alter DNS until owner approves.**
