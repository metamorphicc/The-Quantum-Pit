/* ==========================================================================
   Payment store — a thin Redis-over-HTTP client (Upstash / Vercel KV REST).

   Why this exists: entitlements must be decided by the server, not the client.
   That needs somewhere durable to record "this charge was processed" (so a
   replayed webhook cannot double-grant) and "this identity owns these items".

   Zero dependencies: the REST API takes a command as a JSON array in the POST
   body and answers { result } or { error }.

   Configured via either name pair:
     KV_REST_API_URL       / KV_REST_API_TOKEN          (Vercel KV integration)
     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash native)

   Everything fails CLOSED: if the store is not configured, the callers refuse
   to take payment or grant entitlements rather than trusting the client.
   ========================================================================== */

declare const process: { env: Record<string, string | undefined> }

interface StoreConfig {
  url: string
  token: string
}

function config(): StoreConfig | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

export function storeConfigured(): boolean {
  return config() !== null
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const cfg = config()
  if (!cfg) throw new Error('Payment store is not configured.')
  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  const data = (await response.json()) as { result?: unknown; error?: string }
  if (data.error) throw new Error(data.error)
  if (!response.ok) throw new Error(`Store command failed (${response.status}).`)
  return data.result
}

/**
 * SET key value NX — records a fact exactly once. Returns true when THIS call
 * created the key (first time), false when it already existed (a replay). The
 * value doubles as the stored payment record.
 */
export async function claimOnce(key: string, value: string): Promise<boolean> {
  const result = await redis(['SET', key, value, 'NX'])
  return result === 'OK'
}

/** Adds a product id to an identity's owned set. Idempotent by nature. */
export async function grantEntitlement(entitlementKey: string, productId: string): Promise<void> {
  await redis(['SADD', entitlementKey, productId])
}

/** Reads the product ids an identity owns. */
export async function listEntitlements(entitlementKey: string): Promise<string[]> {
  const result = await redis(['SMEMBERS', entitlementKey])
  return Array.isArray(result) ? result.filter((x): x is string => typeof x === 'string') : []
}

/* --------------------------------------------------------------------------
   Key namespaces. Payment keys hold the record + guarantee idempotency;
   entitlement keys hold the owned set per identity.
   -------------------------------------------------------------------------- */

export const keys = {
  tgPayment: (chargeId: string): string => `pay:tg:${chargeId}`,
  basePayment: (txHash: string): string => `pay:base:${txHash.toLowerCase()}`,
  tgEntitlements: (uid: string): string => `ent:tg:${uid}`,
  baseEntitlements: (addr: string): string => `ent:base:${addr.toLowerCase()}`,
}
