# Governance Proposal Review Example

This is a fictional, non-binding review exercise for a Halal DAO proposal. The addresses, values,
and execution evidence below are deliberately examples; do not broadcast them or treat a passing
vote as proof that a payload is safe.

## Review packet

Assume the packet contains this description:

> Rotate routine CPI reporting to the reviewed adapter and publish the BLS source label.

The reviewer records the description text and computes the Governor description hash independently:

```shell
cast keccak 'Rotate routine CPI reporting to the reviewed adapter and publish the BLS source label.'
```

The proposal has two actions. `value` is zero for both actions. These are fictional target
addresses, but the raw calldata is exact and reproducible:

| # | Target | Selector | Raw calldata | Intended effect |
|---|---|---|---|---|
| 1 | `0x3333333333333333333333333333333333333333` (PSM) | `0x2f2ff15d` | `0x2f2ff15d73e573f9566d61418a34d5de3ff49360f9c51fec37f7486551670290f6285dab0000000000000000000000002222222222222222222222222222222222222222` | Grant `UPDATER_ROLE` to the fictional adapter `0x2222…2222` |
| 2 | `0x3333333333333333333333333333333333333333` (PSM) | `0x99d25455` | `0x99d254550000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000f424c533a43555552303030305341300000000000000000000000000000000000` | Set source label to `BLS:CUUR0000SA0` |

Recreate the payload rather than trusting a UI decoder:

```shell
cast calldata 'grantRole(bytes32,address)' \
  0x73e573f9566d61418a34d5de3ff49360f9c51fec37f7486551670290f6285dab \
  0x2222222222222222222222222222222222222222
cast calldata 'setSource(string)' 'BLS:CUUR0000SA0'
```

The repository also includes an offline, read-only preflight. Give it a bundle containing the exact
arrays and a separately reviewed policy that maps each target to its permitted selectors and value
limit:

```json
{
  "description": "Rotate routine CPI reporting to the reviewed adapter and publish the BLS source label.",
  "descriptionHash": "0x4ea5061a2d4ee348f0293031254afd9cae9c90b3718062258fcab19287b0745d",
  "targets": ["0x3333333333333333333333333333333333333333", "0x3333333333333333333333333333333333333333"],
  "values": ["0", "0"],
  "calldatas": [
    "0x2f2ff15d73e573f9566d61418a34d5de3ff49360f9c51fec37f7486551670290f6285dab0000000000000000000000002222222222222222222222222222222222222222",
    "0x99d254550000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000f424c533a43555552303030305341300000000000000000000000000000000000"
  ]
}
```

```json
// governance-policy.json
{
  "targets": {
    "0x3333333333333333333333333333333333333333": {
      "label": "fictional PSM",
      "maxValue": "0",
      "selectors": {
        "0x2f2ff15d": "grantRole(bytes32,address)",
        "0x99d25455": "setSource(string)"
      }
    }
  }
}
```

Run it before submitting or queueing the proposal:

```shell
node scripts/verify-governance-payload.mjs \
  --bundle proposal-bundle.json --policy governance-policy.json
```

Exit status zero means only that the bundle matches the supplied policy, each selector matches its
declared function signature, and the calldata uses canonical ABI encoding for the supported
argument types. A non-zero result preserves raw action data and reports the reason for rejecting
unknown targets, malformed calldata, disallowed selectors, array mismatches, or unexpected ETH
values. It does not replace source review, wallet simulation, reserve analysis, or governance
authority.

The verifier's policy is an allowlist maintained by the reviewer; it is not inferred from the dApp,
an explorer label, or the proposal description.

## Independent review

The reviewer checks each layer separately:

1. **dApp display:** confirm the proposal page shows two actions, the PSM target, zero ETH value,
   the decoded role/source changes, and the exact description.
2. **Wallet simulation:** simulate the transaction bundle from the timelock address. Confirm the
   current PSM role admin is the timelock, the adapter is configured for this PSM, and no call is
   silently omitted or reordered.
3. **Source and explorer:** verify the target address against the deployment manifest and published
   source. Verify the selectors against the ABI; an explorer label alone is not authorization.
4. **Protocol impact:** confirm the adapter's quorum, signer custody, source provenance, heartbeat,
   and fallback policy. Check that the current reserve and `reserveRequired()` remain adequate at
   plausible CPI values. Record the before/after role and source state.
5. **Governance authority:** verify proposal ID, snapshot, voting period, quorum, queue transaction,
   timelock ETA, and execution transaction. Preserve raw arrays (`targets`, `values`, `calldatas`)
   and the description hash in the deployment journal.

The safe conclusion is conditional: the payload is understandable and reviewable, but execution
remains hypothetical until every independent check passes and the authorized DAO process completes.

## Intentionally unsafe comparison

Consider a different one-action proposal:

| Target | Value | Selector | Raw calldata | Why reject it |
|---|---:|---|---|---|
| `0x3333333333333333333333333333333333333333` (PSM) | `0` | `0x1c58ce14` | `0x1c58ce1400000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000003635c9adc5dea00000` | Withdraw `1,000` reserve tokens to an unreviewed beneficiary; it may breach the reserve floor and has no documented recovery rationale. |

The calldata can be reproduced with:

```shell
cast calldata 'withdrawReserve(address,uint256)' \
  0x1111111111111111111111111111111111111111 1000000000000000000000
```

Reject this proposal even if its description sounds urgent, the dApp renders it cleanly, a wallet
simulation is technically successful, or it receives enough votes. A successful vote proves only
that governance accepted the proposal under its configured rules; it does not prove that the target,
selector, beneficiary, accounting assumptions, or reserve impact are safe.

## Timing and evidence checklist

For either packet, record the proposal transaction and ID, then the voting snapshot and outcome.
Only a succeeded proposal may be queued. After queueing, compare the timelock ETA with the configured
delay, re-check the exact action arrays, and capture the execution receipt and emitted role/source
events. If any target, selector, value, calldata, description hash, or expected state differs, stop
and cancel or investigate according to the incident procedure.

For the repository's full lifecycle rehearsal, see the [DAO implementation guide](DAO-Guide.md),
the [operator review checklist](OPERATOR-RUNBOOK.md#4-governance-proposal-review), and
[`HalalDAO.t.sol`](../contracts/test/HalalDAO.t.sol).
