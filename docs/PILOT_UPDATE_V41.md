# Automatic grid and row sizing v41

## Grid rows and columns

Open **Administration → PDF templates**. **Grid rows** and **Grid columns** sit beside the page settings and show the current page/tab's dimensions. New blank pages start at 24 rows and 16 columns. Enter a count and press Enter or leave the field: the grid updates automatically. Limits are 1–40 rows and 2–16 columns. For a dense Letter portrait page, start with 40 rows; plain 10-point text with 2-point padding fits the roughly 18.3-point spacing. Fields with labels or wrapped text need more height.

Changing row count establishes the page's blank-row spacing. Automatic text growth can subsequently reduce the current row count, so the controls always show the actual grid. The first page, continuation page and repeating-item block have independent dimensions. Increasing a grid preserves existing cells. Reducing it removes only trailing empty cells and refuses to cut through content, merged cells or locked rows. Unlock empty rows, or move/split affected cells, before reducing the grid. Changes support Undo/Redo.

## Automatic versus locked row height

Select a cell or a range, then use **Row sizing** in Cell properties:

- **Automatic — fit content:** row height grows to fit text, font size, padding and labels. Merged cells use the combined height of their rows and grow only rows set to Automatic. Automatic rows shrink back toward their blank-row spacing when text becomes shorter.
- **Locked — fixed height:** preserves the selected row heights. Set **Row height (pt)** to an exact value. Long text produces a warning; the system does not silently reduce the font.

The setting applies to all rows touched by selected cells. **Blank row spacing (pt)** sets the grid's baseline for automatic rows, independently of locked heights. New blank templates use Automatic rows. Existing saved templates keep their old fixed layout until rows are explicitly changed to Automatic.

## Staying on one page

Page grids remain within the configured margins whenever sufficient blank space exists. Growth consumes unlocked, unmerged blank rows, starting at the bottom. Shrinking restores blank rows up to the 40-row limit. Content, merged areas, locked rows and specially bordered/colored blank rows are protected. Remaining space can stretch a spare blank row; if no spare row is available, unused space remains below the grid.

If content cannot fit, a highlighted warning explains the problem. Drafts can be saved for correction, but publication and PDF export reject unresolved overflow. No populated ordinary row is dropped, and no extra ordinary page is created. Shorten text, lower font/padding, unlock rows, change margins/paper, or redesign the page to resolve the warning.

Only the repeating MRF items flow onto continuation pages. Their Automatic rows fit each item's real values; Locked item rows keep their exact height and report overflow. Complete items remain together.

## Designer and PDF behavior

The editor sizes static text and reserves a line for fields whose actual value is not yet known. PDF generation rechecks with real MRF values and PDF font measurements, growing Automatic rows from the available blank space. Always preview with a saved MRF to check long addresses, names and instructions. An actual value that cannot fit a locked row or the available page space reports a clear error instead of being clipped or shrinking the chosen font. Browser and PDF font measurements can differ slightly.

No database migration, new Azure resource or AI call is required. The cumulative source update includes earlier migrations for sites upgrading from older versions. Expected release: `automatic-grid-v41`.
