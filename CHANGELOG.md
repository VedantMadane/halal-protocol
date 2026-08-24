# Changelog

All notable changes to this project are documented here.

## Unreleased

- Fixed the PSM swap form to parse withdrawals in HLC's fixed 18-decimal units while preserving
  the reserve token's native decimals for deposit and output formatting.
- Added a visible dashboard warning when the on-chain CPI updater cadence is overdue.
- Hardened the PSM against quote drift, unsupported decimals, fee-on-transfer reserves, reserve
  shortfalls, outgoing-transfer floor breaches, zero-receipt top-ups, zero-output withdrawals, and
  unauthorized redemption.
- Prevented governance from disabling the updater cadence with a zero interval.
- Added atomic `transferRedeemable` support for transferring PSM-issued HLC together with its
  redemption credit.
- Added `cancelRedeemable` so users can retire a PSM claim while keeping supply and reserve
  accounting accurate.
- Switched PSM decimal conversions to full-precision arithmetic and added regression coverage for
  large values that previously could overflow an intermediate calculation.
- Added constructor and deployment-wiring validation across the token, vesting, DAO, timelock, and
  deployment script.
- Added 111 unit tests plus 3 stateful PSM invariants, reproducible ABI generation, and CI checks for
  formatting, linting, builds, dependency advisories, and generated-interface drift.
- Improved the Next.js dashboard with validated deployment configuration, bounded swap actions,
  explicit slippage controls, governance proposal validation, and safer incomplete-read handling.
- Added an atomic redemption-credit transfer form to the PSM page and made governance history
  reads fail visibly instead of silently omitting unreadable log ranges.
- Added visible, transaction-blocking errors for partial wallet reads and a safe UI action for
  retiring redemption claims without reserve.
- Added a source-sensitive Foundry CI cache key, a stateful cancellation invariant, patched all
  reachable `uuid` versions, CodeQL/dependency-review workflows, and a zero-finding Slither pass
  for the first-party contracts. Added scheduled deep testing with 10,000 fuzz runs and 128
  invariant sequences at depth 64.
- Added a local Anvil deployment script that reuses production role wiring and prints a ready-to-paste
  frontend environment configuration with a clearly labeled faucet reserve.
- Added a one-command local demo wrapper that starts Anvil, writes the frontend environment, and
  launches the dApp while refusing to use an already-running RPC process.
- Added production route smoke tests, Dependabot update groups, and issue routing that directs
  security reports to private advisories.
- Added permissionless vesting release triggering and the two-step beneficiary rotation flow to
  the frontend.
- Added contributor templates, proposal examples, operational documentation, and a root `make verify`
  workflow.

The project remains unaudited and is not production-ready. See [`SECURITY.md`](SECURITY.md).
