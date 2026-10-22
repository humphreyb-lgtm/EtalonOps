# Website Design Studio

Open Administration → Design Studio. This controls website appearance; PDF template layout remains in PDF templates.

## Working in the editor

The left panel contains MRF sections, fields on the current preview page, additional registered page components, and shared components. Drag an MRF section onto another to move it before that section. The up buttons provide an alternative. MRF section ordering updates React's rendered order, including keyboard and screen-reader order.

Select an element in the preview or use the left panel. An input can be styled directly or through its field container, which controls the label/input group's position within its parent's layout. Shared components affect every matching instance. Repeated catalog and order rows retain their data and application behavior.

The properties panel groups layout/sizing, spacing, typography, and surfaces/borders. Blank properties inherit the existing application style. Numeric dimensions use pixels; supported dimensions also accept %, rem, em, vh, vw and auto. Grid and flex layouts, gaps, alignment, widths, heights, wrapping, four-side padding/margins and border weights can be adjusted. Explicit widths can exceed their original container; select a percentage or maximum width to contain them. Explicit fixed heights can clip content if overflow is hidden.

Desktop is the base style. Tablet overrides apply at 1024px and below, and mobile overrides at 600px and below. Preview viewports are 1440, 820 and 390 pixels respectively, scaled to the available center workspace. They do not shrink their underlying viewport to fit the editor.

Use the preview-page selector to inspect MRF Builder, Saved MRFs, Materials, Users and access, Catalog and imports, or Manual Item Review. Turn off Select elements to navigate other application screens. The preview blocks data-changing API calls. It uses your current account for read access and does not grant additional permissions.

## Saving and publishing

Save draft retains work without applying it to live pages. Publish appearance saves the current edits and applies them. Existing pages refresh published appearance on focus or within a minute; new pages load it immediately. Undo/redo retain the most recent 40 local edits. Loading a previous published version or clearing overrides changes the draft; publish to apply the restoration. The last ten replaced published designs are retained.

Two administrators cannot silently overwrite one another's saved design. A version conflict requires reloading before another save. Unsaved edits trigger the existing administration-close warning and a browser leave warning.

Recovery: open the normal application with `?appearanceRecovery=1`, sign in normally, and open Design Studio. Recovery bypasses saved global styles and published appearance for that browser page. Load a previous design or reset overrides, then publish. To reset the older Global Design settings, load dense defaults and save them separately. Recovery does not bypass authentication or authorization.

## Current coverage and boundaries

The first studio release includes 251 generated, code-owned component class targets, shared typography/form/table targets, stable input IDs and their containers. Forms without explicit input IDs receive stable label/context styling targets; repeated fields share a target across records. New component classes can be registered with `python3 scripts/build-appearance-components.py` when source components are added. Appearance settings cannot inject HTML, JavaScript, arbitrary selectors or external stylesheets. Color and dimension values are validated, and all persisted changes are audited and scoped to the installation tenant. Drafts and history require system administrator access; the public endpoint exposes only published presentation settings.

Drag-and-drop currently reorders the MRF's existing peer sections. Other components have layout and positioning properties. This release does not create new business screens, insert arbitrary widgets, edit data bindings, or provide unrestricted nesting/freeform dragging of every element. It is an application-aware design editor, not a complete Bricks feature clone. Generic CSS order/grid placement within a form changes visual layout; the tab order follows the form's existing document order.

The older Global Design panel remains the default text-style layer. Design Studio overrides that layer for selected components. Reducing global field padding no longer inherits a minimum height calculated from button styles. Studio field padding/font changes use automatic height unless an explicit height/minimum is supplied.
