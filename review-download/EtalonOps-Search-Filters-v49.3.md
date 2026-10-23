# v49.3 — family browsing and result filters

- “Unistrut” or “strut” browses channels and fittings (297 reviewed strut items).
  “Unistrut channel” remains channel stock. Unqualified “PVC” includes PVC material
  and documented PVC accessories. Product/job restrictions still apply.
- Dense results ribbon: family, part type, channel size group, trade size, finish,
  schedule, construction, thread, stock length, gauge, slot pattern and hole count.
  Options are based on available results and other selected filters. Clear filters
  resets the selection; a fresh search resets filters and page. Results paginate
  25 at a time without truncating the underlying matches at the former 200 limit.
- Documented channel depth determines strut grouping. Owner-approved shallow groups
  cover 13/16 and 15/16 variants under 7/8; 1-9/16 under 1-5/8. Other sizes remain
  explicit. A fitting opening/plate dimension is not assumed to be channel depth.
  Actual specifications, catalog identities and existing MRFs are untouched.
  “Not specified” exposes records without documented depth. A browsing group is
  not a certificate of interchangeability.
- Eight joining fittings (four flat straight splice plates, four splice clevises)
  receive 160 reviewed coupling/coupler/joiner search associations, including size,
  finish and hole count where documented. These terms also derive from structured
  type data for future records without requiring a catalog rewrite.
- The companion owner-run package resolves live Material Keys and adds only missing
  active translations. It retains descriptions, specs, products, images and useful
  translations, rejects disabled phrase reactivation, and verifies protected data.
  Repeated execution is idempotent. No AI or Bing calls.
- Azure deployment disables the unreliable startup tracker; the existing health
  checks still wait for the exact release and verify anonymous API denial.

The phrase CSV and review JSON identify source workbook records and descriptions.
They do not claim to know live Material Keys before owner-authenticated resolution.

Validation: 179 server tests, 71 SQL integration tests, and six browser checks
passed, including mobile ribbon layout, paging, filter reset, coupling lookup and
PVC FA/MA regressions. The existing 666-query strut coverage suite remains passing.
An isolated combined-catalog rehearsal verified all 160 additions, retained 1,169
active materials and existing catalog/image data, and added zero phrases on rerun.
It returned 297 Unistrut items, 54 channels, eight coupling fittings, two shallow
and two 1-5/8 coupling matches; the full PVC family (790 records in that snapshot)
remained available for filtering. Live counts may include later owner additions.
