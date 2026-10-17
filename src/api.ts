import type { Candidate, Draft } from './domain';

export const databaseMode = window.location.protocol !== 'file:' && new URLSearchParams(window.location.search).get('database') === '1';
export const localIdentity = new URLSearchParams(window.location.search).get('identity') ?? 'foreman-one';
let token: string | null = null;
let tokenPromise: Promise<string> | null = null;
type SavedDraft = Omit<Draft, 'ownerId' | 'schemaVersion'> & { id: string; version: number };
async function accessToken(): Promise<string> {
  if (token) return token;
  if (!tokenPromise) tokenPromise = fetch('/api/dev/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: localIdentity }) })
    .then(async response => { if (!response.ok) throw new Error('Local database session unavailable. Start the local API; Microsoft sign-in is not configured.'); token = (await response.json()).token; return token!; })
    .finally(() => { tokenPromise = null; });
  return tokenPromise;
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Database request failed. Your on-screen items are preserved.');
  return value;
}
export function clearLocalSession() { token = null; tokenPromise = null; }
export async function readDatabaseDraft(projectId: string): Promise<Draft | null> {
  const { draft } = await request<{ draft: SavedDraft | null }>(`/projects/${encodeURIComponent(projectId)}/draft`);
  return draft ? { ...draft, schemaVersion: 1, ownerId: 'local-demo-foreman' } : null;
}
export async function saveDatabaseDraft(draft: Draft): Promise<Draft> {
  const { draft: saved } = await request<{ draft: SavedDraft }>(draft.id ? `/drafts/${draft.id}` : '/drafts', draft.id ? 'PUT' : 'POST', { projectId: draft.projectId, deliveryDate: draft.deliveryDate, lines: draft.lines, version: draft.version ?? 0 });
  return { ...saved, schemaVersion: 1, ownerId: 'local-demo-foreman' };
}
export async function databaseSearch(query: string) { return (await request<{ matches: Candidate[] }>(`/materials?q=${encodeURIComponent(query)}`)).matches; }
