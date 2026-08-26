# Protocol incident tabletop worksheet

Use this worksheet to rehearse an incident on a disposable or testnet deployment. It is not an
emergency authorization, a substitute for [`SECURITY.md`](../SECURITY.md), or permission to bypass
the DAO and timelock. Do not include private keys, credentials, unpublished vulnerabilities, or
real user personal data.

## Exercise record

| Field | Record |
| --- | --- |
| Deployment / chain ID |  |
| Exercise date (UTC) |  |
| Facilitator |  |
| Participants and roles |  |
| Scenario selected |  |
| Starting release / commit |  |
| Starting health result |  |
| Exercise status | `planned` / `completed` / `follow-up required` |

For every scenario, record the answer to these four questions: How was it detected? What is the
safe containment available now? What recovery requires governance or an external operator? How do we
prove recovery without trusting the frontend alone?

## Scenario cards

### A. Missing or stale CPI report

**Inject:** Set the report watermark to zero in a disposable deployment, or advance time beyond
`MAX_REPORT_AGE` without accepting a new report.

- Detection signal / timestamp:
- Independent RPC or explorer confirmation:
- Source publication and parser evidence:
- Immediate safe action: keep deposits paused; do not invent or backdate a report.
- Recovery action: submit a current, in-range, correctly ordered report through the reviewed updater
  or adapter path; use the DAO-gated override only under its documented emergency policy.
- Recovery proof: `check-deployment-health.sh --json`, accepted-report transaction, matching adapter
  and PSM watermarks, and source-response hash.
- Owner / escalation / follow-up:

### B. Reserve deficit

**Inject:** On disposable state, use the authorized emergency test path to raise CPI above the held
reserve or otherwise create a documented shortfall.

- Detection signal / timestamp:
- Independent reserve balance and `reserveSurplus()` observation:
- Affected claims and last known healthy state:
- Immediate safe action: stop promotion and new deposits; do not withdraw required reserve.
- Recovery action: prepare a DAO-reviewed reserve top-up or documented mitigation; withdrawals remain
  subject to on-chain first-come-first-served reserve availability.
- Recovery proof: reserve token balance, `reserveRequired()`, health JSON, governance transaction,
  and post-action event records.
- Owner / escalation / follow-up:

### C. Reserve token pause, blacklist, freeze, or upgrade

**Inject:** Use a test double or testnet event that makes transfers fail or changes the reviewed
implementation/issuer policy.

- Detection signal / token event or implementation diff:
- Exact token and implementation addresses:
- Immediate safe action: pause promotion and treat the reserve as unavailable; do not assume the PSM
  can recover funds or override issuer controls.
- Recovery action: issuer confirmation and reviewed remediation, or a separately governed migration
  plan; never silently replace the reserve address in an immutable PSM.
- Recovery proof: primary issuer evidence, transfer simulation, reserve review update, and a new
  deployment/review record if the contract must be redeployed.
- Owner / escalation / follow-up:

### D. CPI adapter signer compromise or failed rotation

**Inject:** Remove a test signer, submit a duplicate/invalid quorum, or leave a two-step ownership
handoff pending in a disposable adapter.

- Detection signal / signer-set, threshold, owner, and watermark observations:
- Immediate safe action: stop report submission and preserve source reports, signatures, RPC output,
  and custody logs; do not publish private incident details.
- Recovery action: follow the reviewed governance/owner rotation procedure and revoke affected roles
  where governance still controls the admin path.
- Recovery proof: live signer enumeration, owner and threshold checks, accepted report, matching
  watermarks, and independent `verify-cpi-report.mjs` output.
- Private disclosure path / owner / follow-up:

### E. Unexpected privileged-role change

**Inject:** Add or remove a role in a disposable deployment and emit the corresponding event.

- Detection signal / block and transaction:
- Roles and contracts affected:
- Immediate safe action: stop signing and promotion; verify the event from an independent RPC.
- Recovery action: inspect the governance proposal and timelock history; restore or revoke only by
  the authorized governance path unless the deployment is abandoned.
- Recovery proof: role enumeration, proposal/calldata decoding, executed transaction, and a clean
  deployment verifier result.
- Owner / escalation / follow-up:

### F. Malicious or unsafe governance proposal

**Inject:** Prepare a test proposal with an invalid target, reserve drain, role grant, source change,
or emergency CPI override.

- Detection signal / proposal ID and voting state:
- Decoded targets, selectors, arguments, and reserve/economic impact:
- Immediate safe action: do not vote, queue, or execute until independently reviewed; preserve the
  description hash and calldata.
- Recovery action: use the documented proposal cancellation/defeat path if available; otherwise
  allow the timelock/governance process to resolve it and record the limitation.
- Recovery proof: final proposal state, queue/execution/cancellation events, and post-action health.
- Owner / escalation / follow-up:

### G. RPC, explorer, or monitoring outage

**Inject:** Point a disposable health job at an unavailable or inconsistent RPC endpoint.

- Detection signal / first observed time:
- Second RPC or archive endpoint tested:
- Immediate safe action: treat the deployment as unverified; do not sign based on stale frontend data.
- Recovery action: restore read-only monitoring and compare block, role, reserve, and CPI observations
  across independent endpoints.
- Recovery proof: health JSON from the recovered endpoint, endpoint logs, and an explicit statement
  of any interval without coverage.
- Owner / escalation / follow-up:

### H. Suspected contract or fund-risking vulnerability

**Inject:** Discuss a hypothetical finding without reproducing or publishing exploit details.

- Detection signal / affected component:
- Immediate safe action: stop public promotion and preserve minimal safe evidence; do not open a
  public issue or attach exploit calldata.
- Recovery action: follow the private process in [`SECURITY.md`](../SECURITY.md), coordinate an
  independent assessment, and use a separately reviewed deployment if immutable code is affected.
- Recovery proof: private advisory/triage record, remediation commit or redeployment evidence, and
  fresh independent review—not only a passing local test.
- Owner / escalation / follow-up:

## Exercise closeout

```text
Detection worked because:
Containment worked because:
Recovery was blocked by:
Evidence missing:
Runbook or tooling change required:
Owner and due date:
Next rehearsal date:
```

The exercise is complete only when the operator can identify a safe response, name the authority
required for recovery, and retain evidence that can be checked without trusting a single RPC,
frontend, signer, or issuer statement.
