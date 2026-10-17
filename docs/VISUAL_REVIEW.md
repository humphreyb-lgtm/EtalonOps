# Frontend visual review — milestone B

**Update:** the owner approved the desktop/mobile screenshots. This page preserves the original frontend-only review evidence. See [the database milestone](DATABASE_MILESTONE.md) for the implemented local API, current validation and remaining Azure SQL/authentication work.

Architecture and the local frontend milestone were approved in chat. This milestone implements the interface with fictional fixtures and browser-local draft storage. No Azure provisioning, authentication changes or DNS edits were performed.

## Interactive preview

Download [EtalonOps-preview.html](../artifacts/EtalonOps-preview.html) and open the downloaded file in a normal browser. It is a self-contained copy of the actual React application with all styles and icons embedded. Use a phone-sized browser window or the phone itself to review the responsive layout. The source application is also runnable using the commands in [README](../README.md).

The managed development browser blocks `file://` navigation by policy. The artifact is tested unchanged through an HTTP response, with no external asset requests, including add, save and reload. Opening the downloaded file on an unmanaged device remains a manual check. Some browsers restrict file-origin storage; such failures are shown without discarding on-screen items. Do not use sensitive project information in this local preview.

## Compare these states

| State | Desktop, 1440 px | Phone, 390 px | Narrow phone, 320 px |
| --- | --- | --- | --- |
| Catalog results + populated MRF | [Screenshot](../artifacts/screenshots/1440-01-database-results.png) | [Screenshot](../artifacts/screenshots/390-01-database-results.png) | [Screenshot](../artifacts/screenshots/320-01-database-results.png) |
| Clarification + Other/free text | [Screenshot](../artifacts/screenshots/1440-02-ai-clarification.png) | [Screenshot](../artifacts/screenshots/390-02-ai-clarification.png) | [Screenshot](../artifacts/screenshots/320-02-ai-clarification.png) |
| Mock suggestions + delivery override | [Screenshot](../artifacts/screenshots/1440-03-ai-suggestions.png) | [Screenshot](../artifacts/screenshots/390-03-ai-suggestions.png) | [Screenshot](../artifacts/screenshots/320-03-ai-suggestions.png) |

Additional captures cover 375, 768, 844 (landscape) and 1024 px. [Actual 200% browser zoom](../artifacts/screenshots/200-percent-browser-zoom.png) is captured separately. Screenshot dates and identities are explicit demo data.

The approved [original references](handoff/reference_images/) establish the light shell, compact navigation, orange mark, project picker, slim header, thin borders, restrained blue actions and square controls. All three originals show clarification despite their names. Other states implement the written brief rather than claiming an unavailable visual target.

Panel gaps are 10 px, with 2–4 px corners and no decorative shadows. The large red miss callout is replaced with a compact neutral status according to the latest written refinements. On phones, navigation becomes a modal drawer; material entry stacks; result and MRF tables become labeled cards. Add, edit/remove and delivery controls remain available without sideways scrolling. Missing product photos are shown honestly rather than inventing images.

## What is implemented

- Separate entered quantity/unit and product/package UOM, with explicit unit confirmation before adding. No unsupported unit conversion.
- Catalog fixture matches for PVC/conduit and tape; both no-match and “None of these is what I want” escalation paths.
- Immediate typed conversation after Other, scripted follow-up replies and clearly unverified mock candidate rows.
- Row-specific Add, protection against duplicate activation, next-material entry, quantity/description/unit editing and confirmed removal.
- Original input preservation, source flags, inherited delivery dates, explicit overrides and reset to Use MRF Date.
- Save/resume in this browser, project-specific local drafts, save/discard/stay choices, corrupt-storage handling and quota/storage-error recovery without losing on-screen items.
- Accessible labels, keyboard focus, semantic structures, live status messages and touch-friendly phone controls.

## Validation and practical limits

Final clean run: **25 passed, 0 failed, 0 skipped** using Chromium and two Playwright workers. Strict TypeScript/production build and single-file preview build passed. A fresh `npm ci` reproduced the installation without changing dependency declarations or the lockfile. `npm audit` reported **0 known vulnerabilities** for this dependency set. There are 21 responsive state captures plus one native-zoom capture. Source files are saved in the repository workspace; they have not been pushed to GitHub or deployed to Azure.

Reusable `install_script` and `start_skill` have been saved successfully in the cloud-environment configuration draft. Saving those fields does not execute them, publish a filesystem snapshot or deploy Azure resources. To retain the prepared environment for future tasks, review/save the configuration in environment settings, then publish the environment. A fresh-task restoration has not been tested.

Tests exercise the intended task behavior, not just viewport shrinking: additions and exact selected candidates, typed follow-up messages, draft restoration, edit/remove, unit ambiguity, delivery inheritance/override/reset, keyboard operation, local-save failures and project switches. Automated axe scans check WCAG A/AA rules in empty, results, suggestions and edit states. Accessibility automation does not establish full WCAG compliance or replace assistive-technology review.

The native zoom test creates an isolated Chromium profile using Chromium's partition-keyed zoom preference. It verifies `innerWidth = 720` and `devicePixelRatio = 2` for a 1440 px browser window before exercising conversation, Add and override controls. This is native browser zoom, not CSS zoom, pinch-scale emulation or a narrow viewport relabeled as zoom.

Mobile tests include Chromium touch emulation and a reduced-height composer interaction. Real iOS/Safari, Android keyboards, VoiceOver/TalkBack and physical-device ergonomics remain untested. There is no claim that reducing height reproduces an actual on-screen keyboard. Long-description captures verify wrapping; assertions check viewport overflow and accessible Add positions.

Microsoft tenant restriction, cross-user draft isolation, persistent SQL search/import, source-backed live AI, image approval/RBAC, cloud monitoring and deployment are not implemented in this frontend milestone. Browser-local demo separation is not a security boundary. No product fixture is a reviewed seed record. Existing production assets remain untouched.

## Next owner decision

Approve this frontend's desktop and phone layout, or identify the visual changes you want. That approval gates substantial backend coupling; it does not authorize paid Azure services or DNS changes. Current price verification and secure Azure authorization remain prerequisites to a separately approved deployment.
