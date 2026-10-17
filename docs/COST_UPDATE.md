# Verified retail rates and next Azure spending gate

Prepared October 17, 2026. **The owner approved the approximately $25/month base pilot and the illustrated AI usage estimate on October 17, 2026 (roughly $30/month combined planning total). No Azure resource has been provisioned by this project yet.** This replaces the unverified planning prices in the original proposal; architecture/security approval and frontend visual approval do not authorize billing.

Rates were retrieved from the [official Azure Retail Prices API](https://prices.azure.com/api/retail/prices). The [saved meter evidence](pricing/retail-rates-2026-10-17.json) contains exact SKU/meter IDs, units, tiers and effective dates. These are USD public retail rates, not subscription-specific quotes. Tenant availability, quotas, currency, taxes and discounts require secure Azure access and final verification before creation.

## Proposed base pilot, East US

| Resource / SKU | Verified rate | Monthly planning amount |
| --- | --- | ---: |
| App Service Linux Basic **B1**, one instance | $0.017/hour | **$12.41** at 730 hours |
| Azure SQL **Single Basic**, SKU B, 5 DTU / 2 GB | $0.161/day | **$4.90** at 730/24 days |
| StorageV2 Block Blob **Hot LRS** | $0.0208/GB-month, $0.05/10K writes, $0.004/10K reads, $0.05/10K list/create operations | **$0.08** allowance for 1 GB total retained data, 10K writes, 10K reads and 1K list operations |
| Log Analytics **Analytics Logs**, East US | $2.30/GB at the paid ingestion tier; first-tier benefit also appears in the rate card | **$0.23 idle / $2.30 light use**, conservatively ignoring free allowances that may be shared/consumed elsewhere |
| Existing Entra tenant, individual application-role assignments | No new premium feature or license proposed | $0 incremental assumed; inspect licensing/policy first |

Verified-meter subtotal: approximately **$17.62 idle / $19.69 light-use monthly**, before tax, external transfer and any extra backup/version storage. Propose **$20–25/month as a base operating target** with a small allowance for these variations. The 1 GB storage assumption includes retained versions/deleted data, not just live images. Budget notifications are alerts, **not a hard spending cap**.

Light use assumes 10 testers, roughly 1,000 catalog searches/month, one application/database instance, 1 GB logs/month and no model/search calls. There is no autoscaling or provisioned AI throughput. Proposed log ingestion limit is 0.1 GB/day; a service cap can have delay and does not cap unrelated charges. Use budget alerts at 50%, 80% and 100% of the approved target, forecast alerts, authentication, API throttling and regular usage review. A strict zero-overrun guarantee would require keeping paid services disabled.

Resource scope: one new isolated POC resource group (`rg-etalonops-poc`), one B1 Linux plan, one web application with system-assigned identity, one logical SQL server with one Basic database, one private LRS storage account/container, one Log Analytics workspace and one workspace-backed Application Insights component. All regional resources are proposed in East US. Globally unique names are finalized only after availability/tenant inspection. No private endpoints, premium identity licenses, support upgrades, extra instances, paid deployment slots, emails, document generation or other products are included.

Deploy first to the Azure-provided HTTPS hostname. Enforce single-tenant authentication and server-side owner/Admin checks before customer data is accepted. Use managed identity for runtime SQL/Blob access, a separate migration identity, Entra-only SQL authentication where supported, restrictive firewall rules and no blanket “Allow Azure services” firewall rule. Do not grant tenant-wide directory roles as an expedient. Any permission change outside the POC scope requires a separate explanation/approval.

Rollback retains immutable application artifacts and uses backward-compatible migrations. SQL point-in-time restore and storage retention must be configured and tested in Azure after provisioning; local SQL backup/recovery success does not prove a cloud recovery objective. Record actual policies/costs before accepting real data.

## AI rates — illustrated usage approved; service chain still requires verification

The official rate card lists East US **GPT-4.1-mini regional standard** input at **$0.00044/1K tokens** ($0.44/million) and output at **$0.00176/1K** ($1.76/million). This is not provisioned throughput, fine-tuning, batch or Global model pricing. A listed meter does not prove deployment availability/quota in the selected subscription.

**Grounding with Bing Search** is listed at **$14/1K transactions**, in **Global**. This corrects the original illustrative $35/1K assumption. It is an Agent Service tool, not a general direct product-search API. Its complete service-chain charges, terms, regional processing implications, source/thumbnail suitability and quota behavior must be verified before enabling it. Do not silently substitute Global processing for a regional model requirement.

For illustration only: 200 discovery sessions/month × 2 model turns × 3,000 input/600 output tokens would be about **$0.95** in model tokens; 200 single retrieval transactions about **$2.80**. Those **$3.75** exclude any additional required agent/storage/retrieval components and are **not a complete AI deployment quote**. The owner approved this illustrated expense after reviewing the exclusions; activation must wait until the complete service chain fits the approved planning scope, or an updated quote is approved. Sessions, token budgets, retries and paid tool calls must have atomic server-side limits and a kill switch. No unbounded agent loops or automatic paid retries.

## Next decisions and prerequisites

1. Secure Microsoft sign-in to inspect the intended tenant/subscription, allowed region/SKUs and existing bindings. Do not ask for passwords, tokens or MFA codes in chat. Azure CLI installation itself creates no Azure resources.
2. Present the final available resource names, subscription-specific costs and role scope, then verify the approved scope before creation. The current proposed base target is $25/month; approval comes from the owner's explicit chat instruction, not this document or the earlier $0 frontend approval.
3. Quote and approve AI enablement separately once its full service chain is understood. Preserve manual-description fallback if disabled.
4. Request separate approval for any later `dev.etalonops.com` DNS changes after the secure Azure preview passes acceptance tests. Preserve all existing apex/mail records.

Published access to Microsoft pricing/docs/artifacts is working. The next network prerequisites are `login.microsoftonline.com` (Microsoft sign-in), `management.azure.com` (Azure account/resource APIs), and `graph.microsoft.com` (Entra application configuration). These network destinations grant no Azure role by themselves. They are required before the secure provider connection; the agent will not use them to create paid resources without approval.
