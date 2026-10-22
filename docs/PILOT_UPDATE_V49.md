# Pilot update v49 — Full content management

Release: `cms-suite-v49`. Package: `EtalonOps-pilot-update-v49-CMS.zip`.

This package supersedes the earlier `appearance-studio-v49` partial build. Use the CMS package and its matching checksum together.

Adds Administration → Content management and a protected full-screen `/cms` editor. It includes page creation/duplication/deletion, nested drag-and-drop containers, reusable blocks, rich text, uploaded media, navigation/submenus, page/role visibility, desktop/tablet/mobile styles, interaction states, global styles, element/document/site CSS, live read-only preview, draft/publication controls and ten-version history/restoration.

All current native pages, forms, content sections and seven modal dialogs are registered. There are 1,118 native editable surfaces, including labels and headings. Existing modules retain their database bindings, events and authorization. The original MRF and catalog workflows remain operational. A protected recovery route bypasses custom layouts/styles without bypassing authentication. Dense saved-MRF tables and the earlier field-padding correction are included.

Migration 018 creates tenant-scoped CMS settings and uploaded-media storage; migration 017 from the prior v49 remains compatible. Migration runners now skip applied migrations after checksum validation, allowing safe updates from v48 or the partial v49. Existing catalog records, users, MRFs, images and PDF templates are preserved. No AI or paid discovery activation is included.

See [CONTENT_MANAGEMENT.md](CONTENT_MANAGEMENT.md) for use/recovery and [CMS_ACCEPTANCE.md](CMS_ACCEPTANCE.md) for coverage and verification. Install using the existing pilot source-update workflow. The deployment check must report `cms-suite-v49`; a different signature does not confirm this package.
