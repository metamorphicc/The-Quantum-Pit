/* ==========================================================================
   Base onchain verification.

   Confirms a payment actually happened on Base by reading the transaction
   receipt over JSON-RPC and inspecting the ERC-20 Transfer log — the client
   is never trusted to say "I paid".

   No keccak needed: the Transfer topic and USDC address are fixed constants,
   and the ERC-20 amount lives (non-indexed) in the log `data`, so it is read
   by slicing hex. WebCrypto/fetch only — no Node type packages.
   ========================================================================== */

/** USDC on Base mainnet (6 decimals). */
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

/** keccak256("Transfer(address,address,uint256)"). */
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

interface RpcLog {
  address?: string
  topics?: string[]
  data?: string
}

interface RpcReceipt {
  status?: string
  logs?: RpcLog[]
}

async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = (await response.json()) as { result?: unknown; error?: { message?: string } }
  if (data.error) throw new Error(data.error.message ?? 'RPC error')
  if (!response.ok) throw new Error(`RPC failed (${response.status}).`)
  return data.result
}

function topicToAddress(topic: string): string | null {
  // A 32-byte topic left-pads a 20-byte address: 0x + 24 zero-nibbles + 40.
  return /^0x[0-9a-fA-F]{64}$/.test(topic) ? `0x${topic.slice(26)}` : null
}

function addressToTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`
}

export type VerifyStatus = 'confirmed' | 'pending' | 'failed'

export interface VerifyResult {
  status: VerifyStatus
  /** the paying address, taken from the Transfer log (authoritative) */
  from: string | null
}

export interface Erc20TransferQuery {
  rpcUrl: string
  txHash: string
  token: string
  recipient: string
  minUnits: bigint
}

/**
 * Verifies that `txHash` contains an ERC-20 Transfer of at least `minUnits`
 * of `token` to `recipient`.
 *   - 'pending' — no receipt yet (still mining); caller should retry.
 *   - 'failed'  — receipt exists but reverted, or no matching transfer.
 *   - 'confirmed' — a matching transfer was found.
 */
export async function verifyErc20Transfer(q: Erc20TransferQuery): Promise<VerifyResult> {
  const receipt = (await rpc(q.rpcUrl, 'eth_getTransactionReceipt', [q.txHash])) as
    | RpcReceipt
    | null
  if (!receipt) return { status: 'pending', from: null }
  if (receipt.status !== '0x1') return { status: 'failed', from: null }

  const tokenLc = q.token.toLowerCase()
  const recipientTopic = addressToTopic(q.recipient)

  for (const log of receipt.logs ?? []) {
    const topics = log.topics ?? []
    if ((log.address ?? '').toLowerCase() !== tokenLc) continue
    if ((topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue
    if ((topics[2] ?? '').toLowerCase() !== recipientTopic) continue

    const raw = log.data && log.data !== '0x' ? log.data : '0x0'
    let value: bigint
    try {
      value = BigInt(raw)
    } catch {
      continue
    }
    if (value >= q.minUnits) {
      return { status: 'confirmed', from: topicToAddress(topics[1] ?? '') }
    }
  }

  return { status: 'failed', from: null }
}
