# Ribbon designer v42

## Workspace

Administration's PDF template editor now uses almost the full browser window. Compact ribbons group file actions, template/page settings, page layouts and grid actions, and cell formatting. The saved-template selector and neighboring buttons have matching heights. Formatting moves out of the tall properties sidebar; the sidebar keeps cell content/bindings and row/column sizing. Toolbox fields use compact paired buttons, with the relevant groups expanded for the current page or item layout.

**Fit page** is the default zoom. It measures the actual available canvas and fits the complete page inside it. The normal workspace is checked at 1366×768, 1440×900 and 1920×1080 with no outer, canvas or normal-sidebar scrollbars. Smaller windows, expanded optional panels/groups, long validation messages, and manually selected 100–150% zoom can need scrolling; controls remain accessible. PDF point sizes and output geometry are independent of screen zoom.

## Default text size

**Default text (pt)** in page settings sets the template's cell default, from 6 to 48 points. Enter a number and press Enter or leave the field. Empty cells and cells newly created by adding rows/columns, splitting or restoring blank space inherit it. Existing populated cells keep their formatting. New blank templates carry the selected default. Saved templates retain it. Change a populated cell with **Font size** in the formatting ribbon.

## Copy/paste

Select a cell, merged cell or complete rectangular cell range and click **Copy cells**. Select an empty destination's upper-left cell and click **Paste cells**. Merged row/column spans, content, bindings, borders, font and other cell formatting are preserved. Pasted fields get fresh identities. Source cells are unchanged. The destination uses its grid's row heights and column widths, with Automatic rows fitting the copied content.

Copy/paste supports Ctrl/Cmd+C and Ctrl/Cmd+V while working in the designer outside text inputs. Native text copy/paste inside inputs is unchanged. The cell clipboard is held in the current editor session, including across page layouts and templates; it is not the operating system clipboard.

Pasting is rejected when it would overwrite content, extend outside the grid, cut through a destination merge, duplicate a page's items area, put item bindings outside the repeating-item layout, or insert a logo/nested table inside an item. Undo/redo includes paste.

## Wrapping and row behavior

Dynamic values still wrap during PDF generation. Automatic rows grow from available blank page space, and locked rows retain their height. Unresolved overflow reports an error without clipping content or reducing the chosen font. Only repeating items flow onto continuation pages. Preview with real MRF data when checking addresses, instructions and other long values.

No database migration, new Azure resource or paid AI call is needed. Expected health release: `ribbon-designer-v42`.
