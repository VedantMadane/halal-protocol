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
For local experiments, set the nine core `NEXT_PUBLIC_HLC_*_<chainId>` variables in `.env.local`:
the seven contract addresses, `RESERVE_SYMBOL`, and `DEPLOYMENT_BLOCK`. Add both optional
`NEXT_PUBLIC_HLC_CPI_ADAPTER_<chainId>` and `NEXT_PUBLIC_HLC_CPI_SOURCE_ID_<chainId>` when using
the governed signed adapter. The accepted suffixes are
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

From the repository root, `make app-smoke` deploys a disposable Anvil instance, builds the app with
the generated addresses, and requests the dashboard, governance, PSM, and vesting routes. The
script restores any existing `app/.env.local` file when it exits.

The project currently targets Node.js 22 or newer because pnpm 11 requires the Node 22 runtime.

Regenerate contract ABIs after changing Solidity interfaces:

```bash
pnpm gen:abis
```

Integrators can use the PSM's `depositWithPermit`, `withdrawWithPermit`, and
`transferRedeemableWithPermit` methods when the reserve token and wallet support EIP-2612. Each
method combines the signed approval with a slippage-bounded action and a caller-supplied deadline.
Approval-based methods remain available for smart-contract wallets and reserve tokens without
permit support.

The frontend is a read/write client for deployed contracts. Contract sources and deployment
instructions live in [`../contracts`](../contracts) and [`../docs`](../docs). Governance actions use
generated ABIs, including the optional CPI report adapter, so reviewers can inspect signer rotation,
threshold changes, and ownership actions before voting.

When a deployment configures a CPI adapter, the dashboard and PSM page also show its live owner,
source ID, quorum, signer addresses, and last submitted report. The card also compares the adapter's
last-submitted watermark with the PSM's accepted-report watermark. Treat a failed read or a watermark
mismatch as a reason to stop and review the deployment before signing.

The PSM page pauses new deposits when the deployment has no verifiable timestamped CPI report, the
report is older than the contract's `MAX_REPORT_AGE`, or the reserve is below `reserveRequired()`.
Withdrawals remain available so users can use the contract's recovery path when their own
redemption credit can still be serviced.

The redeemable-credit transfer form offers an HLC EIP-2612 permit flow when the wallet supports
typed-data signing. The form submits the signed transfer in one transaction and keeps the two-step
approval flow available as a fallback.

The dashboard also shows the six most recent `CPIUpdated` events from the configured deployment
block. Each row includes the block, transaction hash, rate change, and whether the updater or a
governance override submitted it. A failed event read appears as an error instead of an incomplete
timeline.
