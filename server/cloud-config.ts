import type sql from 'mssql';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cloudConfig(env: NodeJS.ProcessEnv = process.env) {
  const tenant = env.ETALONOPS_TENANT_ID ?? '', clientId = env.ETALONOPS_CLIENT_ID ?? '', server = env.ETALONOPS_SQL_HOST ?? '';
  if (env.ETALONOPS_AUTH_MODE !== 'entra' || !guid.test(tenant) || !guid.test(clientId) || !/^[a-z0-9-]+\.database\.windows\.net$/.test(server)) throw new Error('Explicit cloud tenant, client and Azure SQL hostname are required.');
  if (env.ETALONOPS_AI_ENABLED !== 'false') throw new Error('AI must remain disabled until the full service chain is verified.');
  return { tenant, clientId, sql: { server, database: 'EtalonOps', authentication: { type: 'azure-active-directory-default', options: {} }, options: { encrypt: true, trustServerCertificate: false }, pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 }, connectionTimeout: 30_000, requestTimeout: 15_000 } satisfies sql.config };
}
