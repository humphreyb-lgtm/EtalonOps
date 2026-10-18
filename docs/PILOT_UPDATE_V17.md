# Pilot v17 — strict research output and useful diagnostics

Release `research-contract-v17`. Updates the existing research adapter to Microsoft's documented Azure Responses v1 endpoint. Uses strict JSON-schema output: typed nullable numeric/text attributes, additional defining attributes, and source/image indices resolved against retrieved content. Numeric schedule values and invented URLs are not silently coerced. An unavailable optional image is omitted with a coverage note rather than invalidating an otherwise complete product. Existing catalog/domain checks remain required and additions remain provisional.

Azure HTTP rejection now reports bounded, key-redacted status/code/message. Response, product-field, usage, authentication and transport failures have separate diagnostic codes. Safe metadata is logged and audited without dumping prompts, full output, headers or keys. No paid retry occurs automatically and uncertain reservations remain held. The cause of a past v16 generic error cannot be reconstructed from that message alone; it did not record the original rejection detail.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v17.zip" -d "$HOME/etalonops-westus3"
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Existing AI activation settings, $30 allowance, key, drafts, catalog and unpublished imports remain. No key entry, model change, AI reactivation or new service is needed for an already-activated v16 app. After deployment confirms, refresh the app and make one explicit research attempt. If it fails, send its new detailed error; do not repeatedly click research.

Automated tests use fictional provider responses; no paid call or Azure resource change was made during this repair. Azure v1 reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses . Live acceptance still requires the owner's authenticated deployment and explicit research action.
