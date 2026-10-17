# Image review and guarded model clarification

October 17, 2026. The owner authorized continued development while away. This milestone implements product-image administration, a direct Azure model client, durable usage controls and stricter catalog shorthand matching. Live AI and external search remain disabled. No DNS changes or additional paid services were provisioned by this work. Existing MaterialsManagement resources were not changed.

## Product images

Administrators can select an existing catalog material, upload a photo, record its public HTTPS evidence URL and usage-rights basis, preview it, then separately approve or reject it. Approval requires an explicit product/rights verification statement. Foremen see only the currently approved image. Replacing an image rejects the previous association; removing approval hides the image from subsequent fetches. Reviewers, timestamps, hashes and audit events remain available to administrators. Previously rejected canonical content cannot be re-uploaded for the same material. This is exact-content matching after normalization, not perceptual duplicate detection or legal verification of rights.

Uploads accept single-frame JPEG, PNG or WebP, up to 5 MiB and 16 million pixels. The server decodes actual bytes, strips metadata, rotates orientation and re-encodes WebP up to 1024 pixels per side and 2 MiB. SVG, animation and corrupt data are rejected. Uploads have two concurrent processing slots per process and 30 requests/minute per user. A tenant can retain 500 image associations, including rejected history. These controls bound this pilot; they do not replace cloud billing controls.

Metadata reserves the association before storing bytes. A failed binary write leaves a pending record; retrying the same image repairs it. Approval checks that matching bytes exist. Rejected history and private binaries are retained rather than physically purged. Database backup and asset backup are separate requirements. Already-open pages can retain an image until refreshed or searched again.

Local mode uses private filesystem directories; cloud mode uses the pilot's private Blob container with managed identity. Tenant/material/hash object keys, authenticated image endpoints, content-hash validation and administrator checks prevent public/pending-image access. Source URLs are evidence only: the server never fetches them. No browser token is placed in an image URL. Local filesystem behavior is tested; live Blob authorization still needs Azure acceptance.

## Model clarification and limits

The implementation calls a configured Azure OpenAI deployment directly using managed identity. It creates no agent service, paid search tool, automatic loop or automatic retry. It sends original wording, quantity, requested unit, conversation and retained facts as user data beneath fixed instructions. Strict JSON/schema validation, numeric/dimension checks, a pinned GPT-4.1-mini model family, response-size bounds and refusal/truncation handling reject unsupported responses. These checks do not prove factual accuracy: interpretations remain visibly unverified and require the user to choose whether to use the proposed description. They never create verified catalog entries or aliases.

Server-side reservations persist in the existing append-only audit table and commit before the provider call. Failures retain reservations conservatively. Duplicate request IDs cannot silently issue another call, sessions are owned by one user, and SQL transactions serialize competing requests. UTC accounting uses one captured timestamp per reservation.

| Control | Pilot value |
| --- | ---: |
| Sessions per tenant / UTC month | 200 |
| Model requests per tenant / UTC month | 400 |
| Requests per session | 2 |
| Requests per user / UTC day | 20 |
| Serialized provider-request body | 12,000 UTF-8 bytes |
| Output tokens per request | 600 |
| Provider request timeout | 15 seconds |

The admin panel reports reserved sessions/requests, including failed calls. Counts are conservative application limits, not an Azure invoice or dollar cap. Existing deterministic clarification and manual-description fallback continue when AI is off or unavailable. Model clarification alone does not search for a part; external product discovery is not implemented or activated here.

## Activation and cloud gates

The deployment template keeps `ETALONOPS_AI_ENABLED=false`. Cloud runtime now also requires `ETALONOPS_STORAGE_ACCOUNT`, supplied by the template. Existing SQL/image/audit tables and checksum-preserving migrations remain unchanged.

Before enabling the model, inspect authenticated Azure deployment metadata to verify a regional GPT-4.1-mini deployment, subscription availability, actual token rates and ownership within the approved pilot scope. Scope the app identity's Cognitive Services OpenAI User role to that pilot model resource. Do not reuse or change existing MaterialsManagement resources without authorization. Use managed identity; no keys, passwords or tokens belong in chat or Git.

Activation configuration consists of `ETALONOPS_AI_ENABLED=true`, `ETALONOPS_AI_RATE_VERIFIED=gpt-4.1-mini-regional-approved`, `ETALONOPS_OPENAI_ENDPOINT` and `ETALONOPS_OPENAI_DEPLOYMENT`. The attestation records an actual operator pricing/deployment check; it is not verification by itself. Setting the enabled flag back to false is the application kill switch. No activation was performed. An unexpected service chain, higher estimate or different processing region needs a revised business decision. The approved roughly $30 monthly estimate is not a spending cap.

The earlier Bing Grounding price is an Agent Service tool rate, not a quote for a direct search API. No external search provider has been selected or purchased. Preserve this distinction when estimating future discovery features.

Azure hosting remains blocked by East US B1 quota (support request `2610170040001486`). This workspace lacks usable interactive Azure authentication; tenant Security Defaults remain intact. Real application Entra login, Azure SQL/Blob managed identity, live model responses, cloud recovery and budget notifications still require authenticated Azure validation. No user action is needed for the independent work completed here. Real project onboarding, actual reviewed product records and customer acceptance remain outstanding; test fixtures and synthetic test images are fictional.

## Catalog and verification

Lookup expands construction shorthand such as EMT, sch80, blk and galv while preserving strict numeric sizes, fractions, thread gauges and alphanumeric part identifiers. Persisted alias normalization remains compatible; no AI-generated mapping becomes verified automatically.

Validation: production/type/server builds; 24 backend tests; 8 real SQL Server integration tests; 37 browser tests across desktop/mobile, accessibility, draft preservation and offline preview; three deployment checks; and a native SQL backup/checksum/restore/CHECKDB drill including image associations and audit counts. Runtime ZIP smoke validation loaded native image and Azure SDK dependencies and then correctly rejected missing cloud configuration. Production dependency audit reported zero known vulnerabilities. Provider tests use simulated responses, not billable model calls.

Current screenshots use synthetic colored pixels, not real product photos: [mobile pending review](../artifacts/screenshots/390-image-admin-pending.png), [desktop pending review](../artifacts/screenshots/1440-image-admin-pending.png), [mobile approved result](../artifacts/screenshots/390-approved-image-results.png). The downloadable standalone HTML remains an offline demo; authenticated image administration and live AI require the API-backed application.
