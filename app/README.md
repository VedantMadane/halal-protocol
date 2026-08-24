# Halal dApp

The Halal frontend is a Next.js application for the protocol dashboard, governance, PSM, and
vesting views. It supports a local Anvil network, Arbitrum Sepolia, and Arbitrum One.

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app shows a clear “not deployed” state
until a complete deployment configuration is provided for the connected chain.

For a fully working local demo, run `../scripts/local-demo.sh` from the repository root. It starts
Anvil, deploys the contracts, writes `.env.local`, and launches this app with a faucet-backed `mDAI`
reserve. This reserve is for local testing only and is not a real stablecoin or production asset.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL_31337` | Optional Anvil RPC URL; defaults to `http://127.0.0.1:8545` |
| `NEXT_PUBLIC_RPC_URL_421614` | Optional Arbitrum Sepolia RPC URL; falls back to the public chain endpoint |
| `NEXT_PUBLIC_RPC_URL_42161` | Optional Arbitrum One RPC URL; falls back to the public chain endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect/Reown project ID; injected wallets work without it |

For each supported chain, set all nine `NEXT_PUBLIC_HLC_*_<chainId>` variables in `.env.local`:
the seven contract addresses, `RESERVE_SYMBOL`, and `DEPLOYMENT_BLOCK`. The accepted suffixes are
`31337`, `421614`, and `42161`. Addresses are validated at startup and incomplete configurations
remain disabled. The deployment block bounds the governance event scan, so set it to the block where
the DAO deployment was mined.

Never put private keys or signing secrets in this file. Every `NEXT_PUBLIC_*` value ships to the
browser.

## Checks

```bash
pnpm lint
pnpm build
```

Regenerate contract ABIs after changing Solidity interfaces:

```bash
pnpm gen:abis
```

The frontend is a read/write client for deployed contracts. Contract sources and deployment
instructions live in [`../contracts`](../contracts) and [`../docs`](../docs).
