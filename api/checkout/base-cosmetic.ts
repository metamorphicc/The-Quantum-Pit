import type { Req, Res } from '../_lib/http'
import { parseBody, rejectUnsafeJson, rejectUnsupportedMethod } from '../_lib/http'
import { treasuryAddress } from '../_lib/env'
import { getProduct } from '../_lib/products'
import { BASE_USDC } from '../_lib/base-rpc'
import { enforceRateLimit } from '../_lib/rate-limit'

const TRANSFER_SELECTOR = 'a9059cbb'
const BASE_CHAIN_ID = '0x2105'

function uint256Hex(value: bigint): string {
  return value.toString(16).padStart(64, '0')
}

function addressArg(address: string): string {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0')
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const treasury = treasuryAddress()

  if (rejectUnsupportedMethod(req, res)) return
  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      what: 'Quantum Pit Base cosmetic checkout',
      configured: Boolean(treasury),
      token: BASE_USDC,
    })
    return
  }
  if (rejectUnsafeJson(req, res)) return

  if (!treasury) {
    res.status(500).json({ error: 'Treasury address is not configured.' })
    return
  }
  if (!(await enforceRateLimit(req, res, 'base-cosmetic', 40, 60))) return

  const body = parseBody(req.body)
  const product = getProduct(body.productId)
  if (!product) {
    res.status(400).json({ error: 'Unknown cosmetic product.' })
    return
  }

  const amount = product.usdcUnits
  const data = `0x${TRANSFER_SELECTOR}${addressArg(treasury)}${uint256Hex(amount)}`

  res.status(200).json({
    productId: product.id,
    productName: product.name,
    token: BASE_USDC,
    to: BASE_USDC,
    data,
    value: '0x0',
    amount: amount.toString(),
    currency: 'USDC',
    chainId: BASE_CHAIN_ID,
  })
}
