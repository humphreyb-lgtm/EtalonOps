import { useState, type ReactNode } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';

declare global { interface Window { __ETALONOPS_CONFIG__?: { tenant: string; clientId: string }; } }
export const cloudMode = Boolean(window.__ETALONOPS_CONFIG__);
let client: PublicClientApplication | undefined;
let account: AccountInfo | null = null;
export function cloudDisplayName() { return account?.name ?? 'Assigned user'; }
const scopes = () => [`api://${window.__ETALONOPS_CONFIG__!.clientId}/access_as_user`];
async function authClient() {
  if (!client) {
    const config = window.__ETALONOPS_CONFIG__!;
    client = new PublicClientApplication({ auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenant}`, redirectUri: `${window.location.origin}/auth-callback.html` }, cache: { cacheLocation: 'memoryStorage' } });
    await client.initialize();
  }
  return client;
}
export async function cloudToken() {
  const auth = await authClient();
  if (!account) throw new Error('Sign in with Microsoft to continue.');
  try { return (await auth.acquireTokenSilent({ scopes: scopes(), account })).accessToken; }
  catch (error) { if (error instanceof InteractionRequiredAuthError) throw new Error('Your Microsoft session needs attention. Sign out and sign in again; keep unsaved items on screen until you are ready.'); throw error; }
}
export async function cloudSignOut() {
  const auth = await authClient();
  await auth.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin });
}
export function CloudGate({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!cloudMode || signedIn) return children;
  async function signIn() {
    setBusy(true); setError('');
    try {
      const result = await (await authClient()).loginPopup({ scopes: scopes() });
      account = result.account;
      // The API independently validates issuer, audience, scope, tenant and role.
      const response = await fetch('/api/me', { headers: { Authorization: `Bearer ${result.accessToken}` } });
      if (!response.ok) throw new Error('Access requires an EtalonOps application role. Contact the pilot administrator.');
      setSignedIn(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  }
  return <main className="resume-page"><section className="resume-panel"><span className="eyebrow">ETALONOPS PILOT</span><h1>Sign in to EtalonOps</h1><p>Use your assigned Microsoft work account.</p><button className="button primary" disabled={busy} onClick={signIn}>{busy ? 'Signing in…' : 'Sign in with Microsoft'}</button>{error && <p role="alert">{error}</p>}<p className="fine-print">AI discovery is not enabled. Pilot projects contain example project names.</p></section></main>;
}
