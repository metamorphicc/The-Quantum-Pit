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
 * SET key value NX - records a fact exactly once. Returns true when THIS call
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

/** Increments a short-lived counter. Used for coarse abuse throttling. */
export async function incrementExpiring(key: string, windowSec: number): Promise<number> {
  const result = await redis(['INCR', key])
  const count = typeof result === 'number' ? result : Number(result)
  if (!Number.isFinite(count)) throw new Error('Store counter failed.')
  if (count === 1) await redis(['EXPIRE', key, windowSec])
  return count
}

export const keys = {
  tgPayment: (chargeId: string): string => `pay:tg:${chargeId}`,
  basePayment: (txHash: string): string => `pay:base:${txHash.toLowerCase()}`,
  tgEntitlements: (uid: string): string => `ent:tg:${uid}`,
  baseEntitlements: (addr: string): string => `ent:base:${addr.toLowerCase()}`,
}
