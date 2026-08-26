# Halal deployment journal

Copy this template once for each testnet or production deployment. It is an evidence index, not a
security audit or a launch approval. Record observed facts and reviewer decisions separately. Never
include private keys, seed phrases, RPC credentials, or signed messages.

## 1. Deployment identity

| Field | Record |
| --- | --- |
| Network / chain ID |  |
| Release tag |  |
| Deployment commit |  |
| Deployment transaction / block |  |
| Deployer address |  |
| Review date (UTC) |  |
| Reviewers |  |
| Public status | `testnet only` / `approved scope` / `blocked` |

Evidence:

```text
Explorer deployment URL:
Verified source URL(s):
Repository commit URL:
Deployment command/output archive:
```

## 2. Address and wiring record

| Component | Address | Source URL | Verified |
| --- | --- | --- | --- |
| HLC token |  |  | [ ] |
| Team vesting |  |  | [ ] |
| Treasury vesting |  |  | [ ] |
| DAO |  |  | [ ] |
| Timelock |  |  | [ ] |
| HalalPSM |  |  | [ ] |
| Reserve token |  |  | [ ] |
| CPI adapter (if used) |  |  | [ ] |

- [ ] `scripts/verify-deployment.sh` passed; archive its complete output here: 
  `deployment-verifier.txt`.
- [ ] Constructor arguments and source verification were checked independently on the explorer.
- [ ] The configured dApp registry entry, if any, was generated with
  `scripts/record-deployment-manifest.mjs` and passed `make registry-check`.

## 3. Custody and governance

- [ ] Team and treasury beneficiaries are distinct intended custody contracts; record signer/quorum
      evidence without private material.
- [ ] Token, PSM, vesting, and timelock roles match the verifier output; deployer privileges are absent.
- [ ] DAO voting delay, voting period in target-chain blocks, quorum, proposal threshold, and
      timelock delay were reviewed against the intended governance policy.
- [ ] CPI updater and adapter owner/signer custody, rotation, and emergency contacts are recorded.

Evidence and conclusions:

```text
Role verification output:
Beneficiary custody evidence:
Governance parameter decision:
Open governance risks:
```

## 4. Reserve asset

Complete and link [`RESERVE-ASSET-DUE-DILIGENCE.md`](RESERVE-ASSET-DUE-DILIGENCE.md).

```text
Completed reserve review:
Token implementation/proxy:
Transfer/fee/rebase observations:
Pause/blacklist/upgrade powers:
Decision and scope:
```

## 5. CPI source and first report

Complete and link [`CPI-SOURCE-POLICY-TEMPLATE.md`](CPI-SOURCE-POLICY-TEMPLATE.md) before granting
`UPDATER_ROLE` to a relayer or adapter. The repository's non-approval example is
[`CPI-SOURCE-POLICY-BLS-DRAFT.md`](CPI-SOURCE-POLICY-BLS-DRAFT.md); it must be reviewed and
completed before use.

| Artifact | Record |
| --- | --- |
| Source policy record |  |
| Parser repository / commit |  |
| Raw response archive and SHA-256 |  |
| Adapter address, source ID, owner, threshold, signers |  |
| First accepted report transaction |  |
| Report publication timestamp / CPI value |  |
| Adapter verification output |  |

- [ ] The report is current, past-dated, in range, and accepted through the reviewed path.
- [ ] Adapter and PSM report watermarks match after acceptance.
- [ ] No unreviewed fallback or emergency override was used to bootstrap normal operation.

## 6. Health and monitoring evidence

- [ ] Human-readable deployment health output is archived: `deployment-health.txt`.
- [ ] Machine-readable output is archived: `deployment-health.json`.
- [ ] Both checks report healthy, or each warning/unhealthy reason has a documented decision.
- [ ] Alerts cover reserve deficit, stale/missing CPI, overdue cadence, role changes, adapter
      mismatch, governance actions, and reserve-token pause/blacklist/upgrade events.
- [ ] An on-call owner, escalation path, and incident-response location are recorded.
- [ ] A tabletop rehearsal is scheduled or linked using [`INCIDENT-TABLETOP-WORKSHEET.md`](INCIDENT-TABLETOP-WORKSHEET.md).

```text
Health command and commit:
Monitoring configuration:
On-call owner:
Escalation contact:
Incident log:
```

## 7. Final decision

Link the completed [`DEPLOYMENT-REVIEW-CHECKLIST.md`](DEPLOYMENT-REVIEW-CHECKLIST.md) and retain all
artifacts above before publishing registry metadata.

```text
Observed facts:

Reviewer conclusion:

Blocking findings:

Accepted residual risks and limits:

Decision owner:
Decision date (UTC):
Follow-up owner / due date:
```

The default decision remains `testnet only` until independent contract, oracle, economic, reserve,
and operational review is complete. A completed journal improves traceability; it does not replace
those reviews.
