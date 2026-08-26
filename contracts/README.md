# Quantum Pit — donation contract (optional)

`QuantumPitDonations` is an **optional** onchain donation receiver. The game's
cosmetic checkout already works with a plain treasury address (see the Base
rail in [`PAYMENTS.md`](../PAYMENTS.md)) — deploy this only if you want onchain,
indexable donation records (one event per donation, tagged with a `ref` you can
map back to a user).

- `donate(bytes32 ref)` — donate native ETH.
- `donateERC20(token, amount, ref)` — donate any ERC-20 (needs `approve` first).
- `receive()` — a bare ETH send counts as an untagged donation.
- `withdraw` / `withdrawERC20` — owner-only.
- Owner is set at deploy time to `TREASURY_ADDRESS`.

## Prerequisites

```bash
curl -L https://foundry.paradigm.xyz | bash   # then restart your shell
foundryup
```

From `contracts/`:

```bash
forge install foundry-rs/forge-std
```

## Configure (no keys in source)

```bash
cp .env.example .env      # then edit .env
```

Fill in a **dedicated deployer key** (funded with Base Sepolia ETH from a
faucet, e.g. https://www.alchemy.com/faucets/base-sepolia) and your
`TREASURY_ADDRESS`. `.env` is gitignored — keep it that way.

## Build & test

```bash
forge build
forge test
```

## Deploy — Base Sepolia FIRST

Load the env, then dry-run (no broadcast) to confirm everything resolves:

```bash
set -a && source .env && set +a
forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia
```

When the dry run looks right, **this is the final command that actually
deploys** (broadcasts a real transaction and spends testnet gas):

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
```

Copy the printed address into your Vercel env as `DONATION_CONTRACT_ADDRESS`.

## Mainnet (only after Sepolia is verified end-to-end)

Same command against Base mainnet — real ETH, real gas:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify
```
