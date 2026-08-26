# Governance Review Evidence Template

Copy this record for each proposal review. Keep it beside the deployment journal entry. This is an
evidence template, not an approval: a successful vote does not prove that a payload is safe.

Never record private keys, seed phrases, RPC credentials, or signed messages here.

## Identity

| Field | Value |
| --- | --- |
| Proposal ID |  |
| Network / chain ID |  |
| Release tag / commit |  |
| Proposal transaction |  |
| Description text |  |
| Description hash |  |
| Review date (UTC) |  |
| Primary reviewer |  |
| Independent verifier |  |

## Exact action bundle

Preserve the arrays exactly as submitted. Do not replace raw calldata with a decoded label.

```text
targets:  [
]
values:   [
]
calldatas:[
]
```

| # | Target and verified source | ETH value | Selector | Decoded call | Raw calldata | Independent check |
| --- | --- | ---: | --- | --- | --- | --- |
| 0 |  |  |  |  |  |  |

## Impact review

### Observed chain facts

- Current target code/source:
- Current role administrators and holders:
- Current reserve balance / `reserveRequired()` / surplus or deficit:
- Current CPI, source, watermark, and freshness:
- Relevant deployment-verifier output or explorer links:

### Assumptions and open questions

- [ ] Every target and selector matches the intended published ABI.
- [ ] Wallet simulation was run from the timelock address with the exact action order.
- [ ] Role changes (`MINTER_ROLE`, `BURNER_ROLE`, `PARAM_ROLE`, `UPDATER_ROLE`, or other) are named:
- [ ] Beneficiaries, reserve token, oracle source, and adapter signers were independently checked:
- [ ] Current and plausible future reserve impact was calculated:
- [ ] No upgrade, pause, blacklist, custody, or signer risk is being hidden by the UI:
- Unresolved questions:

### Decision

- [ ] Reject: target, calldata, authority, or impact is not sufficiently justified.
- [ ] Request changes / more evidence.
- [ ] Continue to vote or queue, subject to the configured governance process.
- Rationale:

## Governance and execution evidence

| Stage | Transaction / block / timestamp | Expected state | Observed state | Evidence link |
| --- | --- | --- | --- | --- |
| Proposal submitted |  | Pending |  |  |
| Snapshot / voting result |  | Quorum and outcome recorded |  |  |
| Queued |  | Exact bundle scheduled; ETA respects delay |  |  |
| Re-check before execution |  | Targets, values, calldata, and assumptions unchanged |  |  |
| Executed or cancelled |  | Receipt and events match decision |  |  |

If any exact action field, description hash, target source, reserve assumption, or expected state
differs during the process, stop and investigate. Link the completed record from the deployment
journal and keep the raw transaction receipts available for independent review.

For a filled fictional example, see the [governance proposal review case study](GOVERNANCE-PROPOSAL-REVIEW-EXAMPLE.md).
