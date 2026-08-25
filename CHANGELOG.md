# Changelog

All notable changes to this project are documented here.

## Unreleased

- Extended the stateful PSM invariant harness to exercise mixed user actions across governance CPI
  changes and reserve top-ups, not only at the genesis rate.
- Added deadline-bounded PSM deposit and withdrawal entrypoints so new integrations can combine
  slippage protection with an explicit maximum execution time; the existing entrypoints remain for
  compatibility with already-deployed immutable PSMs.
- Updated the dApp to detect deadline-capable PSM bytecode and use a 15-minute execution deadline
  automatically, while retaining the bounded compatibility path for older immutable deployments.
- Added a concise protocol rationale and evidence-at-a-glance section to the landing README for
  reviewers, contributors, and potential integrators.
- Made the production deployment script require `EXPECTED_CHAIN_ID` and fail closed before
  broadcasting if the selected RPC is on another network.
- Added wallet-side PSM transaction preflight simulation so stale quotes, allowance changes, and
  reserve shortfalls are shown before a user signs a bounded deposit or withdrawal.
- Extended deployment verification to require the timelock's self-admin role, which is necessary
  for queued governance operations to manage protocol roles.
- Made the dApp's deployment-integrity gate fail closed unless the live token, PSM, and timelock
  critical roles match the production wiring; the CLI verifier now also checks the open executor
  role.
- Made DAO reserve-withdrawal events report the recipient's actual fee-adjusted receipt and reject
  zero-value withdrawals.
- Added reentrancy protection to DAO reserve deposits and withdrawals, with callback-based regression
  coverage for malicious reserve-token behavior.
- Made deployment verification fail closed when the RPC chain ID does not match the operator's
  declared target network, and wired the check into the local demo and CI smoke test.
- Exposed CPI source-report timestamps and the on-chain freshness bound in the dApp, while keeping
  the new metadata reads optional for older immutable deployments.
- Fixed first-report bootstrap so a fresh timestamped CPI report published immediately before
  deployment is accepted.
- Added timestamped CPI reports with monotonic replay protection and a 90-day freshness bound;
  governance overrides now advance the report watermark.
- Fixed the PSM swap form to parse withdrawals in HLC's fixed 18-decimal units while preserving
  the reserve token's native decimals for deposit and output formatting.
- Added a visible dashboard warning when the on-chain CPI updater cadence is overdue.
- Kept vesting and reserve progress indicators precise for arbitrarily large on-chain amounts by
  using bounded bigint ratios instead of JavaScript `Number` conversion.
- Made the local demo build its contracts before deployment and restore any pre-existing
  `app/.env.local` when it exits.
- Strengthened the read-only deployment verifier to reject EOAs/wrong-chain addresses and verify
  the DAO's token/timelock links plus a nonzero timelock delay.
- Made incomplete PSM wallet and reserve reads produce an explicit waiting state instead of a
  silently disabled deposit/withdraw button.
- Added a client-side on-chain deployment-integrity check and blocked governance, PSM, and vesting
  signing actions until the configured contract graph is verified.
- Added live governance timelock ETA handling so queued proposals cannot present an executable
  action before the delay has elapsed.
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
