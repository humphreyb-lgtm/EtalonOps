# Application user administration

Administrators can open **User administration** beside Catalog administration. This directory contains users who have signed into EtalonOps and existing Microsoft users explicitly registered by an administrator. It is not a directory of every person in the Microsoft tenant.

Microsoft remains the sign-in authority. Users still require the EtalonOps Microsoft application assignment/role. The screen does not create Microsoft accounts, invite people, assign Microsoft roles, change subscriptions or require Microsoft Graph permissions. Use the correct Microsoft object ID from the existing tenant when registering an account before its first sign-in. Do not use an email address as the object ID.

## Access controls

- An account may follow its verified Microsoft role, be restricted to Foreman features, or require a previously observed Microsoft Admin assignment. The application cannot promote a Microsoft Foreman token to Admin.
- Project assignments control access to that owner's project drafts. Removing a project hides its saved MRFs; reassigning it restores access to the same records.
- Deactivation rejects subsequent protected API requests, including requests with an already-issued access token. It does not erase drafts, item snapshots, catalog contributions or access history. A request already in progress may finish; the change does not cancel in-flight work.
- A local test sign-in cannot recreate deleted memberships or reactivate an existing deactivated account. Cloud migration/bootstrap scripts likewise do not restore the pilot owner's revoked project access once a directory record exists.
- Administrators cannot deactivate or demote themselves. The server also rejects removal of the last recorded active administrator. External changes to Microsoft assignments remain controlled in Microsoft and require a separate administrator/recovery process there.
- Admin status does not automatically allow reading another person's MRF drafts. That requires a separately designed sharing/delegation permission.

Role restrictions are rechecked from the database on each protected request. Microsoft role removal takes effect as new tokens are issued, subject to Microsoft's token/session policies; use EtalonOps deactivation when immediate application denial is needed. UI controls loaded before a permission change may remain visible, but the API enforces the current restrictions.

## Review and history

Every access change needs a reason and the screen's review checkbox. The save includes the loaded version so a stale editor fails instead of replacing a newer change. History retains the actor, time, reason and before/after account status, role restriction and project assignments. The runtime cannot delete directory accounts. History is paged; SQL runtime grants allow SELECT/INSERT only on `user_access_changes`, with no UPDATE or DELETE.

Forward migration 006 adds the directory and append-only access history. Existing memberships remain untouched. Existing assigned Microsoft users receive a directory entry on their next verified request; this preserves the established sign-in boundary. A valid user with no assigned project can sign in, but cannot open project drafts until assigned. The project list still contains the two pilot example projects; dynamic real-project administration is separate work.

## Demonstration

1. Sign in as the local test administrator, open User administration and register a fictional example object ID with a display name and one project.
2. Save with a review reason. Search for the ID, reload the record and inspect its assignments.
3. Deactivate it and inspect the retained history. Re-enable it if appropriate.
4. In an isolated test account/session, verify that removing a project denies its draft endpoint and deactivation denies `/api/me` even with the existing token. Do not deactivate another person's live access merely for a demonstration.

Automated tests exercise token denial, re-login behavior, tenant isolation, stale saves, role restrictions, self-protection, history immutability and draft preservation. Live Entra assignment/session acceptance is still required after deployment.

Development validation: production/type build, 54 backend tests, 31 SQL Server tests and 54 browser tests passed. Tests cover the actual staged-import contracts for the starter template examples as well as the new access controls. The fictional CSV examples were applied only in an isolated in-memory test database.

The additional SQL-backed browser walkthrough passed for registration, project assignment, deactivation and history at phone and desktop widths. The first-registration history format is covered explicitly on both database engines. Nine deployment checks also passed.
