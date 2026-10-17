# EtalonOps — MRF Builder

MRF Builder proof of concept based on the approved V2 handoff. **Frontend visuals approved; local SQL Server and SQLite implementations tested.** The owner created the pilot identity/resource group in Cloud Shell; paid hosting is blocked by B1 quota. No DNS records were changed. See [SQL Server setup/validation](docs/SQL_SERVER_MILESTONE.md), [import tools](docs/DATABASE_MILESTONE.md), and [verified retail pricing](docs/COST_UPDATE.md).

## Try the preview

Download `artifacts/EtalonOps-preview.html` and open the downloaded HTML in a normal desktop browser. It contains the application, styles and icons in one file; no Node installation or cloud account is needed. Browser policies may restrict opening HTML files or local storage. The managed development browser blocks `file://`, so automated tests validate the unchanged single-file document over a local HTTP response with no external asset requests, rather than claiming a successful file-opening test.

1. Click **1" PVC** under “Try a demo,” then **Find Matches**. Choose a quantity unit before adding. Product UOM is separate; no feet/stick conversion is assumed.
2. Click **Next material**, enter `200`, `EA`, and `self tappers`, then **Find Matches**.
3. Select **Other / none of these** and type “I need the black screws we use to mount devices to electrical boxes.” Send the message, ask a follow-up, then add either mock candidate. **Use My Description** preserves your original wording instead.
4. Edit/remove a line. Change one line to **Item Delivery Override**, change the main date, then reset the line to **Use MRF Date**.
5. **Save as Draft**, open the DM session button, **Leave demo**, and **Resume demo**. Saved lines and date choices return in the same browser. Project switching offers to save unsaved changes.

All product names/specifications are fictional fixtures, not verified manufacturer facts. Photos are deliberately absent until approved or lawfully sourced. The assistant is scripted. “Catalog fixture” demonstrates the verified-result layout; it does not assert real verification. No supplier selection or submission workflow is implemented.

The downloaded preview uses browser-local storage with one mock foreman identity. It is not Microsoft authentication, secure ownership isolation, a database, cross-device persistence or a production service. Do not enter sensitive project data. These standalone drafts are scoped to the browser and file/site origin; moving/renaming an offline HTML file may change its storage context. Clearing site data can delete them. The optional API-backed mode has separate database persistence, documented in the database milestone.

## Develop

Node 24+ is required for the local SQLite API; this environment was validated with Node 24.19.0 and npm 11.9.0. Use the existing isolated `/workspace/EtalonOps` checkout; do not create a worktree unless requested.

```bash
cd /workspace/EtalonOps
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run dev
```

Vite uses port 5173. Use local browser validation inside the development environment; no public preview deployment is created. The cloud onboarding UI does not expose loopback URLs as preview links. The HTML artifact and captured screenshots provide the owner review path without Azure provisioning.

```bash
npm run build
npm run build:preview
npm run test:server
npm test
npm audit --cache /workspace/.cache/npm
```

`npm run build` runs strict TypeScript checks and the production build. `npm run build:preview` regenerates the single-file review artifact from the same React source. Run it before tests after source changes, because the test suite also checks that artifact. Tests start isolated API/frontend services on ports 3002/5174 using a separate fixture database. The Playwright configuration uses `/usr/bin/chromium` when installed; on another machine install Playwright Chromium with `npx playwright install chromium` and its documented OS dependencies. Do not disable browser policies to make tests pass.

## Review and implementation

- [Visual review and evidence](docs/VISUAL_REVIEW.md)
- [Architecture, security, schema and cost proposal](docs/ARCHITECTURE_PROPOSAL.md)
- [Original V2 kickoff](docs/handoff/CODEX_KICKOFF_V2.md)
- Original screenshots: `docs/handoff/reference_images/`
- Current responsive captures: `artifacts/screenshots/`

The three provided screenshots all depict the clarification conversation despite their filenames. The interface follows their shared shell and styling; additional result and populated-item states follow the written requirements. The written refinements take precedence: sharp 2–4 px corners, thin dividers, compact panel gaps, no large colored banners, and practical phone controls.

Desktop/mobile visual approval was received. Both local SQL Server and SQLite persistence, draft ownership checks, deterministic translator search and admin import APIs are implemented and tested. Image administration and a guarded direct Azure model client are now implemented; see the [image and AI milestone](docs/IMAGES_AND_AI_MILESTONE.md). Real Microsoft sign-in, live managed-identity integrations and Azure hosting acceptance remain pending. Pilot spending is approved within the scope below; DNS requires separate approval. The downloaded HTML remains the standalone demo, not the database application.

## Approved Azure pilot deployment

The owner approved the approximately $25/month base pilot and illustrated AI usage costs on October 17, 2026 (roughly $30/month combined planning estimate, not a cap). AI remains disabled until its complete service-chain cost is verified within that scope; DNS still needs separate approval. Existing MaterialsManagement resources remain outside this deployment. See [Cloud Shell deployment instructions](docs/CLOUD_DEPLOYMENT.md) and [pricing assumptions](docs/COST_UPDATE.md).

The cloud launcher (`npm start`) requires explicit Entra configuration and Azure SQL managed identity. It never enables mock sign-in or imports fixtures. The local launcher remains `npm run api` with the documented local configuration. Source/build tests do not establish a live Azure deployment or real Microsoft sign-in.

The [lookup/context and catalog administration milestone](docs/LOOKUP_AND_CATALOG_MILESTONE.md) adds context-aware clarification, editable fallback wording, explicit admin CSV review, export and rollback. It is tested with both repositories. The [next milestone](docs/IMAGES_AND_AI_MILESTONE.md) adds image review and optional model clarification, with live AI still disabled. Azure B1 quota support request `2610170040001486` remains the cloud hosting blocker.
