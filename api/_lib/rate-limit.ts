import type { Req, Res } from './http'
import { header } from './http'
import { incrementExpiring, storeConfigured } from './store'

function clientKey(req: Req): string {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0]?.trim()
  const real = header(req, 'x-real-ip').trim()
  const raw = forwarded || real || 'unknown'
  return raw.replace(/[^a-zA-Z0-9:._-]/g, '_').slice(0, 80)
}

export async function enforceRateLimit(
  req: Req,
  res: Res,
  name: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  if (!storeConfigured()) return true

  try {
    const count = await incrementExpiring(`rl:${name}:${clientKey(req)}`, windowSec)
    if (count <= limit) return true
    res.status(429).json({ error: 'Too many requests. Try again shortly.' })
    return false
  } catch {
    res.status(503).json({ error: 'Rate limit is temporarily unavailable.' })
    return false
  }
}
