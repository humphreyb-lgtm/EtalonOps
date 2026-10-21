# Publication import — v45

Adds a resumable, owner-run Cloud Shell import for the reviewed R2 package. The isolated runner uses the existing material-workbook preview, audited metadata updates, publication planning and image repository operations. No raw catalog INSERT script, manufacturer import, new paid resource, or AI/Bing request is used.

The prepared owner package includes 867 ready material records: 537 reference records plus 330 active research records. The owner's supplied live snapshot contains 47 active materials; preflight classifies 42 metadata updates and 825 additions. Five live materials outside this research scope are retained. The 28 held records are excluded. The source snapshot itself, credentials, account data and MRFs are not in the distributable.

The runner verifies the exact existing Azure subscription/app/SQL/storage, the signed-in SQL owner, active EtalonOps Microsoft admin status, tenant package hash, payload checksums and image integrity. It backs up catalog relationships locally before data changes and rechecks each 50-material batch. Public photo URLs use the existing image-reference publication workflow. The 311 supplied local-image assignments use private blob storage and the existing image approval workflow when the owner passes --approve-images. Approved existing images are preserved.

Temporary SQL firewall access, if necessary, is limited to the current Cloud Shell IP and removed on exit. The runner does not grant roles or change resource SKUs. Existing storage access uses the owner's Azure CLI credentials, with an in-memory existing-account key fallback if the owner has management-plane access but lacks a blob data role. Secrets are never written to the package, command line, logs or report.

Each completed batch is retained and audited. A conflict stops subsequent work; rerunning revalidates current state and reuses existing identities. It does not claim a single cross-database/blob transaction. Reports and snapshots under .runtime are private and excluded from distributions. The isolated runner installs production dependencies and can install this application update before importing data.

Two small importer corrections preserve consistent identity: manual material imports retain a permitted blank source URL, and known numeric dimensions in Other Specifications normalize to the same numeric type as their dedicated columns.
