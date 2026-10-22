# Next revision: manual MRF item review inbox

Status: requested and queued; not implemented in the completed v47 search release.

When a signed-in user adds an MRF line using their own description, retain it as an MRF-only line. Do not automatically create a catalog material, manufacturer product, or translation. Capture an idempotent review event for the site administrator, including the original search phrase, final entered description, quantity/UOM, job, requester, timestamp, and associated MRF/line when available. Saving a draft should provide a reliable fallback if immediate reporting fails. Avoid duplicated events on retries or repeated saves.

Provide an internal Administration → Manual Item Review inbox with an attention badge/count. Keep the layout dense and aligned. Make repeated requests easy to identify, retaining their individual job/requester context. Allow filtering by unresolved/resolved status and job, plus wording search. Existing tenant and administrator access controls apply; ordinary users must not read other users' reports.

Explicit administrator actions:
- Create a new generic material through the normal material-entry/review path, with required specifications and duplicate checks.
- Link to an existing material and explicitly approve the original wording as a search/translation phrase, while checking physical compatibility. Never silently learn a contradictory alias.
- Ignore/resolve the report without changing catalog data.

Keep a resolution reason, reviewer and time. Catalog changes and resolving the report should be coordinated so a failed operation cannot falsely mark work complete. No external email, chat message or paid AI/search call is implied by this internal inbox request.
