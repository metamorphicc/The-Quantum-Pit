/* ==========================================================================
   Entitlements — the server's record of which cosmetics an identity owns.

   The client calls this after login to restore purchases (across devices) and
   after a Stars checkout to confirm the webhook has granted the item. It is
   the trustworthy counterpart to localStorage: only items verified through a
   real payment appear here.

   Request:  { loginMethod, telegramInitData?, walletAddress? }
   Response: 200 { owned:[...], configured:boolean }

   Reads only — never grants. Returns an empty list (not an error) when the
   store is unconfigured or the identity cannot be verified, so a best-effort
   sync never breaks the client.
   ========================================================================== */

import type { Req, Res } from './_lib/http'
import { asString, parseBody } from './_lib/http'
import { botToken } from './_lib/env'
import { keys, listEntitlements, storeConfigured } from './_lib/store'
import { validateInitData } from './_lib/telegram-auth'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

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
      const wallet = asString(body.walletAddress)
      if (!ADDRESS_RE.test(wallet)) {
        res.status(200).json({ owned: [], configured: true })
        return
      }
      const owned = await listEntitlements(keys.baseEntitlements(wallet))
      res.status(200).json({ owned, configured: true })
      return
    }

    res.status(200).json({ owned: [], configured: true })
  } catch {
    res.status(200).json({ owned: [], configured: true })
  }
}
