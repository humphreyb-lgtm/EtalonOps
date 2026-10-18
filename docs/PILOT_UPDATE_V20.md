# Prepared research paste — v20

Release: `prepared-paste-v20`. Cumulative update for the existing pilot, including v19 fixes and additive product-details migration 008. No further database migration, resource provisioning or AI activation is needed for v20. No paid AI test was made during development.

```bash
unzip -o "$HOME/EtalonOps-pilot-update-v20.zip" -d "$HOME/etalonops-westus3" &&
bash "$HOME/etalonops-westus3/scripts/update-cloud-app.sh"
```

Open Administration → Workbook imports. Paste the complete ChatGPT `etalonops-research-v1` response and press Upload pasted research for review. It creates dense editable unpublished material, product, translation and optional image rows. Check pasted research is a read-only preview. Neither step calls AI/Bing. See [CHATGPT_RESEARCH_IMPORT.md](CHATGPT_RESEARCH_IMPORT.md).

The owner's supplied TSGB1624 response passed isolated local preflight: one material, one manufacturer product, 24 translation rows, zero image rows, six original sources, and one unresolved catalog ordering unit. Its 26 rows are staged unpublished and all remain held while that required unit is unknown. No unit, image, packaging conversion, source verification or missing optional specification was invented. The private response was not published in the source repository or inserted into live Azure during development.

The source schema, images, arrays/nulls and warnings are preserved in original downloadable JSON. Supplied facts remain provisional. Existing bulk publication and duplicate checks apply. Malformed input stays in the editor, and a ready-for-review label in external research cannot bypass approval or required domain validation.
