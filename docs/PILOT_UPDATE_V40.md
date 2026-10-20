# Grid interaction v40

## Blank template borders

New blank templates start with **no printed borders** on either page or the repeating item block. Faint dashed editor guides remain visible. Empty cells created by adding rows/columns, splitting a merge or moving a cell inherit the blank grid's borderless default. Existing saved templates retain their formatting.

## Select and move

Hold the primary mouse button down in a cell and drag across the grid to select a rectangle, then release. Selection expands to include any merged cells it touches. Ctrl/Cmd-click still adds/removes cells, and Shift-click extends a rectangular selection.

To move a cell, select it and drag the small **↕ move handle** in its upper-right corner to an empty destination cell. The destination marks the moved cell's upper-left corner. Merged dimensions, content, image/field settings and formatting travel with the cell. The source is refilled with empty cells. Moves stay within the current page or repeating-item grid. Moves outside the grid, onto populated cells or across part of another merged destination cell are rejected without losing content. Split an empty destination merge first if necessary. Undo/redo applies to moves and merges.

## Repeating items from page one through overflow pages

1. On **First Page**, select a rectangle of empty cells where the items should begin. Click **Set items area**. The selected cells merge into one repeating-items area. Its full height is available for complete item blocks and their column header.
2. On **Repeating Item**, design a single item's row or rows. Insert Item description, Quantity / UOM and any manufacturer, image, task-code or other item fields required. This block repeats automatically for each item.
3. On **Continuation Pages**, select another rectangle and click **Set items area**. Keep room for any compact header and footer you want on later pages.
4. **Preview fillable PDF** with sample data or an accessible saved MRF. Items start in the first-page area; remaining items automatically continue in the continuation area over as many pages as necessary. A complete item block moves to the next page when it does not fit; it is not split in half. Pages share the same repeating-item design.

The toolbox's MRF items table can still be dragged into an already merged area. There is one items area per page layout. Setting a new area clears the previous area's items marker without deleting its grid. The page layout must provide at least 60 PDF points of items height before publication, and a complete item must fit the continuation area. Use **How repeating items flow across pages** above the canvas for an in-app guide.

No new database migration, Azure resource or AI call is required. Expected health release: `grid-interaction-v40`.
