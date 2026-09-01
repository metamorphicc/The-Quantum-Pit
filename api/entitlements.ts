import type { Req, Res } from './_lib/http'
import { asString, parseBody, rejectUnsafeJson, rejectUnsupportedMethod } from './_lib/http'
import { verifyBaseEntitlementProof } from './_lib/base-auth'
import { botToken } from './_lib/env'
import { enforceRateLimit } from './_lib/rate-limit'
import { keys, listEntitlements, storeConfigured } from './_lib/store'
import { validateInitData } from './_lib/telegram-auth'

export default async function handler(req: Req, res: Res): Promise<void> {
  if (rejectUnsupportedMethod(req, res)) return
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, what: 'Quantum Pit entitlements', configured: storeConfigured() })
    return
  }
  if (rejectUnsafeJson(req, res)) return

  if (!storeConfigured()) {
    res.status(200).json({ owned: [], configured: false })
    return
  }
  if (!(await enforceRateLimit(req, res, 'entitlements', 60, 60))) return

  const body = parseBody(req.body)
  const loginMethod = asString(body.loginMethod)

  try {
    if (loginMethod === 'telegram') {
      const identity = await validateInitData(asString(body.telegramInitData), botToken())
      if (!identity) {
        res.status(200).json({ owned: [], configured: true })
        return
      }
      const owned = await listEntitlements(keys.tgEntitlements(identity.userId))
      res.status(200).json({ owned, configured: true })
      return
    }

    if (loginMethod === 'base') {
      const walletAddress = asString(body.walletAddress)
      const message = asString(body.message)
      const signature = asString(body.signature)
      const verified = await verifyBaseEntitlementProof({ walletAddress, message, signature })
      if (!verified) {
        res.status(200).json({ owned: [], configured: true, authRequired: true })
        return
      }

      const owned = await listEntitlements(keys.baseEntitlements(walletAddress))
      res.status(200).json({ owned, configured: true })
      return
    }

    res.status(200).json({ owned: [], configured: true })
  } catch {
    res.status(200).json({ owned: [], configured: true })
  }
}
