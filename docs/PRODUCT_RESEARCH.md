# Product research and review

Administration → Product research supports reviewing one manufacturer part or up to 100 candidates from a product family. Live AI research is deliberately unavailable. It performs no web crawling, invokes no paid model and creates no services. A production research provider, request limits and charges require the owner's express approval before activation.

## Available now

Enter a manufacturer/part, source URL or product-family request. Download research instructions and give them to a research assistant outside EtalonOps. The instructions specify the JSON contract and sources required. Upload its JSON results to this page. Page content and results are untrusted data, not executable instructions.

All candidates start unselected. Coverage notes must describe checked sources, omissions and uncertainties. This does not certify a complete manufacturer family. Select products individually or select all, edit their manufacturer title, part number, source evidence, material key, category, dimensions, unit and potential phrases. Name/part variations are deterministic suggestions, explicitly not AI research. Export selected research to retain unsaved edits. Preview selected products to see canonical descriptions and existing-material decisions, confirm review, then add them.

Source URLs establish provenance, not verified truth. Every new material/manufacturer product enters as provisional with AI provenance. Existing records keep their facts. Duplicate specifications share a canonical item; a manufacturer part linked to conflicting specifications stops the operation. Significant construction differences must be included as defining attributes; do not label specialty duct as ordinary conduit. Images and display rights are outside this import.

Adding uses one existing database transaction spanning materials, manufacturer products and translations. Failure rolls everything back. Successful operations produce three normal catalog-history batches, retaining existing audit and rollback controls. Preview makes no catalog additions. Every candidate edit or selection change invalidates the preview; server-side revalidation rejects changed inputs or changed matching decisions. Repeating the same operation is idempotent. Existing rejected translations remain rejected.

## Future live research adapter

This review workflow is ready for provider output, but the live adapter is not implemented or enabled. It must support bounded discovery across manufacturer family pages and linked sell sheets, document exact sources for each specification, report excluded/uncertain candidates, and distinguish complete verified family coverage from partial results. Scope includes manufacturer, category, schedule, dimensions, lengths and end connections; the word “all” alone is not proof of completeness.

Before activating it, approve the provider and spending controls. The implementation must restrict outbound URLs, redirects, response types and sizes; reject private-network targets; treat source instructions as untrusted; apply time/page/item/token limits; record research usage and evidence; and deliver candidates to this review page rather than directly writing catalog records. Do not mark a source AI claim as independently verified. Use category rules to reject incomplete specifications, and never guess a bracket's physical adjustment range from its part number.

The research JSON is not an Excel import format. Existing workbook/CSV imports remain available separately. Workbook 005 is private and excluded from published update packages.
