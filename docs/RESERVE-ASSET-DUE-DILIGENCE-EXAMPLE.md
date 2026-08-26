# Reserve-asset due-diligence example

This is a fictional, non-binding example of a completed reserve review. `ExampleUSD` and every
address below are placeholders; they must not be copied into a deployment or interpreted as an
endorsement. Replace each item with evidence for the exact token and chain under review.

## Review identity

| Field | Example record |
| --- | --- |
| Reviewer(s) | Alice Reviewer, Bob Reviewer |
| Review date (UTC) | 2026-08-26 |
| Network / chain ID | Example testnet / `999999` (placeholder) |
| Reserve token | `ExampleUSD`, `0x<exact-checksum-address>` |
| Implementation | `0x<implementation-or-proxy-address>` |
| Scope | Disposable testnet only; no assumed economic value |
| Decision | Needs monitoring; not approved for meaningful funds |

## Observed facts

These are facts that the reviewers would need to capture from primary contract calls, verified
source, issuer documentation, and transaction traces:

| Question | Example observation | Evidence to retain |
| --- | --- | --- |
| Is bytecode deployed? | Code exists at the exact token address on the target chain. | Explorer code page and `cast code` output |
| What are the token units? | `decimals()` returns `6`; symbol is `eUSD`. | `cast call` output and verified source |
| What happens on incoming transfer? | A 1,000,000-unit `transferFrom` debits 1,000,000 and credits 999,500; the 500-unit difference is sent to the documented fee collector. | Transaction trace, before/after balances, fee policy |
| What happens on outgoing transfer? | A 1,000,000-unit transfer has the same 0.05% recipient fee and returns `true`. | Transaction trace and recipient balance delta |
| Can transfers return no data or `false`? | No; the reviewed implementation returns a boolean on both paths. | Verified source and trace |
| Is the token upgradeable? | Yes; a two-of-three issuer multisig controls the proxy admin. | Proxy slots, admin address, issuer custody evidence |
| Can transfers be paused or addresses frozen? | Yes; an issuer guardian can pause transfers and blacklist an address. | Verified role wiring and issuer documentation |

The PSM evidence must be compared with the exact behavior, not with the token's marketing name:
incoming balance-delta accounting, outgoing recipient-delta checks, decimal normalization, reserve
floor protection, and pause/revert regressions are covered by the referenced tests, but those tests
do not prove that `ExampleUSD` has the same implementation.

## Assumptions and open questions

Record assumptions separately so they cannot be mistaken for observations:

- The issuer multisig is assumed to follow the stated two-of-three custody policy; independent
  signer-control evidence is still required.
- The 0.05% fee is assumed to remain fixed for this testnet scope; the token contract must be
  monitored for fee-policy changes.
- No liquidity, solvency, legal, bridge, or redemption guarantee is inferred from the token name or
  testnet availability.
- Open question: who receives an alert when the proxy implementation, fee, pause state, or blacklist
  policy changes, and what governance action follows?
- Open question: does the issuer's pause or blacklist policy make existing PSM redemption credit
  unusable, and is that acceptable for the stated scope?

## Decision and monitoring boundary

For this fictional record, the reviewers would block meaningful-funds deployment because the
upgrade and issuer-control evidence is not independently complete. They might accept a disposable
testnet rehearsal only if all of the following are documented:

1. The exact implementation and proxy-admin addresses are recorded.
2. Incoming and outgoing fee deltas are tested against the PSM with representative amounts.
3. Monitoring alerts on upgrades, fee changes, pauses, and blacklist events.
4. An on-call owner and response procedure are linked from the deployment journal.
5. The public status remains `testnet only`.

This is a review decision for a fictional example, not a protocol approval. A real deployment must
complete [`RESERVE-ASSET-DUE-DILIGENCE.md`](RESERVE-ASSET-DUE-DILIGENCE.md), the
[`DEPLOYMENT-REVIEW-CHECKLIST.md`](DEPLOYMENT-REVIEW-CHECKLIST.md), and independent security and
economic review before accepting meaningful funds.

## Reusable evidence table

Copy this table into the real reserve review and replace every placeholder:

| Category | Observed fact | Assumption / open question | Evidence link | Decision / owner |
| --- | --- | --- | --- | --- |
| Identity and code |  |  |  |  |
| Decimals and rounding |  |  |  |  |
| Transfer and fee behavior |  |  |  |  |
| Pause / blacklist |  |  |  |  |
| Upgrade and admin powers |  |  |  |  |
| Liquidity / suitability |  |  |  |  |
| Monitoring and incident response |  |  |  |  |
