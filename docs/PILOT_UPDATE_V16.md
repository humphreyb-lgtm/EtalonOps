# Pilot v16 — source research and catalog learning

Release `source-research-v16`. Adds bounded manufacturer-page AI research, durable dollar reservations/settlement, saved research reuse, source-linked provisional catalog learning, images and unpublished admin review. Uses the existing Azure OpenAI resource. No new Azure resources, SKU changes or Bing/search charges. Adds the free MIT-licensed unpdf package for isolated text extraction. No new database migration is needed.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v16.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Once deployment verifies, activate the existing resource securely:

```bash
cd "$HOME/etalonops-westus3"
python3 scripts/enable-azure-research.py
```

The helper rechecks current rates and deployed model, pins NoAutoUpgrade preserving capacity, and transfers the existing key directly from Azure to private application settings. It makes no paid test request. Research is limited to administrators and supplied manufacturer pages/sell sheets. $0.15 is a temporary reservation, not a fee; successful token usage releases the unused amount. Usage plus unresolved reservations is limited to $30/month. General web search is not enabled.

See AZURE_RESEARCH.md for supported source limits, exact test steps, pricing assumptions, kill switch and remaining live acceptance checks. Existing catalog imports and drafts are preserved. No workbook re-upload is required. No paid API calls or live Azure changes were made during local development.
