const encoder = new TextEncoder()

export interface TelegramIdentity {
  userId: string
  username: string | null
}

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return new Uint8Array(signature)
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Returns the verified identity, or null if the signature is missing, wrong,
 * or older than maxAgeSec (a stale initData should not keep granting forever).
 */
export async function validateInitData(
  initData: string,
  token: string,
  maxAgeSec = 86_400,
): Promise<TelegramIdentity | null> {
  if (!initData || !token) return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return null
  }

  const hash = params.get('hash')
  if (!hash) return null

  // `hash` is what we compare against; `signature` is the separate Ed25519
  // method and is not part of the HMAC check string.
  params.delete('hash')
  params.delete('signature')

  const pairs = [...params.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
  const dataCheckString = pairs.join('\n')

  const secretKey = await hmacSha256(encoder.encode('WebAppData'), token)
  const expected = toHex(await hmacSha256(secretKey, dataCheckString))
  if (!timingSafeEqualHex(expected, hash.toLowerCase())) return null

  const authDate = Number(params.get('auth_date') ?? '0')
  if (!Number.isFinite(authDate) || authDate <= 0) return null
  const ageSec = Math.floor(Date.now() / 1000) - authDate
  if (ageSec > maxAgeSec) return null

  const userRaw = params.get('user')
  if (!userRaw) return null
  let user: { id?: unknown; username?: unknown }
  try {
    user = JSON.parse(userRaw) as { id?: unknown; username?: unknown }
  } catch {
    return null
  }
  if (typeof user.id !== 'number' || !Number.isFinite(user.id)) return null

  return {
    userId: String(user.id),
    username: typeof user.username === 'string' ? user.username : null,
  }
}
