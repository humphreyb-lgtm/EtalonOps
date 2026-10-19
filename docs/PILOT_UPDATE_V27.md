# MRF header and assigned foreman — v27

The builder has one compact header with matching MRF name, Foreman and MRF Delivery Date fields. My Submitted MRFs, My Drafts and New MRF sit above it; Save as Draft and Review and submit sit beside the header fields. The duplicate header is removed. Add MRF Item labels the entry form, and the initial empty search panel is removed. Purchasing checks remain beside the MRF Item List heading.

Foreman lists active registered users assigned to the selected job. It defaults to the preparer; selecting someone else identifies whom the request is for. Draft ownership stays with the preparer. Save, reload, submission review, immutable submission snapshots, purchasing CSV and revision drafts retain that selection. Submission separately records Prepared by. The selected user must remain active and assigned to the job when saved or submitted.

The cumulative source ZIP applies migration 10 to add nullable foreman ID/name columns. Existing drafts default to their creator. It creates no resources, changes no SKU, and includes no keys or runtime state. Run the existing update-cloud-app.sh after extracting it into the recovered pilot workspace. Health reports mrf-foreman-v27. Existing AI configuration remains in place; no AI research calls are needed for this update.

Owner acceptance: refresh the deployed app, choose a registered user assigned to the job, save and reload a named draft, then check the selected foreman in submission review. Verify a GF/preparer remains identified separately. Check desktop/mobile field alignment, the single date/save area and the Add MRF Item heading.
