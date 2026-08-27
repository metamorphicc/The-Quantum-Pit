declare const process: { env: Record<string, string | undefined> }

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/** Bot API token. New name preferred; legacy BOT_TOKEN still honoured. */
export function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
}

export function webhookSecret(): string {
  return process.env.WEBHOOK_SECRET || ''
}

/** Base wallet that receives cosmetic payments. Empty string if unset/invalid. */
export function treasuryAddress(): string {
  const a = process.env.TREASURY_ADDRESS || process.env.BASE_COSMETIC_TREASURY_ADDRESS || ''
  return ADDRESS_RE.test(a) ? a : ''
}

/** Read-only JSON-RPC endpoint used to confirm Base transactions. */
export function baseRpcUrl(): string {
  return process.env.BASE_RPC_URL || 'https://mainnet.base.org'
}

/** Optional donation-contract address, purely informational for the client. */
export function donationContractAddress(): string {
  const a = process.env.DONATION_CONTRACT_ADDRESS || ''
  return ADDRESS_RE.test(a) ? a : ''
}
