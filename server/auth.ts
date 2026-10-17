import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { randomBytes } from 'node:crypto';
import type { Principal } from './contracts';
import { ApiError } from './contracts';

export type AuthOptions = { mode: 'local' } | { mode: 'entra'; tenant: string; audience: string };
export function createAuth(options: AuthOptions) {
  const secret = randomBytes(32); // Local tokens die on server restart; never saved in browser storage.
  const issuer = options.mode === 'entra' ? `https://login.microsoftonline.com/${options.tenant}/v2.0` : 'urn:etalonops:local';
  if (options.mode === 'entra' && (!/^[0-9a-f-]{36}$/i.test(options.tenant) || !options.audience)) throw new Error('Explicit Entra tenant and API audience required.');
  const key = options.mode === 'entra' ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${options.tenant}/discovery/v2.0/keys`)) : secret;
  return {
    async issueLocal(identity: string) {
      if (options.mode !== 'local') throw new ApiError(404, 'Not found.');
      if (!['foreman-one', 'foreman-two', 'admin'].includes(identity)) throw new ApiError(400, 'Unknown local test identity.');
      return new SignJWT({ tid: 'local-development', oid: identity, roles: [identity === 'admin' ? 'Admin' : 'Foreman'], scp: 'access_as_user' })
        .setProtectedHeader({ alg: 'HS256' }).setIssuer(issuer).setAudience('etalonops-local-api').setSubject(identity).setIssuedAt().setExpirationTime('1h').sign(secret);
    },
    async verify(token: string): Promise<Principal> {
      try {
        const { payload } = await jwtVerify(token, key, { issuer, audience: options.mode === 'entra' ? options.audience : 'etalonops-local-api', algorithms: [options.mode === 'entra' ? 'RS256' : 'HS256'], requiredClaims: ['exp', 'iat', 'tid', 'oid', 'scp', 'roles'] });
        const tenant = options.mode === 'entra' ? options.tenant : 'local-development';
        if (payload.tid !== tenant || typeof payload.oid !== 'string' || typeof payload.scp !== 'string' || !payload.scp.split(' ').includes('access_as_user') || !Array.isArray(payload.roles)) throw new Error('Invalid claims');
        const roles = payload.roles.filter((role): role is string => typeof role === 'string' && ['Admin', 'Foreman'].includes(role));
        if (!roles.length) throw new ApiError(403, 'Application assignment required.');
        return { tenant, oid: payload.oid, roles };
      } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(401, 'Valid API access token required.'); }
    },
  };
}
