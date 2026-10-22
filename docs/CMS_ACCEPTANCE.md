# CMS v49 acceptance and boundaries

| Requested capability | Implemented behavior | Verification |
| --- | --- | --- |
| Every current page and modal | Registered native mains, dialogs, forms, sections, labels/headings/controls; individual documents and live picker | Inventory AST audit; all seven dialogs listed; actual MRF modal styling and editing browser test |
| Add pages and navigation links | Page CRUD, slugs, public/authenticated/role access, standard/blank shell; ordered/nested navigation | Browser creates page, nests/drags blocks, saves draft, publishes and opens actual navigation destination |
| CSS-level control | Global/document/block/nested-target CSS, structured styles, responsive and interaction states | CSS safety/scope unit tests; actual input padding and resulting height tested in browser; recovery bypass |
| Movable content modules | Nested containers, source modules, application modules, reusable blocks, palette, canvas and structure drag/drop | Browser palette-to-canvas and canvas move test; tree drag/nest test; reusable block visual editing updates multiple references; recursion and binding validation |
| Rich content and media | Sanitized rich editor; upload/URL/library; normalized images; published public media references | Sanitizer unit tests; browser upload/publication/access test |
| Versioned publishing | Draft, publication, ten prior versions, restore, optimistic concurrency, tenant isolation and audit | Shared SQLite/SQL Server CMS scenarios; draft not live browser assertion |
| Working operational app | Original event handlers, field refs, database bindings and server authorization retained | Original draft, submission, materials, MRF-header, manual-review and search browser regressions |
| Dense responsive authoring | Aligned 29px controls, three-panel desktop, narrow-screen stacking, device canvas | Desktop/mobile screenshot review and 390px bounds/browser check |

Native operational source modules cannot be deleted, duplicated or reassigned to another surface; they may be moved, nested, hidden and styled. This keeps business behavior attached while allowing page layout changes. Authoring controls and recovery are protected from published styling. Dynamic business values are edited through their normal forms, while static source copy is editable in CMS.

New CMS content does not create database schema, executable JavaScript or new business operations. Functional modules use the existing API authorization. PDF templates remain a separate document-design system. These are deliberate application boundaries, not unimplemented page-builder features.

Local verification covers SQLite and the isolated SQL Server test database. Real Microsoft sign-in, Azure deployment and a human visual review on the cloud pilot must be checked after installing the CMS package; local testing does not claim those cloud steps have occurred.
