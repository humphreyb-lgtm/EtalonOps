import {LoginPage,accountRequest} from './LoginPage';
import { useEffect, useState,useRef, type ReactNode } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';

declare global { interface Window { __ETALONOPS_CONFIG__?: { tenant: string; clientId: string }; } }
export const cloudMode = Boolean(window.__ETALONOPS_CONFIG__);
let client: PublicClientApplication | undefined;
let account: AccountInfo | null = null;
let siteAccount:{displayName:string}|null=null;
export function siteSessionActive(){return Boolean(siteAccount);}
let initialization: Promise<void> | undefined;
export function cloudDisplayName() { return siteAccount?.displayName??account?.name ?? 'Assigned user'; }
const scopes = () => [`api://${window.__ETALONOPS_CONFIG__!.clientId}/access_as_user`];
async function authClient() {
  if (!client) {
    const config = window.__ETALONOPS_CONFIG__!;
    client = new PublicClientApplication({ auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenant}`, redirectUri: `${window.location.origin}/auth-callback.html` }, cache: { cacheLocation: 'sessionStorage' } });
    const current=client;
    initialization = current.initialize().then(async()=>{const result=await current.handleRedirectPromise();if(result?.account){account=result.account;current.setActiveAccount(account);}});
  }
  await initialization;
  return client;
}
export async function cloudToken() {
  if(siteAccount)return '';
  const auth = await authClient();
  if (!account) throw new Error('Sign in with Microsoft to continue.');
  try { return (await auth.acquireTokenSilent({ scopes: scopes(), account })).accessToken; }
  catch (error) { if (error instanceof InteractionRequiredAuthError) throw new Error('Your Microsoft session needs attention. Sign out and sign in again; keep unsaved items on screen until you are ready.'); throw error; }
}
export async function cloudSignOut() {
  if(siteAccount){await accountRequest('logout',{});siteAccount=null;location.assign('/');return;}
  const auth = await authClient();
  await auth.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin });
}
export function CloudGate({ children }: { children: ReactNode }) {
  const [explicitAccountLink]=useState(()=>/^#(?:register|reset)=[A-Za-z0-9_-]{43}$/.test(location.hash));
  useEffect(()=>{const openAccountLink=()=>{if(/^#(?:register|reset)=[A-Za-z0-9_-]{43}$/.test(location.hash))location.reload();};window.addEventListener('hashchange',openAccountLink);return()=>window.removeEventListener('hashchange',openAccountLink);},[]);
  const signingIn=useRef(false);
  const [canReset,setCanReset]=useState(false);
  const [signedIn, setSignedIn] = useState(false), [busy, setBusy] = useState(cloudMode), [error, setError] = useState('');
  useEffect(() => {
    if (!cloudMode&&!new URLSearchParams(location.search).has('auth')) return;
    if(explicitAccountLink){setBusy(false);return;}
    let cancelled = false;
    (async () => {
      try {
        try{const user=await accountRequest('session');siteAccount=user;if(!cancelled)setSignedIn(true);return;}catch{}
        if(!cloudMode)return;
        const auth = await authClient();
        const cached = auth.getActiveAccount() ?? (auth.getAllAccounts().length === 1 ? auth.getAllAccounts()[0] : null);
        if (!cached) return;
        account = cached;
        const response = await fetch('/api/me', { headers: { Authorization: `Bearer ${await cloudToken()}` } });
        if (!response.ok) throw new Error('Your session could not be restored. Sign in again.');
        if (!cancelled) setSignedIn(true);
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : 'Sign in again to continue.'); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  if ((!cloudMode&&!new URLSearchParams(location.search).has('auth')) || signedIn) return children;
  async function signIn() {
    if(signingIn.current)return;
    if(!cloudMode){setError('Microsoft sign-in is available in the deployed environment.');return;}
    signingIn.current=true;setCanReset(false);setBusy(true); setError('');
    try {
      const result = await (await authClient()).loginPopup({ scopes: scopes() });
      account = result.account;
      (await authClient()).setActiveAccount(account);
      // The API independently validates issuer, audience, scope, tenant and role.
      const response = await fetch('/api/me', { headers: { Authorization: `Bearer ${result.accessToken}` } });
      if (!response.ok) throw new Error('Access requires an EtalonOps application role. Contact the pilot administrator.');
      setSignedIn(true);
    } catch (error) {const code=(error as {errorCode?:string})?.errorCode;if(code==='interaction_in_progress'){setCanReset(true);setError('Microsoft sign-in is already running or was interrupted. Close any Microsoft sign-in popup, then select Reset Microsoft sign-in below.');}else setError(error instanceof Error ? error.message : 'Sign-in could not be completed.'); }
    finally { signingIn.current=false;setBusy(false); }
  }
  async function resetMicrosoft(){if(signingIn.current)return;setBusy(true);setError('');try{const auth=await authClient();await auth.clearCache();account=null;auth.setActiveAccount(null);setCanReset(false);}catch{setError('Could not reset Microsoft sign-in. Open EtalonOps in a private browser window and try again.');}finally{setBusy(false);}}
  return <LoginPage resetMicrosoft={canReset?resetMicrosoft:undefined} microsoft={signIn} onSite={user=>{siteAccount=user;setSignedIn(true);}} busy={busy} error={error}/>;
}
