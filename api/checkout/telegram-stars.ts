/* ==========================================================================
   Telegram Stars cosmetic checkout — create an invoice link.

   Hardening over the original:
     - validates the caller's Telegram initData (HMAC) and binds the buyer's
       user id into the invoice payload, so the webhook can only entitle the
       identity that actually opened checkout;
     - prices come from the server catalogue, never the request body;
     - refuses when the payment store is not configured, because a Stars charge
       we cannot record or grant server-side must not be taken.

   Env: TELEGRAM_BOT_TOKEN (or legacy BOT_TOKEN), plus a configured KV store.
   ========================================================================== */

import type { Req, Res } from '../_lib/http'
import { parseBody } from '../_lib/http'
import { botToken } from '../_lib/env'
import { getProduct } from '../_lib/products'
import { storeConfigured } from '../_lib/store'
import { validateInitData } from '../_lib/telegram-auth'

async function callBot(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as { ok?: boolean; result?: unknown; description?: string }
  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram ${method} failed.`)
  }
  return data.result
}

function nonce(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const token = botToken()

  if (req.method !== 'POST') {
    res.status(200).json({
      ok: true,
      what: 'Quantum Pit Telegram Stars checkout',
      configured: Boolean(token) && storeConfigured(),
    })
    return
  }

  if (!token) {
    res.status(500).json({ error: 'Telegram bot token is not configured.' })
    return
  }
  if (!storeConfigured()) {
    res.status(503).json({ error: 'Payments are temporarily unavailable.' })
    return
  }

  const body = parseBody(req.body)
  const product = getProduct(body.productId)
  if (!product) {
    res.status(400).json({ error: 'Unknown cosmetic product.' })
    return
  }

  const initData = typeof body.telegramInitData === 'string' ? body.telegramInitData : ''
  const identity = await validateInitData(initData, token)
  if (!identity) {
    res.status(401).json({ error: 'Open the shop inside Telegram to buy with Stars.' })
    return
  }

  try {
    const payload = JSON.stringify({
      v: 1,
      productId: product.id,
      uid: identity.userId,
      n: nonce(),
    })
    const invoiceUrl = await callBot(token, 'createInvoiceLink', {
      title: product.name,
      description: product.desc,
      payload,
      provider_token: '', // Stars (XTR) must use an empty provider token.
      currency: 'XTR',
      prices: [{ label: product.name, amount: product.priceStars }],
    })

    res.status(200).json({ invoiceUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create invoice.'
    res.status(502).json({ error: message })
  }
}
