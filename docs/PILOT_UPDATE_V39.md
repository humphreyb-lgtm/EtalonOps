# Blank template and cell formatting v39

Open **Administration → PDF templates → New blank template**. The first and continuation pages each start with 16 equal columns and 24 equal rows, filling the selected paper's printable area. Current paper, orientation and margins carry into the new blank template. There are no titles, fields, logos or footer text. The repeating-item editor starts with one empty 16-column row so a full page is not repeated for every item.

Merge cells to reserve areas for titles, logos, fields and the MRF items table. Split merged cells to recover the underlying grid. Add/remove rows and columns as needed (up to 16 columns and 40 rows). Changing paper settings resizes an evenly spaced page grid without an items block to stay inside the margins. Save and preview the blank layout at any time. Before publishing, add one repeating-items area to each page layout and an item-description field to the repeating-item block.

Selected cells now support **top, middle and bottom** vertical alignment in the canvas and PDF, including editable PDF fields and proportional images. Labels stay above field values. **All/None** border buttons and independent **top/right/bottom/left** checkboxes control printed borders; border weight is adjustable in PDF points. Faint dashed guides for cells with no printed border appear only in the editor. Formatting applies to every selected cell. Existing templates retain their border settings.

The page tabs sit together on the left of one toolbar; merge/split, row/column and undo/redo controls sit together on the right. The toolbar scrolls horizontally on narrow screens rather than wrapping buttons into several rows. Bold, italic and hide-empty options use a compact horizontal group.

No database migration, new Azure resource or AI call is required beyond the included v38 update. The source-only package includes the cumulative updates. Expected health release: `blank-designer-v39`.
