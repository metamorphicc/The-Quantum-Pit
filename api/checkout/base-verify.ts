import type { Req, Res } from '../_lib/http'
import { asString, parseBody } from '../_lib/http'
import { baseRpcUrl, treasuryAddress } from '../_lib/env'
import { getProduct } from '../_lib/products'
import { BASE_USDC, verifyErc20Transfer } from '../_lib/base-rpc'
import { claimOnce, grantEntitlement, keys, listEntitlements, storeConfigured } from '../_lib/store'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const TXHASH_RE = /^0x[a-fA-F0-9]{64}$/

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, what: 'Quantum Pit Base verification', configured: storeConfigured() })
    return
  }

  if (!storeConfigured()) {
    res.status(503).json({ error: 'Payments are temporarily unavailable.' })
    return
  }
  const treasury = treasuryAddress()
  if (!treasury) {
    res.status(500).json({ error: 'Treasury address is not configured.' })
    return
  }

  const body = parseBody(req.body)
  const product = getProduct(body.productId)
  if (!product) {
    res.status(400).json({ error: 'Unknown cosmetic product.' })
    return
  }

  const txHash = asString(body.txHash)
  const walletAddress = asString(body.walletAddress)
  if (!TXHASH_RE.test(txHash) || !ADDRESS_RE.test(walletAddress)) {
    res.status(401).json({ error: 'A valid wallet address and transaction hash are required.' })
    return
  }

  let result
  try {
    result = await verifyErc20Transfer({
      rpcUrl: baseRpcUrl(),
      txHash,
      token: BASE_USDC,
      recipient: treasury,
      minUnits: product.usdcUnits,
    })
  } catch {
    // Transient RPC trouble - let the client retry.
    res.status(200).json({ verified: false, pending: true })
    return
  }

  if (result.status === 'pending') {
    res.status(200).json({ verified: false, pending: true })
    return
  }
  if (result.status !== 'confirmed' || !result.from) {
    res.status(400).json({ verified: false, error: 'No matching payment found in that transaction.' })
    return
  }

  // Entitle the address that actually paid (from the Transfer log), not the
  // one the client claimed. They should match; the onchain value wins.
  const payer = result.from
  const record = JSON.stringify({
    rail: 'base',
    productId: product.id,
    payer,
    claimed: walletAddress.toLowerCase(),
    txHash: txHash.toLowerCase(),
    units: product.usdcUnits.toString(),
    at: Date.now(),
  })

  try {
    // First writer processes the grant; a replayed hash is a no-op (idempotent).
    const fresh = await claimOnce(keys.basePayment(txHash), record)
    if (!fresh) {
      const owned = await listEntitlements(keys.baseEntitlements(payer))
      res.status(409).json({ verified: false, error: 'This Base transaction was already used.', owned })
      return
    }

    await grantEntitlement(keys.baseEntitlements(payer), product.id)
    const owned = await listEntitlements(keys.baseEntitlements(payer))
    res.status(200).json({ verified: true, owned })
  } catch {
    res.status(200).json({ verified: false, pending: true })
  }
}
