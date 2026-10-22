# EtalonOps content management

Release `cms-suite-v49` replaces the earlier appearance-only v49 package.

## Open the editor

Sign in as the site administrator and open **Administration → Content management**, or visit `/cms`. The dedicated route opens the full-screen editor. Company administrators and other roles keep their existing operational permissions; site design and publication require the system Admin role.

The editor has a common ribbon, a structure/palette panel, a device-sized preview and a properties panel. Desktop, tablet and mobile overrides are independent. Empty style controls inherit the current website styling.

## Existing pages and dialogs

Use **Document**, **Find any surface**, or **Pages & modals inventory**. The inventory includes every current native main, dialog, form, section, header, sidebar, navigation and footer, plus individually editable headings, labels, buttons and other text surfaces. There are 1,118 registered native surfaces, including all seven dialogs. “Core surfaces” is the initial inventory filter; select another type or “All” to see granular text and control surfaces.

Choose **Live screen** to navigate the actual read-only application and open its dialogs. Select an element in the preview to locate its document/block. Choose **Layout canvas** to arrange an individual surface without navigating the application. Dynamic data uses clearly marked placeholders in the layout canvas; the live screen shows real data.

Original application controls remain bound to their handlers and database fields. Their source modules can be moved, nested, styled or hidden, but must occur exactly once in their own surface. This prevents accidentally deleting a save action or duplicating an input. Static source labels and headings can be rewritten; dynamic material descriptions, account data and other business values remain managed by their operational forms. Put additional content inside new containers; use grid/flex properties to arrange it. Drag palette items into the preview, or drag existing preview blocks into another container. Drop onto a container to nest; drop above or below a block to insert beside it. The structure tree also supports drag into a container, insertion before another block and move up. Keep Select elements enabled while arranging content; switch it off to navigate the live read-only application.

## New pages, navigation and reusable content

1. Select **New page**, set its title and URL slug under **Page settings**, and choose public, authenticated or selected-role access.
2. Choose the standard site shell or a blank page. Add containers, headings, text, rich text, images, links, buttons, dividers and navigation blocks. Containers support nested layouts. Functional application modules, such as Materials or MRF Builder, can be placed on pages while preserving their original permissions and behavior.
3. Use **Navigation** to add a destination, change labels, order links, nest submenu entries and limit visibility by role. A page does not automatically become a navigation link. Deleting a page requires removing or changing navigation references before saving.
4. Select a content block and **Make reusable**. Insert references from the reusable palette. **Reusable blocks → Edit visually** updates all references. Finish with **Save reusable block** or cancel before publishing.

Navigation visibility does not grant access to an application module. Server authorization continues to apply. Recursive layouts and modules nested inside other forms are rejected with an explanation.

## Styling and CSS

Use **Global styles & CSS** for shared typography, field/button spacing, colors and layout selectors. The normal, hover, focus and disabled states each support desktop/tablet/mobile values. Field padding controls also release the inherited minimum height so reducing padding can actually make a field shorter. An explicitly set height still takes precedence.

Each document and block has custom CSS. **CSS target** can select an inner element: use `&` for the selected block itself or a selector such as `& input`. The live picker can derive a target from a nested element. Properties include layout, positioning, widths/heights, flex/grid, spacing, typography, borders, backgrounds and effects. Advanced CSS supports custom properties, media queries, keyframes and HTTPS fonts/images. CSS is scoped to the website and excluded from the authoring controls, so a design change cannot restyle the recovery editor. Rich content is sanitized; scripts and unsafe CSS are rejected.

## Images

Choose an HTTPS image URL, upload an image in block properties, or use **Media library**. Uploads are normalized to WebP and stored per tenant. A new upload accepts up to 5 MB; the normalized asset must fit the 2 MB storage limit. Use meaningful alternative text. Images in public published pages are publicly readable; unpublished/private assets require authorized access. Images used by a draft, publication or retained version cannot be deleted.

The legacy global text-style defaults leave the compact PDF designer controls unchanged; use the CMS surface controls or scoped CSS for deliberate PDF-editor appearance changes.

The CMS media library supplements the existing material/product image system. It does not change catalog image precedence or replace the separate PDF template/logo controls.

## Drafts, publication and recovery

**Save draft** preserves work without changing the live website. **Publish site → Confirm publication** saves the current complete draft and makes it live together, including pages, navigation, reusable blocks and CSS. Saving checks for another administrator's version to avoid silently overwriting it. Undo/redo applies to the current editing session. The last ten replaced publications are retained under **Versions**. Load a version into the editor, review it, then publish to restore it. JSON export/import provides a portable site-design copy.

`/cms?cmsRecovery=1` opens the protected editor with default application layout and styling. It still requires ordinary administrator authentication. Use it to reload or restore a working version if a publication hides operational content. Recovery does not delete MRFs, materials, accounts or templates.

## Source maintenance

`node scripts/register-cms-surfaces.mjs` registers native application surfaces and regenerates `src/cms-inventory.ts`. Keep existing surface IDs and source bindings stable. New application modules require a palette declaration, renderer and server owner mapping. Run the inventory audit and browser regressions after native JSX changes.

Migration 018 adds tenant-scoped CMS settings and media tables. Existing migration checksums remain authoritative; applied migrations are skipped, and only missing migrations execute. No Azure resources, AI providers, paid discovery settings or user role grants are changed by the application update.
