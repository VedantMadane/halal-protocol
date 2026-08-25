# Halal (HLC)

[![CI](https://github.com/fredrikblau/halal-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/fredrikblau/halal-protocol/actions/workflows/ci.yml)
[![Security](https://github.com/fredrikblau/halal-protocol/actions/workflows/security.yml/badge.svg)](https://github.com/fredrikblau/halal-protocol/actions/workflows/security.yml)
[![Slither](https://github.com/fredrikblau/halal-protocol/actions/workflows/slither.yml/badge.svg)](https://github.com/fredrikblau/halal-protocol/actions/workflows/slither.yml)
[![Deep contract tests](https://github.com/fredrikblau/halal-protocol/actions/workflows/deep-tests.yml/badge.svg)](https://github.com/fredrikblau/halal-protocol/actions/workflows/deep-tests.yml)
[![Latest release](https://img.shields.io/github/v/release/fredrikblau/halal-protocol?include_prereleases&label=latest%20release)](https://github.com/fredrikblau/halal-protocol/releases)
[![GitHub stars](https://img.shields.io/github/stars/fredrikblau/halal-protocol?style=social)](https://github.com/fredrikblau/halal-protocol/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/fredrikblau/halal-protocol?style=social)](https://github.com/fredrikblau/halal-protocol/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Halal is a DAO-governed, CPI-indexed stablecoin protocol. **HLC** minted through its Peg Stability
Module (PSM) is redeemable against a reserve asset such as DAI or USDC at a CPI-adjusted rate;
the goal is for HLC's *purchasing power*, not just its nominal reserve-asset price, to stay roughly
stable. The separate fixed genesis allocation (6,000,000 HLC to the team and 4,000,000 HLC to the
treasury, both time-vested) is not reserve-backed. PSM issuance, protocol parameters, and treasury
spending are controlled by an on-chain DAO (OpenZeppelin `Governor` + `TimelockController`) once
the system is fully deployed and handed off — there is no unilateral admin key in that final state.

This is a genuine, from-scratch implementation, not a fork or a wrapper — five contracts
(`HalalToken`, `HalalVesting`, `HalalPSM`, `HalalDAO`, `HalalTimelock`), a Foundry test suite, and
a Next.js frontend, all in this monorepo.

The fastest way to see the complete system is `./scripts/local-demo.sh`: it starts a disposable
Anvil chain, deploys the wired contracts, seeds a fresh local CPI report, and opens the frontend
with a faucet-backed local reserve.
No external RPC key or real funds are needed for the demo.

## Why this project is interesting

Most stablecoins target a nominal unit of a reserve asset. Halal explores a different target:
keeping HLC's reserve-asset redemption rate moving with consumer-price inflation, so one HLC is
intended to represent roughly stable purchasing power over time. That idea is paired with a
conservative accounting model:

- Only reserve deposited through the PSM creates a redeemable HLC claim; the fixed team and treasury
  allocations are explicitly separate and not reserve-backed.
- CPI updates are bounded by absolute limits, per-update movement, cadence, report freshness, and
  the reserve held for outstanding claims.
- Governance is delayed and observable: protocol roles route through an OpenZeppelin Governor and
  TimelockController, while deployment tooling verifies chain identity and final role wiring.

## Proof at a glance

| Reviewer question | Evidence in this repository |
| --- | --- |
| Does the accounting have stateful coverage? | 135 Foundry tests, including 3 PSM invariants, differential arithmetic checks, and fuzzing |
| Do invariants cover CPI changes? | [`docs/INVARIANTS.md`](docs/INVARIANTS.md) models governance rate changes and reserve top-ups |
| Can a deployment be checked without a private key? | [`scripts/verify-deployment.sh`](scripts/verify-deployment.sh) |
| Can I inspect the full system locally? | [`./scripts/local-demo.sh`](scripts/local-demo.sh) on a disposable Anvil chain |
| Can an operator monitor PSM health without a wallet? | [`scripts/check-psm-health.sh`](scripts/check-psm-health.sh) exits nonzero for stale CPI or reserve deficits |
| Can I model CPI-driven reserve needs reproducibly? | [`docs/ECONOMIC-MODEL.md`](docs/ECONOMIC-MODEL.md) and `make economic-model` |
| Are generated frontend interfaces kept in sync? | ABI regeneration is a required CI check |
| Is the security posture stated plainly? | [`SECURITY.md`](SECURITY.md) and [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) |

The project is still unaudited and not production-ready. The table is evidence of engineering
discipline, not a safety guarantee.

## Status & risk

**This protocol has not undergone a professional security audit, and there is no bug bounty
program yet.** The contracts pass their own test suite (135/135 at the time of writing — 132 unit
and configuration tests plus 3 stateful invariants; see
`contracts/test/`), but a passing test suite is not a substitute for an audit, and this repo
should not be treated as safe to use with real, meaningful funds. If you deploy or interact with
any instance of these contracts, you do so at your own risk. See [`SECURITY.md`](SECURITY.md) for
the responsible-disclosure process if you find a vulnerability, and please don't treat anything
in this README, or in `docs/`, as a claim that the software is production-ready — it's an
active, unaudited, open-source project, and honesty about that is a design goal in its own right.

## Architecture, briefly

- **`HalalToken` (HLC)** — `ERC20Votes` + `ERC20Permit` + `AccessControl`. Genesis 6M/4M
  team/treasury allocation minted once via `initialMint`; all further minting requires
  `MINTER_ROLE`, while accounting-aware burns require `BURNER_ROLE`; the DAO grants those roles
  narrowly (initially to the PSM, and to future modules only by case-by-case vote).
- **`HalalVesting`** — one instance per beneficiary (team, treasury), linear vesting with an
  optional cliff; the team schedule is DAO-revocable, the treasury schedule is not.
- **`HalalPSM`** — mints/burns HLC against a reserve asset at a CPI-adjusted rate; CPI is
  submitted by a rate-limited `UPDATER_ROLE` (intended to be a Chainlink Functions consumer or
  similar in production) with a DAO-gated manual override for emergencies.
- **`HalalDAO`** — an OpenZeppelin `Governor` (settings + simple counting + votes + quorum
  fraction + timelock control) wired to HLC's vote-weight and to `HalalTimelock`.
- **`HalalTimelock`** — a standard `TimelockController` enforcing an execution delay between a
  passed proposal and its effects taking place.

For the full picture — diagrams, the access-control matrix, a worked governance-proposal
walkthrough, and the exact API surface — see:

- [`docs/WHITEPAPER.md`](docs/WHITEPAPER.md) — the protocol whitepaper: the problem, the
  CPI-peg mechanism, tokenomics, governance, roadmap, and an honest risks section.
- [`docs/Architecture.md`](docs/Architecture.md) — system diagrams and contract call flow.
- [`docs/TECHNICAL-DOCS.md`](docs/TECHNICAL-DOCS.md) — the fullest spec: deployment steps,
  governance parameters, API reference, security notes.
- [`docs/DAO-Guide.md`](docs/DAO-Guide.md) — governance walkthrough (proposal lifecycle, `.env`
  setup, troubleshooting).
- [`docs/Treasury.md`](docs/Treasury.md) — how vesting/treasury flows work in practice.
- [`docs/AddingFeature.md`](docs/AddingFeature.md) — the pattern for adding new functionality to
  the already-deployed, non-upgradeable system (new contract + DAO-granted role, not a patch to
  existing contracts).
- [`docs/DESIGN-DECISIONS.md`](docs/DESIGN-DECISIONS.md) — where the actual implementation
  deliberately deviates from those planning docs, and why. Worth reading before assuming a
  number or behavior described in the docs above is exactly what the code does.
- [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) — assets, trust boundaries, attack scenarios,
  mitigations, and unresolved risks for reviewers and deployment operators.
- [`docs/OPERATOR-RUNBOOK.md`](docs/OPERATOR-RUNBOOK.md) — launch acceptance, monitoring, CPI
  updater operations, governance review, and incident response.
- [`docs/INVARIANTS.md`](docs/INVARIANTS.md) — the stateful PSM properties exercised by Foundry
  and the exact scope of those guarantees.
- [`docs/ECONOMIC-MODEL.md`](docs/ECONOMIC-MODEL.md) — a dependency-free CPI and reserve-adequacy
  scenario model with machine-readable output.
- [`docs/CONTRIBUTOR-MAP.md`](docs/CONTRIBUTOR-MAP.md) — concrete contribution paths for security,
  oracle integrations, monitoring, economics, governance, dApp UX, and documentation.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — the risk-ordered path from unaudited reference
  implementation to independently reviewed testnet and production readiness.

Those docs describe design intent and were written to guide the implementation; a few figures in
them are approximate/aspirational rather than exact. `contracts/src/` is the ground truth for
anything you need to be precise about (role names, parameter bounds, function signatures) —
read the NatSpec comments there, they're kept accurate and up to date.

## Repository layout

```
contracts/   Foundry Solidity project — HalalToken, HalalVesting, HalalPSM, HalalDAO,
             HalalTimelock, tests, deploy/example scripts.
app/         Next.js frontend dApp.
docs/        Design and governance documentation (see above).
```

## Quickstart

From the repository root, `make verify` runs the full contract and frontend verification suite.
The individual commands below are useful when working on one subtree.

### Contracts

```bash
cd contracts
forge install     # fetch git-submodule dependencies (forge-std, OpenZeppelin Contracts)
forge test        # run the full test suite
```

To run the complete dApp locally against Anvil with one command:

```bash
./scripts/local-demo.sh
```

The wrapper starts a disposable Anvil chain, deploys the system, writes `app/.env.local`, and starts
the frontend. The local deployment uses a faucet reserve token intentionally named `mDAI`; it must
never be used as a real reserve asset on a public network. For manual deployment or a custom local
beneficiary, see `contracts/script/DeployLocal.s.sol`.

See [`contracts/script/Deploy.s.sol`](contracts/script/Deploy.s.sol) for the deployment script
and [`contracts/script/Examples.s.sol`](contracts/script/Examples.s.sol) for example governance
proposals, and `docs/DAO-Guide.md` / `docs/TECHNICAL-DOCS.md` for the full deployment walkthrough
and required environment variables.

### Frontend

```bash
cd app
pnpm install
pnpm dev          # local dev server
```

Run `pnpm build` to produce a production build.

When a deployment is configured, the dApp supports wallet-free read-only browsing. Set
`NEXT_PUBLIC_READ_CHAIN_ID` if several deployments are configured; connect a wallet only when you
want to approve transactions, swap, vote, or use another signing action.

## Contributing

Contributions are welcome — bug fixes, tests, documentation, and (after a discussion in an issue
first) new features. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the fork/branch/PR workflow,
how to run each subtree's tests, code style, and commit conventions. Changes to `contracts/src/`
get extra scrutiny given this is a live financial protocol — see the note in `CONTRIBUTING.md`
about that specifically. Please also read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability, especially one that could put funds at risk? Please **do not** open a
public issue — see [`SECURITY.md`](SECURITY.md) for the private responsible-disclosure process,
scope, and what response times to expect.

## License

MIT — see [`LICENSE`](LICENSE).

If this project contributes to research or another open-source project, see [`CITATION.cff`](CITATION.cff)
for citation metadata.
