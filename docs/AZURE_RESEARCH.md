# Azure manufacturer-page research

Release `source-research-v16` adds an administrator-only development pilot using the existing Azure OpenAI deployment and Responses API. It creates no Azure resource and enables no Bing/search tool. Legacy AI clarification remains disabled. Source code and automated tests do not establish live Azure authentication or manufacturer-site access.

## What it does

Search the catalog first. If no suitable match exists, enter up to three official manufacturer HTML/PDF URLs in AI product research. A request reads at most three documents total, including up to two same-origin PDF links found on a supplied page. Documents are limited to 2 MB each; PDF extraction is limited to 60 pages, seven seconds and a memory-limited worker. Text is bounded and may be truncated. Scanned/blocked/large/unavailable documents are reported as missing evidence rather than guessed. AI receives the extracted source text and observed image references, never credentials. No search engine, rendering browser, OCR or unrestricted crawler runs.

Up to five complete candidate products return with manufacturer/part, defining attributes, evidence URL/caveats, potential phrases and an optional observed same-origin image. Missing facts may produce zero candidates. Outputs remain provisional; source attribution and schema checks do not independently verify claims. Page/PDF instructions are untrusted data.

In MRF Builder, choose No Substitutions if required, then Add to MRF and catalog. The server reads the candidate from saved research rather than trusting edited browser specifications. One transaction creates/reuses generic material identity, links the manufacturer product, learns the original phrase and additional potential phrases, and records owner-managed image references. Job restrictions apply and a failure rolls back additions. The line retains the selected manufacturer/part and substitution requirement. Save the MRF draft to persist the line. Selecting is an explicit provisional catalog addition; merely running research does not publish products.

For administrator review, select candidates and Save selected products unpublished. Materials, products, phrases and available images enter Workbook imports; review/edit/publish/delete there. Research coverage notes persist with the import. Original research is cached for 24 hours for the same administrator when request, extracted content, source URLs and model match. Reuse does not call AI again. Already-published catalog searches and selection learning use no AI.

## Cost controls

The owner authorized an AI-only allowance of $30/month, separate from hosting. The application uses a UTC request-reservation month and a shared tenant budget. Each potentially billable call first reserves $0.15 in the database under serializable/concurrent-safe transactions. This is NOT a per-lookup fee. At the checked prices, the bounded request plus 8,000 output-token maximum costs less than that reservation. No search tools or additional paid operations are sent.

Successful response usage settles atomically with saved results. The unused reservation becomes available again. Failed/interrupted/invalid/uncertain responses retain their full reservation; no automatic paid retry. A request is rejected if committed usage plus outstanding reservations plus its new reservation would exceed $30. Failed request reservations can reduce usable allowance conservatively. No automated refund of uncertain charges occurs. Restarts and concurrent requests do not reset the ledger. Admin AI usage shows recorded successful usage and unresolved reservations; it is not an Azure invoice and does not control charges from other clients, hosting, taxes, pricing changes or external account changes.

Retail pricing checked 2026-10-18 for East US, Data Zone Standard, GPT-5.4 mini (2026-03-17): $0.825/million input tokens and $4.95/million output tokens. Example 5,000 input and 2,000 output tokens (including reasoning): $0.014025. Pricing policy expires after 2026-11-18; new paid requests stop until rechecked. Existing catalog functions continue. The activation helper rechecks current retail rates and pins the existing model/version with NoAutoUpgrade while preserving SKU and capacity.

References:
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/web-search
- https://prices.azure.com/api/retail/prices (East US meters `5.4 mini Inp Dz` and `5.4 mini Opt Dz`; meter IDs `8d2648cd-6716-5fe4-80c0-88259d1f3afc`, `afb7eabc-e336-5360-b03e-11dd0edb6533`)

Azure's built-in web_search uses Bing grounding and has separate request-based charges. Tool-call counts are not the number of billed Bing requests. General product discovery without a supplied page still needs a bounded search-provider integration and its own tested usage controls. This release does not silently enable it.

## Install and activate

Install the source-only v16 ZIP using the existing update-cloud-app.sh process first. Existing uploads, catalog and drafts remain. Then, in the same authenticated Cloud Shell, run:

```bash
cd "$HOME/etalonops-westus3"
python3 scripts/enable-azure-research.py
```

The helper checks the existing subscription, resource, model/version/type, deployed application release and current retail pricing. It pins the existing deployment's upgrade policy without changing its model, SKU or capacity. It obtains the existing key directly from Azure and writes settings through a temporary mode-600 file removed on exit. Keys are never pasted into chat, printed or put in source control. It enables only manufacturer-page research with the fixed approved allowance. No paid test call is issued automatically.

After the app restarts, refresh and open Administration → Product research, or search for an uncataloged item in MRF Builder. Enter its official product link and run a single narrow research request. Review evidence/omissions, select the intended manufacturer product, save the MRF and reload. Confirm subsequent catalog lookup succeeds without another AI call. Check Administration → AI usage for settlement. A second real assigned account and broader manufacturer coverage remain acceptance tasks; live research is admin-only for this initial pilot.

To stop new paid research calls:

```bash
az webapp config appsettings set --name etalonops-954bb4a3 --resource-group rg-etalonops-poc --settings ETALONOPS_RESEARCH_ENABLED=false --output none
```

Calls already in progress may finish. Saved catalog data remains. Do not rerun full infrastructure deployment merely to activate AI; that template intentionally defaults AI off.

## Validation boundary

Automated checks use fictional data and mocked provider/HTTP responses. They test payload/model/usage limits, no tools, single attempts, secret-safe failures, private-target rejection, PDF extraction, persistent budget/settlement, concurrency, selection replay, canonical reuse, images, publication, job checks and saved exact-product lines on desktop/mobile. This development environment cannot resolve/connect to the supplied CANTEX host through its permitted network path; a live manufacturer fetch and a paid Azure response remain deployment acceptance checks. Do not bypass source-network protections to make an inaccessible source pass.

## v17 research contract

The current adapter uses the documented Azure Responses v1 endpoint with strict JSON-schema output. Dimension fields are numeric/nullable, text fields such as schedule are text/nullable, and model source/image indices resolve to retrieved references. Optional unavailable images are omitted with coverage notes. Azure rejection and validation stages now report safe diagnostic codes; no prompts, full model output or keys are dumped. A past generic v16 error did not retain its cause. See PILOT_UPDATE_V17.md for the repair update; existing activation remains in place.

## v18 assisted discovery

See [PILOT_UPDATE_V18.md](PILOT_UPDATE_V18.md) for the current discovery activation, billing, saved-history and incomplete-candidate workflow. The earlier manufacturer-page-only restrictions describe v16/v17. Web discovery now requires the explicit pricing-checked `--enable-web-discovery` activation. It uses the existing Azure Responses API and reports Bing and model costs separately.
