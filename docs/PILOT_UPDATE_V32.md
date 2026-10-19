# Microsoft sign-in recovery v32

Completes Microsoft redirect handling during initialization, including cleanup after sign-out. Prevents concurrent sign-in activation and replaces the raw interaction_in_progress error with instructions and an explicit Reset Microsoft sign-in button. Recovery uses the public MSAL cache API and leaves unrelated browser storage and saved drafts intact.

This cumulative update retains v31 workforce and account administration. No new migration, Azure resource or paid AI request is required. Run scripts/update-cloud-app.sh in the existing Cloud Shell workspace. Health reports microsoft-session-v32.

Validation: production build and five browser checks covering interrupted sign-in recovery, sign-out cleanup, retained draft storage and site-account administration. Real Microsoft authentication must be verified against the deployed tenant after installation.
