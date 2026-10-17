# West US 3 pilot checks — October 17, 2026

The owner ran validation-only checks through authenticated Azure Cloud Shell. A Linux B1 plan check and then the full existing pilot template, with regional resources changed from East US to West US 3, each returned Succeeded. This is preflight evidence, not deployment, a capacity reservation, or live application acceptance. Existing production deployment scripts still default to East US; do not run them expecting a regional change without adapting and testing that path.

Owner portal screenshots showed Linux B1 at USD 12.41/month and Basic SQL (5 DTUs, 2 GB) at USD 4.90/month in the West US 3 configuration.

Additional public retail rates were retrieved directly from the official Azure Retail Prices API; complete filtered results and meter IDs are in [saved evidence](pricing/westus3-retail-rates-2026-10-17.json). Consumption rates, USD:

- General Block Blob v2, Hot LRS: $0.0184/GB-month at the first capacity tier; $0.05/10K writes; $0.004/10K reads; $0.05/10K list/container-create operations.
- Log Analytics, Analytics Logs: $2.30/GB paid ingestion tier. The rate card also lists a free first tier, conservatively ignored because allowances may be shared/consumed elsewhere. Additional retention is $0.10/GB-month where chargeable; the pilot uses 30-day workspace retention.

For the same earlier light-use assumptions (1 GB of total retained Blob data including versions/deletions, 10K writes, 10K reads, 1K list operations, 1 GB monthly log ingestion), estimate:

| Component | USD/month |
| --- | ---: |
| Linux B1, one instance | 12.41 |
| Basic SQL, one database | 4.90 |
| Blob capacity/operations allowance | 0.08 |
| Analytics log ingestion allowance | 2.30 |
| Subtotal | 19.69 |

Retain the approximately $25/month base planning estimate to allow for usage variation, before tax, extra outbound transfer and backup/retention overages. This is not a fixed bill or hard cap. The existing template's $30 monthly group budget is an alert threshold, not a spending limit. Existing unrelated subscription charges remain additional. Live AI/search remain disabled and excluded from this base quote.

No services, subscriptions, paid model calls or DNS records were created by these checks. This document is evidence, not financial authorization. The owner requires express approval before new spending commitments. Confirm the proposed regional deployment scope with the owner before provisioning; preserve Entra-only identity, private Blob access, SQL managed identity and existing MaterialsManagement resources.
