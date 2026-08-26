# Reserve-asset due diligence checklist

Use this checklist for the exact reserve-token address and chain before deploying or promoting a
Halal PSM. It is a review record, not an approval or a guarantee that an issuer will remain solvent,
honest, liquid, or available. Never paste private keys, seed phrases, or privileged credentials into
this document.

## Review identity

| Field | Value |
| --- | --- |
| Reviewer(s) |  |
| Review date (UTC) |  |
| Network / chain ID |  |
| Reserve token address |  |
| Symbol / decimals |  |
| Implementation or proxy address |  |
| Release / deployment commit |  |
| Decision | `approved for stated scope` / `blocked` / `needs monitoring` |

## 1. Freeze the exact asset

- [ ] Record the checksum token address and verify its bytecode on the target chain.
- [ ] Record symbol, `decimals()`, name, total supply, and implementation/proxy details from the
      live contract and a primary issuer or deployment source.
- [ ] If the token is proxied or upgradeable, record the proxy admin, upgrade authority, current
      implementation, upgrade events, and the process for reviewing future implementations.
- [ ] Confirm the token is issued on the same chain as the PSM; do not treat a bridged representation
      as equivalent to its canonical asset without documenting the bridge and failure modes.

Evidence links and observations:

```text
Explorer / verified source:
Issuer documentation:
Implementation and admin:
Canonical / bridge relationship:
Observed total supply:
```

## 2. Test transfer semantics against PSM assumptions

The PSM measures the reserve balance delta for incoming transfers and the recipient delta for
outgoing transfers. It rejects zero receipts, protects the reserve floor, and uses `SafeERC20` for
false/reverting/non-returning calls. These mechanisms do not certify an arbitrary token.

- [ ] Test `transfer` and `transferFrom` with a small and representative amount; record sender debit,
      recipient receipt, and any fee or rounding.
- [ ] Determine whether transfer functions return `true`, return no data, return `false`, or revert.
- [ ] Check whether behavior differs by sender, recipient, amount, allowance, or transfer direction.
- [ ] Check decimals and conversion boundaries against the PSM arithmetic tests; record any dust or
      zero-output region that affects deposits or withdrawals.
- [ ] Check whether balances rebase, accrue yield, or change without a transfer.
- [ ] Compare results with the repository evidence in `contracts/test/` and attach a reproducible
      command or simulation for behavior not covered there.

| Behavior | Observation | Evidence / test | Launch consequence |
| --- | --- | --- | --- |
| Incoming fee |  |  |  |
| Outgoing fee or extra debit |  |  |  |
| Return data / revert behavior |  |  |  |
| Decimals / rounding |  |  |  |
| Rebasing or unsolicited balance change |  |  |  |

## 3. Review issuer control and availability risk

- [ ] Identify pause, freeze, blacklist, denylist, seizure, forced-transfer, and mint/burn powers.
- [ ] Identify every admin, upgrader, issuer, guardian, and emergency key; record custody, quorum,
      timelock, and revocation procedures from primary evidence.
- [ ] Determine whether an address can be blocked while its PSM redemption credit remains live.
- [ ] Review historical incidents, depegs, supply changes, blacklists, pauses, and implementation
      upgrades. Record sources and dates rather than relying on marketing claims.
- [ ] Define what monitoring detects an issuer action and what governance response is available.
- [ ] Confirm the token is suitable for the stated testnet or production scope, including liquidity,
      redemption depth, counterparty, legal, and jurisdictional constraints.

## 4. Decide and preserve the boundary

Classify each finding before registration:

- **Block deployment**: unsupported decimals, inability to transfer or redeem, unknown upgrade
  authority, unbounded or unexplained balance changes, or a fee/blacklist policy incompatible with
  the stated reserve economics.
- **Accept only with monitoring**: a documented fee, issuer pause authority, upgradeable code, or
  other residual risk that the reviewer explicitly accepts for a limited scope and pairs with an
  alert and incident plan.
- **Covered behavior**: only the exact behavior tested against the exact implementation. A mock test
  demonstrates a contract boundary; it is not evidence that an issuer token has the same behavior.

Final decision and follow-up:

```text
Decision and scope:
Blocking findings:
Residual risks:
Required alerts:
Review owner / due date:
Deployment journal link:
```

## Illustrative example (not a recommendation)

Suppose a hypothetical `ExampleUSD` token reports 6 decimals, charges a 0.05% incoming fee, and is
upgradeable by a two-of-three issuer multisig. A reviewer should record the exact address and
implementation, prove that the PSM mints against the received balance delta, check withdrawal
recipient receipts and reserve-floor behavior, document the dust threshold caused by decimal
normalization, and record the upgrade/pause alert and response owner. This example does not approve
`ExampleUSD` or any real asset; the decision depends on the evidence for the actual deployment.

## Repository references

- [`Completed fictional review example`](RESERVE-ASSET-DUE-DILIGENCE-EXAMPLE.md) — a non-binding
  example showing how to separate observations, assumptions, open questions, and decisions.
- [`HalalPSM` transfer and reserve-floor tests](../contracts/test/HalalPSM.t.sol)
- [`HalalPSM` stateful invariants](INVARIANTS.md)
- [`Threat model`](THREAT-MODEL.md)
- [`Public deployment review worksheet`](DEPLOYMENT-REVIEW-CHECKLIST.md)
- [`Operator runbook`](OPERATOR-RUNBOOK.md)
