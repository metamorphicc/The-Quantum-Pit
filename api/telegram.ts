import { botToken, webhookSecret } from './_lib/env'
import { getProduct } from './_lib/products'
import { claimOnce, grantEntitlement, keys, storeConfigured } from './_lib/store'

/** Minimal shape of the Vercel Node request/response - avoids a dependency. */
interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Res {
  status: (code: number) => Res
  json: (body: unknown) => void
  end: (body?: string) => void
}

declare const process: { env: Record<string, string | undefined> }
const CAPTION = [
  '<b>QUANTUM PIT</b>',
  '<i>Polymarket trader simulator</i>',
  '',
  'Max is 18, underfunded, and trying to turn research into edge. One desk, one tiny bankroll, too many quotes.',
  '',
  'Six invented questions on a board. Read them, size them, watch the machine decide.',
  '',
  'Your job is smaller than his: keep his Edge sharp, his Focus alive, his Heat down and his Rep alive. Tap him to check the PnL. He will pretend not to need the audience.',
  '',
  '<i>Paper trading only. No real money, no real orders, no wallet, no chain - the bankroll is a number in a save file.</i>',
].join('\n')

const NUDGE =
  'The desk is through the button below. He does not read messages - he is busy staring at a quote.'

const BUTTON_TEXT = '->  Take the Desk  <-'
function appUrl(): string {
  const explicit = process.env.APP_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  // Vercel exposes the stable production hostname to the function at runtime.
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? ''
  return host ? `https://${host.replace(/\/+$/, '')}` : ''
}

function imageUrl(): string {
  const explicit = process.env.START_IMAGE_URL
  if (explicit) return explicit
  const base = appUrl()
  return base ? `${base}/start-banner.png` : ''
}

function keyboard(): unknown {
  const url = appUrl()
  // A web_app button needs an https URL. Without one, fall back to no keyboard
  // rather than sending Telegram something it will reject.
  if (!url.startsWith('https://')) return undefined
  return { inline_keyboard: [[{ text: BUTTON_TEXT, web_app: { url } }]] }
}

async function callBot(method: string, payload: Record<string, unknown>): Promise<boolean> {
  const token = botToken()
  if (!token) return false
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Photo + caption, with a text-only fallback if the image cannot be fetched. */
async function sendIntro(chatId: number): Promise<void> {
  const markup = keyboard()
  const photo = imageUrl()

  if (photo) {
    const ok = await callBot('sendPhoto', {
      chat_id: chatId,
      photo,
      caption: CAPTION,
      parse_mode: 'HTML',
      reply_markup: markup,
    })
    if (ok) return
    // Telegram could not fetch the image (bad URL, not deployed yet, 404).
    // Sending the words is better than sending nothing.
  }

  await callBot('sendMessage', {
    chat_id: chatId,
    text: CAPTION,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: markup,
  })
}

function header(req: Req, name: string): string {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

function parseBody(body: unknown): Record<string, any> | null {
  if (!body) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }
  return typeof body === 'object' ? (body as Record<string, any>) : null
}
/** Pulls the productId out of the invoice payload we set when creating it. */
function payloadProductId(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  try {
    const parsed = JSON.parse(raw) as { productId?: unknown }
    return typeof parsed.productId === 'string' ? parsed.productId : ''
  } catch {
    return ''
  }
}

/** A pre-checkout is approved only if the item and Star amount still match. */
function validatePreCheckout(pcq: Record<string, any>): boolean {
  if (pcq?.currency !== 'XTR') return false
  const product = getProduct(payloadProductId(pcq?.invoice_payload))
  if (!product) return false
  return typeof pcq?.total_amount === 'number' && pcq.total_amount === product.priceStars
}

/**
 * Records a completed Stars payment and grants the cosmetic to the payer.
 * Idempotent: the charge id is claimed once, so a replayed update is a no-op.
 * Throws only on store/network failure, so the handler can return non-200 and
 * let Telegram retry - a validation miss returns quietly instead.
 */
async function grantFromPayment(message: Record<string, any>): Promise<void> {
  const sp = message?.successful_payment
  const chargeId = typeof sp?.telegram_payment_charge_id === 'string' ? sp.telegram_payment_charge_id : ''
  const product = getProduct(payloadProductId(sp?.invoice_payload))
  const payerId = message?.from?.id
  if (!chargeId || !product || typeof payerId !== 'number') return
  if (!storeConfigured()) return

  const uid = String(payerId)
  const record = JSON.stringify({
    rail: 'telegram-stars',
    productId: product.id,
    uid,
    chargeId,
    amount: typeof sp?.total_amount === 'number' ? sp.total_amount : product.priceStars,
    at: Date.now(),
  })

  // SADD is idempotent, so granting before recording is safe under retries.
  await grantEntitlement(keys.tgEntitlements(uid), product.id)
  const fresh = await claimOnce(keys.tgPayment(chargeId), record)

  if (fresh) {
    const chatId = message?.chat?.id
    if (typeof chatId === 'number') {
      await callBot('sendMessage', {
        chat_id: chatId,
        text: `Unlocked: ${product.name}. Pure style, zero edge.`,
      })
    }
  }
}
export default async function handler(req: Req, res: Res): Promise<void> {
  // A GET is handy for eyeballing that the function deployed at all.
  if (req.method !== 'POST') {
    res.status(200).json({
      ok: true,
      what: 'Quantum Pit bot webhook',
      configured: Boolean(botToken()),
      payments: storeConfigured(),
      app: appUrl() || null,
    })
    return
  }

  const secret = webhookSecret()
  if (secret && header(req, 'x-telegram-bot-api-secret-token') !== secret) {
    res.status(401).end()
    return
  }

  const update = parseBody(req.body)

  // 1. Pre-checkout - must be answered within seconds, and only for a real
  //    item at the price we set.
  const pcq = update?.pre_checkout_query
  if (pcq && typeof pcq.id === 'string') {
    const ok = validatePreCheckout(pcq)
    await callBot(
      'answerPreCheckoutQuery',
      ok
        ? { pre_checkout_query_id: pcq.id, ok: true }
        : {
            pre_checkout_query_id: pcq.id,
            ok: false,
            error_message: 'This item is no longer available at that price.',
          },
    )
    res.status(200).end()
    return
  }

  const message = update?.message ?? update?.edited_message

  // 2. Successful payment - grant the item. Return 500 on a store failure so
  //    Telegram retries; the grant is idempotent, so retries are safe.
  if (message?.successful_payment) {
    try {
      await grantFromPayment(message)
      res.status(200).end()
    } catch {
      res.status(500).end()
    }
    return
  }

  const chatId: unknown = message?.chat?.id
  const text: string = typeof message?.text === 'string' ? message.text : ''

  // Always 200, always fast: a non-2xx makes Telegram retry the same update.
  if (typeof chatId !== 'number') {
    res.status(200).end()
    return
  }

  const command = text.trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase() ?? ''

  if (command === '/start' || command === '/help' || command === '/play') {
    await sendIntro(chatId)
  } else if (text) {
    await callBot('sendMessage', {
      chat_id: chatId,
      text: NUDGE,
      reply_markup: keyboard(),
    })
  }

  res.status(200).end()
}
