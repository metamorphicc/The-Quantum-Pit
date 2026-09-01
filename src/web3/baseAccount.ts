export interface BaseAccountConnection {
  address: string
  chainId: string | null
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  isCoinbaseWallet?: boolean
}

const BASE_CHAIN_ID = '0x2105'

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export function baseProvider(): EthereumProvider | null {
  return window.ethereum && typeof window.ethereum.request === 'function'
    ? window.ethereum
    : null
}

export function baseAccountAvailable(): boolean {
  return baseProvider() !== null
}

export function shortAddress(address: string | null): string {
  if (!address) return 'No wallet'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export async function connectBaseAccount(): Promise<BaseAccountConnection> {
  const eth = baseProvider()
  if (!eth) {
    throw new Error('No wallet found. Open in Base App or a browser with Coinbase Wallet.')
  }

  const accounts = await eth.request({ method: 'eth_requestAccounts' })
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') {
    throw new Error('Wallet did not return an account.')
  }

  let chainId: string | null = null
  try {
    const id = await eth.request({ method: 'eth_chainId' })
    chainId = typeof id === 'string' ? id : null
  } catch {
    chainId = null
  }

  return { address: accounts[0], chainId }
}

export function baseEntitlementMessage(walletAddress: string, issuedAt: number): string {
  return [
    'Quantum Pit Base entitlement restore',
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Issued At: ${issuedAt}`,
    'Purpose: restore-cosmetics',
  ].join('\n')
}

export async function signBaseEntitlementProof(
  walletAddress: string,
): Promise<{ message: string; signature: string } | null> {
  const eth = baseProvider()
  if (!eth) return null

  const issuedAt = Date.now()
  const message = baseEntitlementMessage(walletAddress, issuedAt)
  const signature = await eth.request({
    method: 'personal_sign',
    params: [message, walletAddress],
  })

  return typeof signature === 'string' ? { message, signature } : null
}

export async function ensureBaseChain(): Promise<void> {
  const eth = baseProvider()
  if (!eth) throw new Error('No wallet found. Open in Base App or connect Base Account first.')

  const current = await eth.request({ method: 'eth_chainId' })
  if (current === BASE_CHAIN_ID) return

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID }],
    })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : null
    if (code !== 4902) throw error
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: BASE_CHAIN_ID,
          chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        },
      ],
    })
  }
}
