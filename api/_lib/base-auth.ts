import { verifyMessage } from 'viem'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const MAX_AGE_MS = 5 * 60 * 1000

interface BaseProof {
  walletAddress: string
  message: string
  signature: string
}

function expectedMessage(walletAddress: string, issuedAt: number): string {
  return [
    'Quantum Pit Base entitlement restore',
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Issued At: ${issuedAt}`,
    'Purpose: restore-cosmetics',
  ].join('\n')
}

export function baseEntitlementMessage(walletAddress: string, issuedAt: number): string {
  if (!ADDRESS_RE.test(walletAddress)) return ''
  return expectedMessage(walletAddress, issuedAt)
}

export async function verifyBaseEntitlementProof(proof: BaseProof): Promise<boolean> {
  const wallet = proof.walletAddress.toLowerCase()
  if (!ADDRESS_RE.test(wallet)) return false
  if (!/^0x[a-fA-F0-9]+$/.test(proof.signature)) return false

  const match = proof.message.match(/^Quantum Pit Base entitlement restore\nWallet: (0x[a-fA-F0-9]{40})\nIssued At: (\d+)\nPurpose: restore-cosmetics$/)
  if (!match) return false
  if (match[1]!.toLowerCase() !== wallet) return false

  const issuedAt = Number(match[2])
  if (!Number.isSafeInteger(issuedAt)) return false
  const age = Math.abs(Date.now() - issuedAt)
  if (age > MAX_AGE_MS) return false
  if (proof.message !== expectedMessage(wallet, issuedAt)) return false

  try {
    return await verifyMessage({
      address: wallet as `0x${string}`,
      message: proof.message,
      signature: proof.signature as `0x${string}`,
    })
  } catch {
    return false
  }
}
