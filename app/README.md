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
until a complete deployment configuration is provided for the selected read-only or wallet chain.

For a fully working local demo, run `../scripts/local-demo.sh` from the repository root. It starts
Anvil, deploys the contracts, writes `.env.local`, and launches this app with a faucet-backed `mDAI`
reserve. This reserve is for local testing only and is not a real stablecoin or production asset.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Optional canonical public URL used for Open Graph/Twitter preview metadata |
| `NEXT_PUBLIC_READ_CHAIN_ID` | Optional chain ID for wallet-free read-only browsing; otherwise the first configured deployment is selected |
| `NEXT_PUBLIC_RPC_URL_31337` | Optional Anvil RPC URL; defaults to `http://127.0.0.1:8545` |
| `NEXT_PUBLIC_RPC_URL_421614` | Optional Arbitrum Sepolia RPC URL; falls back to the public chain endpoint |
| `NEXT_PUBLIC_RPC_URL_42161` | Optional Arbitrum One RPC URL; falls back to the public chain endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect/Reown project ID; injected wallets work without it |

Public deployments belong in the checked-in [`../app/src/config/deployment-registry.json`](src/config/deployment-registry.json).
For local experiments, set all nine `NEXT_PUBLIC_HLC_*_<chainId>` variables in `.env.local`:
the seven contract addresses, `RESERVE_SYMBOL`, and `DEPLOYMENT_BLOCK`. The accepted suffixes are
`31337`, `421614`, and `42161`. Addresses are validated at startup and incomplete configurations
remain disabled. The deployment block bounds the governance event scan, so set it to the block where
the DAO deployment was mined.

The app reads the checked-in registry first and applies environment variables as per-field
overrides. The app reads the first configured deployment before a wallet connects. Set
`NEXT_PUBLIC_READ_CHAIN_ID` when more than one deployment is configured and you want a specific
public network. The header labels this state `Read-only`; users must connect a wallet before
approval, swaps, votes, or other signing actions become available.

`NEXT_PUBLIC_HLC_DEPLOYMENT_BLOCK_<chainId>` must be the positive block number where the deployment
was mined. The app rejects `0` and incomplete address sets so it does not scan governance history
from an unbounded starting point.

Before enabling signing actions, the dApp also verifies the configured PSM, DAO, vesting, token, and
timelock links against the selected chain. A mismatched or unreadable contract graph is shown as a
blocking warning; do not override that warning by signing transactions manually.

Never put private keys or signing secrets in this file. Every `NEXT_PUBLIC_*` value ships to the
browser.

## Checks

```bash
pnpm lint
pnpm build
```

The project currently targets Node.js 22 or newer because pnpm 11 requires the Node 22 runtime.

Regenerate contract ABIs after changing Solidity interfaces:

```bash
pnpm gen:abis
```

The frontend is a read/write client for deployed contracts. Contract sources and deployment
instructions live in [`../contracts`](../contracts) and [`../docs`](../docs). Governance actions use
generated ABIs, including the optional CPI report adapter, so reviewers can inspect signer rotation,
threshold changes, and ownership actions before voting.

The PSM page pauses new deposits when the deployment has no verifiable timestamped CPI report, the
report is older than the contract's `MAX_REPORT_AGE`, or the reserve is below `reserveRequired()`.
Withdrawals remain available so users can use the contract's recovery path when their own
redemption credit can still be serviced.
