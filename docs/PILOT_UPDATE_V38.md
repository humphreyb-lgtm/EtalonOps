# Document designer v38

This update adds the first editable MRF document designer, company logos, published template versions and automatic output defaults. Existing MRFs and the previous PDF layout continue to work.

## Review the designer

1. Open **Administration → PDF templates**. Select **New template** or open a saved template.
2. Set a name, global/company scope, paper size, orientation and margins. Measurements use PDF points (72 points = 1 inch).
3. Work in **First page**, **Continuation page** or **Repeating item rows**. Drag fields from the left toolbox into a cell, or select a cell and click a database field. Use the right properties panel to change content, typography, alignment, borders, row height and column width.
4. Ctrl/Cmd-click or Shift-click cells to select a rectangle. Merge or split cells with the toolbar. Merging protects existing content: clear extra populated cells first. Undo/redo supports layout edits.
5. Keep one MRF items area on each page layout. Design the repeating item block once; the renderer repeats it and continues onto the continuation layout as needed. Page counts are calculated automatically.
6. Upload a company logo in the preview section or the company's administration form. PNG, JPEG and WebP up to 5 MB are accepted. Logos keep their proportions; adjust their cell and image scale.
7. Save the draft and use **Preview fillable PDF**. Sample data includes 20 items; an accessible MRF draft can also supply preview data.
8. Publish the template, then save its site, company or job assignment. Only published templates can be assigned. Job overrides company, and company overrides site.

Site administrators manage global templates. Company administrators manage their own company's templates and can use published global templates. Global templates are shared across companies within the site.

## Output behavior

PDFs contain actual AcroForm text fields and checkboxes, with selectable read-only/editable settings. They are not flattened. Each submitted MRF retains the published template layout/version and company logo reference used at submission; later edits and logo changes do not replace that saved selection. Old submissions without a designer template retain their original PDF layout.

Quantity and unit appear together. Item task codes are blank when absent or equal to the MRF default; different item codes print as overrides. No-substitution items are red and have checked PDF checkboxes. Uploaded product photos are embedded when available. A preview using sample data has no product photos.

This first version uses standard PDF fonts (Helvetica, Times and Courier), point-based sizing controls and a desktop-oriented grid editor. Image placement preserves proportions. Review long text and continuation pages in the PDF preview before publishing; an item that cannot fit is reported instead of silently cut off. Existing starter PDF settings remain under a collapsed section for the fallback layout.

## Deployment

Run the source-only v38 update with the existing `scripts/update-cloud-app.sh`. Migration 014 creates template/version/default and logo-reference tables and applies restricted runtime grants. No new Azure resource or paid AI request is required. Existing private image storage holds logos.

Expected health release: `document-designer-v38`.
