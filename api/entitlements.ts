import type { Req, Res } from './_lib/http'
import { asString, parseBody } from './_lib/http'
import { botToken } from './_lib/env'
import { keys, listEntitlements, storeConfigured } from './_lib/store'
import { validateInitData } from './_lib/telegram-auth'

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, what: 'Quantum Pit entitlements', configured: storeConfigured() })
    return
  }

  if (!storeConfigured()) {
    res.status(200).json({ owned: [], configured: false })
    return
  }

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
      // Do not restore Base entitlements from a bare walletAddress. Anyone can
      // type an address; a future SIWE/personal_sign proof should unlock this.
      res.status(200).json({ owned: [], configured: true, authRequired: true })
      return
    }

    res.status(200).json({ owned: [], configured: true })
  } catch {
    res.status(200).json({ owned: [], configured: true })
  }
}
