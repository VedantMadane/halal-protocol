# Reserve-token integration decision tree

Use this guide for the exact token address and chain before preparing a Halal deployment. It is a
triage path, not an approval or a claim that any issuer token is safe. A passing local test only
proves the behavior of the test double or exact implementation tested; it does not remove issuer,
liquidity, legal, or operational risk.

## Start with the immutable identity

Record the checksum address, chain ID, explorer source, symbol, decimals, and implementation or
proxy address. Confirm that the address has contract bytecode and that the token is the canonical
asset for this chain.

- If the address is an EOA, has no verified or inspectable implementation, or is a bridged asset
  whose canonical relationship is unclear: **stop and block the deployment**.
- Otherwise continue to the [reserve-asset due-diligence checklist](RESERVE-ASSET-DUE-DILIGENCE.md)
  and preserve the evidence in the [deployment journal](DEPLOYMENT-JOURNAL-TEMPLATE.md).

## Check the mechanical PSM boundary

Run the deployment's exact token observations and compare them with the [operator-runbook
compatibility matrix](OPERATOR-RUNBOOK.md#11-confirm-the-deployment-inputs). The PSM supports
balance-delta accounting for incoming and outgoing transfers, `SafeERC20` compatibility for several
return conventions, and reserve-floor checks. It does not make arbitrary token behavior safe.

Ask these questions in order:

1. Is `decimals()` supported by the PSM and is the resulting dust/rounding behavior acceptable for
   the intended deposit and withdrawal sizes?
2. Does `transferFrom` produce the expected balance delta for the sender and PSM, including fees,
   rebases, and amount-dependent behavior?
3. Does an outgoing transfer produce the expected recipient receipt without silently changing the
   reserve obligation?
4. Can the token pause, freeze, blacklist, seize, mint, burn, or otherwise alter balances outside
   ordinary transfers?

- If any transfer path cannot complete or has unexplained balance changes: **stop and block**.
- If the behavior is supported but has a documented fee or dust boundary: continue only with an
  explicit limited-scope decision, monitoring, and incident response owner.
- If the behavior is covered only by a mock and not by evidence for the exact implementation: mark
  it **unverified**; do not call it compatible based on the mock alone.

## Review issuer and availability risk

Identify every pause, blacklist, upgrade, mint, burn, admin, guardian, and proxy-admin authority.
For each authority, record custody, quorum, timelock, historical actions, and how monitoring will
detect a change. Ask whether a blocked address could still hold PSM redemption credit and whether
the reserve can remain available during an issuer incident.

- Unknown or unbounded issuer control: **block the stated deployment scope**.
- Known control with an explicit testnet limitation: **accept only with monitoring**, a named
  response owner, and a documented governance response.
- No conclusion yet: **pending**, not approved.

## Decide what evidence is sufficient

Before adding a registry entry, complete these steps:

1. Fill in the [due-diligence checklist](RESERVE-ASSET-DUE-DILIGENCE.md) for the exact address.
2. Attach transfer observations, implementation/admin evidence, and any focused simulation or test.
3. Record the decision, scope, residual risks, alerts, owner, and review date in the journal.
4. Deploy only with the exact `EXPECTED_CHAIN_ID` and reserve address; the deployment script rejects
   a reserve address without contract bytecode before it deploys the rest of the system.
5. Run the [read-only deployment verifier](../scripts/verify-deployment.sh), then record its output
   with the registry evidence. The verifier checks wiring and bytecode, not issuer solvency or safety.

The final classification must be one of:

| Classification | Meaning | Registry consequence |
| --- | --- | --- |
| Blocked | A mechanical, identity, or unresolved issuer risk fails the stated scope. | Do not deploy or register. |
| Testnet-only with monitoring | The exact residual risk is understood, bounded to a disposable testnet, and has an owner and alert. | Register only after maintainer review and complete evidence. |
| Reviewed for stated scope | Evidence and independent review support the explicitly named scope. | Still not a guarantee; keep monitoring and re-review upgrades. |

## Related references

- [Public deployment review worksheet](DEPLOYMENT-REVIEW-CHECKLIST.md)
- [Operator runbook](OPERATOR-RUNBOOK.md)
- [Threat model](THREAT-MODEL.md)
- [Deployment registry](DEPLOYMENT-REGISTRY.md)
- [Issue #97](https://github.com/fredrikblau/halal-protocol/issues/97)
