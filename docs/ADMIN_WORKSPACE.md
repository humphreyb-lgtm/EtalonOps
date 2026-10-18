# Administration workspace

Sign into the database-backed application as an assigned Microsoft Admin and open **Administration** beside MRF Builder. Access is rechecked when opening the workspace. The underlying APIs independently enforce tenant and administrator permissions on every request; hiding controls is not the security boundary.

The workspace provides:

- **Users and access:** register existing Microsoft users, assign project memberships, cap application roles, deactivate access and inspect access-change history. Microsoft remains the sign-in authority.
- **Catalog and imports:** canonical materials, defining dimensions, manufacturer products, potential translations, high-use ranking, correction review/history, staged CSV imports, rollback and exports.
- **Product images:** source-backed uploads, usage-rights evidence and separate approval/rejection for generic materials or manufacturer products.
- **Job restrictions:** job-wide or category manufacturer restrictions. Material-specific part/manufacturer rules remain beside their material in Catalog and imports.
- **AI usage:** read-only status and reserved usage against configured limits. There is no paid activation control.

Switching sections keeps in-progress forms mounted. Returning to MRF leaves the unsaved MRF editor intact. If an administration field changed, closing asks before clearing administration form entries; this conservative prompt may also appear after saving or changing a search filter. Reloading after a field change invokes the browser's leave warning. Saving remains explicit in each section. Closing is blocked during a marked administration operation. Catalog and user shortcuts remain available for existing workflows.

This workspace does not grant administrators access to other users' private MRFs, create Microsoft accounts, assign Entra roles, create services, activate AI or send purchasing communications. Existing restricted runtime database grants and review/history controls are unchanged. The standalone browser preview does not expose administration.

## Verification walkthrough

At phone and desktop widths, open Administration, begin a user registration without saving, switch to AI usage and back, and verify the entry remains. Open images, restrictions and catalog imports. Return to MRF, cancel the close confirmation, then accept it; the original MRF name and entries should remain. Foremen must have no Administration button and an authenticated direct user-management API call must return 403. Real Microsoft session/revocation acceptance still requires the deployed Azure pilot.

Development verification: production build, 58 backend tests, 60 browser tests and nine deployment checks passed. All four administration walkthrough tests also passed with the SQL Server repository. Screenshots are saved in `artifacts/screenshots/390-administration-workspace.png` and `1440-administration-workspace.png`. These local checks do not substitute for live Azure/Microsoft acceptance.
