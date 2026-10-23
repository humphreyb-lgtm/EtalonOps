# v49.4 — focused filters and compact search results

Family defaults to the explicit family in the query, or the highest-ranked result's
known family. Clearing filters restores that family. Family changes clear dependent
choices, part-type changes clear its child filters, and unrelated or empty filters
are hidden. PVC shows part type, trade size, schedule and applicable stock length;
strut shows relevant finish/construction/thread/etc. Conduit size is only offered
for a selected strut conduit-clamp type, rather than confusing it with channel size.

Channel size offers only 7/8, 1-5/8 and 3-1/4 groups. Documented depths within 1/16
of these groups are grouped for browsing. Other/unknown depths do not invent a fit;
they remain visible in unfiltered results and their actual measurements in Details.
No catalog measurements, identities, translations or images are rewritten.

A compact Details button opens complete specifications on hover or click without
expanding the row. The floating panel supports pointer transit, pinning, outside
click, Escape and keyboard dismissal, and stays inside the viewport. Product images
in results open a larger, aspect-preserving modal with native focus management,
Escape, Close and backdrop dismissal. Approved uploaded images retain priority and
the existing authenticated image retrieval and fallback behavior.

The installer is application-only: it verifies the existing owner and app context,
updates the existing app, verifies exact-release SQL health and anonymous API denial,
and records completion locally. It does not run a catalog/translation import or
request temporary image-storage permissions. Existing app runtime configuration,
CMS content and catalog data remain in place.

Validation: 180 server tests (including the 666-query coverage fixture), 71 SQL
integration checks, seven browser checks, and three installer/import checks passed.
Browser checks cover family defaults and switching, irrelevant-filter removal,
row height during specification preview, hover/click/Escape behavior, enlarged
images, responsive controls and lazy image loading. The new image dialog is also
registered in the CMS inventory. Installer checks verify application-only mode
cannot enter catalog/probe/storage steps and reports failed health or newer releases.
