# Assisted product research — v18

Release: `assisted-research-v18`. Updates the existing pilot; no new Azure resource is provisioned.

## Install and enable discovery

Install the source update using the existing Cloud Shell workspace:

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v18.zip" -d "$HOME/etalonops-westus3" &&
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

After deployment succeeds, activate the existing Azure Responses web-search tool:

```bash
cd "$HOME/etalonops-westus3" &&
python3 scripts/enable-azure-research.py --enable-web-discovery
```

The helper verifies the existing subscription, app release, pinned model and current retail model/Bing prices before updating settings. It retrieves the existing key within Azure, never prints it, and creates no new resource or paid test request. It does not change the subscription-wide Azure blocked-tools policy. If Azure blocks `web_search`, surface that error; do not silently provision another service. Existing API keys must not be pasted into chat.

## Test in Administration → Product research

1. Enter `CANTEX A52BA12`, leaving URLs empty. Start research once.
2. Inspect candidate specifications, evidence, missing details and potential translations. The tool can identify up to five products per task. A family request is a bounded sample, not a complete manufacturer catalog crawl.
3. Alternatively supply the manufacturer product URL and `1 inch PVC Sch 40`. Accessible linked PDF sources are fetched first, without a search charge. One discovery follow-up is allowed if defining details remain missing.
4. Review automatic catalog duplicate checks. Complete, identical specifications reuse the material; different manufacturers link separate products. Manufacturer/part and phrase duplicates are reused. Case, punctuation and common legal manufacturer suffixes are matched; documented PVC and bell/plain-end spelling equivalents share material identity. Existing records are checked without changing their stored specifications. Conflicting identities require correction. This is deterministic identity matching, not guaranteed resolution of every manufacturer alias or wording variation.
5. Edit a candidate's fields and translations, select it, then save unpublished. Incomplete candidates are retained and cannot be added to an MRF or published until required specifications are repaired. Open Workbook imports to review, edit, publish or delete.
6. Reopen saved research from the dropdown after closing Administration. This causes no new model/search call. Unsaved inline edits are not retained when the interface is closed; save them unpublished first.
7. Record the displayed model cost, search cost, Bing request count and total for each test. Compare Administration → AI usage and Azure billing.

No paid Azure test was performed during development. Local tests mock Azure output; live model/tool availability and source access require owner acceptance.

## Cost controls and limitations

The approved monthly AI allowance remains USD30, separate from hosting. Each paid model or discovery call reserves USD0.15 before execution. A task uses at most three calls (initial extraction, one discovery, one supporting extraction); manufacturer/part-only typically uses discovery plus extraction. Saved/cached research makes no new paid call. Known successful costs replace reservations; failed/interrupted calls retain their reservations.

Checked 2026-10-18, valid through 2026-11-18:

- GPT-5.4 mini, Data Zone Standard US: USD0.825 / million input tokens; USD4.95 / million output tokens.
- Azure Grounding with Bing Search: USD14 / 1,000 search requests (USD0.014 each), meter `a831dc6d-1dce-5ad6-8130-c330fe9ab175`.
- Search billing uses `tool_usage.web_search.num_requests`, never the number of search output items. One hosted tool call can issue several Bing requests. There is no claim that `max_tool_calls:1` guarantees one billable search. Missing billing counts or reported usage exceeding the reservation pauses future paid requests for cost review.

The application controls new reservations, not the entire Azure invoice. Tool-side fan-out, a response lost in transit, other API clients, changed Azure pricing and tax can affect actual billing. Failed tasks can have charges not included in a returned successful-task estimate. Check the ledger's held reservations and Azure billing too.

## Evidence and publication

The model locates cited source links; the server independently fetches those sources through public HTTPS/DNS protections before extracting product facts. Search snippets alone do not establish product specifications. Blocked, scanned, unreadable or overly large sources remain gaps. PDF limits: 8 MB, 300 pages, 12-second resource-limited extraction; relevant excerpts are selected using the request, including exact part identifiers. HTML remains limited to 2 MB. Up to four source documents and 22,000 characters per document enter extraction. Cross-host linked PDFs may be manufacturer CDN documents; relevance and authority still need admin review.

No factual verification or completeness is implied by a generated result. Product images are retained when an observed eligible image is available; missing optional images do not discard products. All AI phrases remain provisional and admin publication controls remain in effect. No new database migration is required.

References:

- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/web-search
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses
- https://prices.azure.com/api/retail/prices (exact Consumption meters verified by activation helper)

## v18.1 discovery response hotfix

Removes the incorrect requirement that a completed discovery response contain exactly one `web_search_call` output record. One hosted invocation may expose multiple search/open/find action records. All returned search records must still be completed, source URLs are independently fetched, and billing continues to use Azure's reported Bing request count. Missing/incomplete actions now report bounded action counts/statuses/types without logging prompts, source text or keys. The original generic error alone cannot establish which condition failed. The release health marker remains `assisted-research-v18`; no activation or schema change is needed when updating an already activated v18 app.
