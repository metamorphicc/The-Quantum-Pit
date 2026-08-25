import type {
  CosmeticDef,
  DonationPaymentProvider,
  GameState,
  LoginMethod,
} from '../game/types'
import { openTelegramInvoice, tgInitData } from '../telegram/telegram'
import { baseProvider, ensureBaseChain } from '../web3/baseAccount'

/* ==========================================================================
   Cosmetic checkout — client half.

   The client never decides ownership. It kicks off a payment on the rail that
   matches how the player logged in (Telegram → Stars, Base → USDC) and then
   waits for the SERVER to confirm it:
     - Base:  poll /api/checkout/base-verify until the tx is confirmed onchain.
     - Stars: poll /api/entitlements until Telegram's webhook has granted it.
   payForCosmetic only resolves once the server says the item is owned, so a
   forged "paid" status can never unlock anything.
   ========================================================================== */

type Env = Record<string, string | undefined>

interface TxPayload {
  to?: string
  data?: string
  value?: string
}

interface InvoicePayload {
  invoiceUrl?: string
  url?: string
}

interface VerifyResponse {
  verified?: boolean
  pending?: boolean
  owned?: string[]
  error?: string
}

interface EntitlementsResponse {
  owned?: string[]
}

export interface CosmeticReceipt {
  provider: DonationPaymentProvider
  id: string
}

function env(): Env {
  return (import.meta as ImportMeta & { env: Env }).env
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function providerLabel(provider: DonationPaymentProvider): string {
  switch (provider) {
    case 'base':
      return 'Base'
    case 'telegram-stars':
      return 'Stars'
  }
}

export function providersForLogin(method: LoginMethod | null): DonationPaymentProvider[] {
  if (method === 'base') return ['base']
  if (method === 'telegram') return ['telegram-stars']
  return []
}

function identityBody(state: GameState): Record<string, unknown> {
  return {
    loginMethod: state.loginMethod,
    walletAddress: state.walletAddress,
    telegramInitData: state.loginMethod === 'telegram' ? tgInitData() : null,
  }
}

function checkoutBody(cosmetic: CosmeticDef, state: GameState): string {
  return JSON.stringify({
    productId: cosmetic.id,
    productName: cosmetic.name,
    priceUsd: cosmetic.priceUsd,
    priceStars: cosmetic.priceStars,
    ...identityBody(state),
  })
}

async function postJson<T>(url: string, body: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  if (!response.ok) {
    let message = `Checkout rejected (${response.status}).`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* keep the status-code message */
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

/* --------------------------------------------------------------------------
   Entitlements — the server's owned list for the current identity.
   -------------------------------------------------------------------------- */

export async function fetchEntitlements(state: GameState): Promise<string[]> {
  if (state.loginMethod !== 'telegram' && state.loginMethod !== 'base') return []
  const endpoint = env().VITE_QP_ENTITLEMENTS_URL ?? '/api/entitlements'
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(identityBody(state)),
    })
    if (!response.ok) return []
    const data = (await response.json()) as EntitlementsResponse
    return Array.isArray(data.owned) ? data.owned.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function waitForEntitlement(
  state: GameState,
  productId: string,
  tries: number,
  gapMs: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt++) {
    const owned = await fetchEntitlements(state)
    if (owned.includes(productId)) return true
    if (attempt < tries - 1) await delay(gapMs)
  }
  return false
}

/* --------------------------------------------------------------------------
   Base — pay in USDC, then confirm the transaction onchain server-side.
   -------------------------------------------------------------------------- */

async function payWithBase(cosmetic: CosmeticDef, state: GameState): Promise<CosmeticReceipt> {
  if (!state.walletAddress) throw new Error('Connect Base Account before buying cosmetics.')
  const endpoint = env().VITE_QP_BASE_COSMETIC_CHECKOUT_URL ?? '/api/checkout/base-cosmetic'
  const verifyEndpoint = env().VITE_QP_BASE_VERIFY_URL ?? '/api/checkout/base-verify'

  await ensureBaseChain()
  const eth = baseProvider()
  if (!eth) throw new Error('No wallet found. Open in Base App or connect Base Account first.')

  const payload = await postJson<TxPayload>(endpoint, checkoutBody(cosmetic, state))
  if (!payload.data || typeof payload.data !== 'string') {
    throw new Error('Checkout did not return transaction data.')
  }

  const tx = await eth.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: state.walletAddress,
        to: payload.to,
        data: payload.data,
        value: payload.value ?? '0x0',
      },
    ],
  })
  if (typeof tx !== 'string') throw new Error('Wallet did not return a transaction hash.')

  // The grant is the server's call. Poll while the tx settles on Base.
  const verifyBody = JSON.stringify({
    productId: cosmetic.id,
    walletAddress: state.walletAddress,
    txHash: tx,
  })
  for (let attempt = 0; attempt < 8; attempt++) {
    const data = await postJson<VerifyResponse>(verifyEndpoint, verifyBody)
    if (data.verified) return { provider: 'base', id: tx }
    if (!data.pending) throw new Error(data.error ?? 'Payment could not be verified on Base.')
    await delay(2500)
  }
  throw new Error('Payment sent. It will unlock once the Base transaction confirms — check back shortly.')
}

/* --------------------------------------------------------------------------
   Telegram Stars — open the invoice, then wait for the webhook's grant.
   -------------------------------------------------------------------------- */

async function payWithStars(cosmetic: CosmeticDef, state: GameState): Promise<CosmeticReceipt> {
  const endpoint = env().VITE_QP_TELEGRAM_STARS_CHECKOUT_URL ?? '/api/checkout/telegram-stars'

  const payload = await postJson<InvoicePayload>(endpoint, checkoutBody(cosmetic, state))
  const invoiceUrl = payload.invoiceUrl ?? payload.url
  if (!invoiceUrl) throw new Error('Checkout did not return a Telegram invoice URL.')

  // The client-reported status is a hint, not proof: only continue on 'paid',
  // but still confirm the grant with the server before unlocking.
  const status = await openTelegramInvoice(invoiceUrl)
  if (status !== 'paid') throw new Error(`Telegram invoice closed as ${status}.`)

  const granted = await waitForEntitlement(state, cosmetic.id, 8, 1500)
  if (!granted) {
    throw new Error('Telegram is still confirming the payment. The item unlocks in a moment.')
  }
  return { provider: 'telegram-stars', id: `stars:${cosmetic.id}` }
}

export async function payForCosmetic(
  cosmetic: CosmeticDef,
  state: GameState,
  provider: DonationPaymentProvider,
): Promise<CosmeticReceipt> {
  if (provider === 'base') return payWithBase(cosmetic, state)
  return payWithStars(cosmetic, state)
}
