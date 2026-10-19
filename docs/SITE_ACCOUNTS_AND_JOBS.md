# People, jobs and sign-in

## First use

Sign in with the existing Microsoft administrator account. Open **User administration** (or Administration → Users). The directory has People, Jobs and, for system administrators, Companies. Existing users, memberships, MRFs and catalog records are retained. Existing example jobs are brought into the managed directory when existing memberships reference them; they can be renamed or archived. The default company is **My company**; rename it to the real company name.

1. In Jobs, add a job number, name, company, address and dates. Active jobs can receive assignments; archived jobs cannot receive new assignments or MRF submissions. Existing records are retained.
2. In People, add a user. Choose site-managed invitation or an existing Microsoft identity. Microsoft identities require their actual Microsoft object ID and the existing application assignment; this screen does not create Microsoft identities or grant Microsoft tenant roles.
3. Assign jobs. For each assignment choose Company admin, Superintendent, General foreman or Foreman, then choose a supervisor on the same job. If there is no supervisor above this assignment, explicitly select Job leadership. A company administrator account has company-wide management authority separate from its job roles. System Admin authority remains tied to verified Microsoft Admin assignment.
4. Save with a reason. Create an invitation link for a site user and send it privately. The recipient opens the link, creates a password and signs in with the site-account form. Uninvited registration is not accepted. No new Microsoft account is required for site accounts.

The main job selector lists the active jobs actually assigned to the current user. Multiple assignments and different roles/reporting relationships on different jobs are supported. A foreman may report directly to a superintendent or company administrator; no intermediate role is mandatory. Cycles, self-reporting, cross-company supervisors, inactive supervisors and unassigned supervisors are rejected. Reassign direct reports before removing their supervisor's job assignment. Suspension takes effect immediately even for supervisors; their direct reports retain the historical link and show an inactive-supervisor warning until reassigned. Existing assignments without supervisors are visibly flagged for configuration; they are not silently given an approval path.

## Account administration

Search and page the directory, edit contact details, employee number/title, account status and assignments. Company administrators can manage ordinary users/jobs only inside their company; only system administrators can create companies or designate company administrators. A company administrator cannot elevate their own authority or edit system administrator accounts. Changes require a reason and retain before/after history. Site-account links can be reissued or revoked; password reset and session revocation are available from the user editor. Microsoft password recovery/session administration remains with Microsoft.

Site passwords use salted scrypt (N=32768, r=8, p=1); hashing concurrency and request/account attempts are bounded. Passwords are 12–128 characters. Only token hashes are stored for invitation/reset links and sessions. Invitation links expire after 72 hours; password-reset links after 30 minutes. Links are single-use, and a replacement revokes the prior outstanding links. Password resets invalidate existing site sessions. Site sessions last eight hours and use Secure, HttpOnly, SameSite=Lax cookies in Azure. Mutating cookie-authenticated requests require a same-origin custom request header. Deactivation is checked by the API on every request and revokes site sessions and outstanding account links. Suspending a user does not delete MRF history. Accounts are deactivated rather than hard-deleted.

Task Code remains MRF-line-only. Original Input and Move controls are removed from the MRF Item List; original request evidence remains in saved data and submission history. Changing descriptions does not rewrite catalog identity.

## Email delivery

The release works with administrator-distributed invitation/reset links without configuring email. **Forgot password** explicitly tells the user to contact their company administrator in this mode. The site never claims that an email was sent when no mail service is configured.

Automatic invitation and self-service reset email can be connected to an HTTPS mail-delivery webhook (for example an authenticated Azure Logic App with a mail connector). This release does not provision or charge for a mail service. Configure these App Service settings through secure Azure settings, never in source or chat:

- `ETALONOPS_MAIL_WEBHOOK_URL`: HTTPS endpoint accepting POST JSON.
- `ETALONOPS_MAIL_WEBHOOK_TOKEN`: shared bearer credential accepted by that endpoint.
- `ETALONOPS_PUBLIC_ORIGIN`: `https://etalonops-954bb4a3.azurewebsites.net` (or the verified production origin).

The server sends `Authorization: Bearer <credential>` and `{ "to": "recipient@example.com", "template": "invite" | "reset", "url": "https://.../#register=..." | "https://.../#reset=...", "expiresMinutes": 4320 | 30 }`. The webhook must email only the supplied recipient using the supplied template, protect trigger/run-history access, return a 2xx status only after accepting delivery, and never publish the link. It should not accept unauthenticated requests. Redirects are not followed. Requests time out after 10 seconds. No email credential, password or raw token is written to application logs or audit records.

A forgot-password response is generic regardless of whether the email exists. Delivery failures are logged without account details or tokens. An administrator can generate a replacement link if delivery fails. Do not change or reuse a Microsoft password in the site-account form.

## Future MRF approvals

This version records the reporting hierarchy; it does **not** enable an approval gate or change submission into a purchase order. Future work will configure per-job approval levels, delegated/acting approvers and absence dates, no self-approval, purchasing release, route snapshots/history and reapproval after meaningful changes. Reporting relationships and approval rules remain separate. MFA for site accounts, additional identity-provider integrations and detailed per-session/device administration are future enhancements; Microsoft-managed MFA policies continue to apply to Microsoft sign-in.

## Acceptance checklist

Use a fresh/private browser for the login page. Check Microsoft sign-in with the existing administrator. Add an actual job, assign a test user and supervisor, and verify the user sees only assigned jobs. Test a foreman → superintendent chain without a GF, and a top-level assignment without a superintendent. Test invitation registration, login, reload, password reset, suspension and session revocation. Confirm company admins cannot access other companies or system administration. Azure-hosted real Microsoft sign-in and email delivery require owner acceptance; local automated SQL/browser checks do not replace those checks.
