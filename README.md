# Halal (HLC)

[![CI](https://github.com/fredrikblau/halal-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/fredrikblau/halal-protocol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Halal is a DAO-governed, CPI-indexed stablecoin protocol. **HLC**, its token, is backed 1:1 by a
reserve asset (e.g. DAI or USDC) held in a Peg Stability Module (PSM), with the exchange rate
between HLC and the reserve adjusted over time to track a CPI (inflation) feed — the goal is for
HLC's *purchasing power*, not just its nominal reserve-asset price, to stay roughly stable. A
fixed genesis allocation (6,000,000 HLC to the team, 4,000,000 HLC to the treasury, both
time-vested) seeds the token; from there, all further minting, PSM parameters, and treasury
spending are controlled by an on-chain DAO (OpenZeppelin `Governor` + `TimelockController`) —
there is no admin key with unilateral control once the system is fully deployed and handed off.

This is a genuine, from-scratch implementation, not a fork or a wrapper — five contracts
(`HalalToken`, `HalalVesting`, `HalalPSM`, `HalalDAO`, `HalalTimelock`), a Foundry test suite, and
a Next.js frontend, all in this monorepo.

## Status & risk

**This protocol has not undergone a professional security audit, and there is no bug bounty
program yet.** The contracts pass their own test suite (82/82 at the time of writing — see
`contracts/test/`), but a passing test suite is not a substitute for an audit, and this repo
should not be treated as safe to use with real, meaningful funds. If you deploy or interact with
any instance of these contracts, you do so at your own risk. See [`SECURITY.md`](SECURITY.md) for
the responsible-disclosure process if you find a vulnerability, and please don't treat anything
in this README, or in `docs/`, as a claim that the software is production-ready — it's an
active, unaudited, open-source project, and honesty about that is a design goal in its own right.

## Architecture, briefly

- **`HalalToken` (HLC)** — `ERC20Votes` + `ERC20Permit` + `AccessControl`. Genesis 6M/4M
  team/treasury allocation minted once via `initialMint`; all further minting requires
  `MINTER_ROLE`, which the DAO grants (initially to the PSM, and to future modules on a
  case-by-case vote).
- **`HalalVesting`** — one instance per beneficiary (team, treasury), linear vesting with an
  optional cliff; the team schedule is DAO-revocable, the treasury schedule is not.
- **`HalalPSM`** — mints/burns HLC 1:1 against a reserve asset at a CPI-adjusted rate; CPI is
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

### Contracts

```bash
cd contracts
forge install     # fetch git-submodule dependencies (forge-std, OpenZeppelin Contracts)
forge test        # run the full test suite
```

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
