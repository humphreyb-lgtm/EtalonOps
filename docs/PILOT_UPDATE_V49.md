# Pilot update v49 — Website Design Studio

Release: `appearance-studio-v49`.

Adds Administration → Design Studio: a three-panel visual workspace, real read-only preview, component/field selection, MRF section drag-and-drop, responsive layout/spacing/typography/surface controls, saved drafts, publication, undo/redo, ten-version restoration and appearance recovery. Includes 251 registered application component classes. Stable field-container controls separate positioning from the input itself. PDF template design retains its separate settings.

Fixes the global form-padding limitation by separating field height from button height. Saved draft and submitted MRF lists now use dense, aligned tables while retaining their filters, paging and open actions.

Migration 17 adds a tenant-scoped appearance settings table, with runtime permissions assigned by the existing migration process. Existing materials, MRFs, users, templates and images are preserved. Public styling reads return published values only; editing and history require Admin. CSP permits same-origin preview frames while continuing to prevent framing by unrelated origins.

See APPEARANCE_STUDIO.md for use, recovery, current coverage and boundaries. Installation uses the existing source update and cloud deployment script. No AI activation or paid discovery changes are included.
