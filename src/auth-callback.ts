import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
broadcastResponseToMainFrame().catch(() => { document.body.textContent = 'Sign-in response could not be completed. Close this window and try signing in again.'; });
