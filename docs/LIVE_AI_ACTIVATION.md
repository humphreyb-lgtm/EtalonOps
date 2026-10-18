# Azure AI development activation

The owner has authorized beginning live AI development using an existing Azure resource. Do not create another paid resource or treat an Azure subscription as proof of a usable model deployment. Retain explicit service configuration and usage controls. Production activation is still pending.

## Resource information needed

Collect only non-secret endpoint, Azure region, deployment name, model name/version and deployment type. In Azure Portal open the Azure OpenAI resource, follow its Foundry portal link, then open Deployments or Models + endpoints. API keys belong only in secure server settings, never in chat, frontend runtime config, source control or logs. A ChatGPT subscription is not an Azure API credential.

The clarification adapter supports either managed identity or `ETALONOPS_AZURE_OPENAI_API_KEY` on the server. The endpoint remains a strict public `https://<resource>.openai.azure.com/` address; redirects are forbidden, responses/time are bounded, failures are sanitized and never automatically retried. The existing verified-model and pricing guard remains in force. Supplying a key alone does not activate AI or web discovery. This adapter currently clarifies user input only and must not be described as manufacturer research.

## Remaining implementation before paid activation

1. Confirm the existing deployed model and actual regional/deployment pricing; select its supported API and evidence retrieval capabilities.
2. Implement a durable dollar-denominated usage reservation before each potentially billable operation. Enforce the owner's approved AI-only monthly allowance, per-request/token/tool limits and a server kill switch. Request-count limits alone are not a dollar cap. Failed/uncertain calls must retain conservative reservations; concurrent requests/restarts must not exceed the allowance. Azure budget alerts alone are not an application stop.
3. Connect bounded product evidence retrieval to the model. An Azure OpenAI endpoint alone does not provide general web search. Identify whether the existing resource supports grounded search; any separate paid search service requires explicit authorization. Do not create one implicitly. Treat pages and PDFs as untrusted data, reject private-network/redirect targets, and document sources for defining facts.
4. Add server-held candidate evidence and selection binding, then connect MRF search/selection to the existing transactional discovery-selection operation. It already creates/reuses provisional material/manufacturer-product relationships and learns the original phrase; generated phrase validation and image capture still require integration testing with real research output.
5. Connect admin live research to the existing selected-research review and unpublished queue. Keep incomplete/ambiguous records for correction. Family coverage must be described accurately.
6. Validate exact-part research, ambiguous queries, meaningful specification differences, duplicate reuse, unsupported facts, missing images, cost rejection, replay, failure and restart. Perform a bounded owner-assisted live acceptance test only after configuration and spending controls are installed.

No paid API calls or Azure resource changes were made while preparing the API-key and unpublished-research handoff code. Automated tests use fictional providers and data. A source commit is not a live deployment or evidence that dollar limits or web discovery are active.
