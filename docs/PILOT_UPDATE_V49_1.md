# CMS v49.1 — Catalog image capacity and resumable strut import

Health release: `cms-suite-v49.1`.

Preserves the v49 CMS and existing site content. Raises the retained catalog-image association cap from 500 to 5,000 so the reviewed strut package can add 297 images alongside 312 existing associations. Per-file byte/pixel limits, account permissions and image approval remain unchanged. No additional Azure resources are provisioned.

Fixes numeric angle/radius/end-size attributes when a generic material passes through workbook publication. These values now retain their numeric type, so duplicate reconciliation and resumed imports find the published record rather than treating it as a different physical configuration.

The owner-run importer supports varying package labels/held counts, verifies checksums and tenant context, preserves existing keys and approved images, writes batches of 50, and uses an expiring blob lease to prevent overlapping publication jobs. Run progress is saved locally and to a private report blob after material batches and every ten newly attached images. A rerun revalidates the current catalog and reuses existing records; completed batch ranges are not counted twice.

`start-import.sh` launches under nohup in Cloud Shell and `status.sh` displays local progress. A browser disconnect does not intentionally stop the child process; terminating or recycling the Cloud Shell machine can still interrupt it. Rerun the same installer to resume idempotently. Private snapshot backups and Azure state stay outside the downloadable/source package.

The strut preparation script consumes only the three corrected Materials batches and explicitly mapped local images. The held scope item is excluded. Material specifications remain provisional; the owner has approved representative images for this import. The import does not claim engineering certification or independent manufacturer verification.
