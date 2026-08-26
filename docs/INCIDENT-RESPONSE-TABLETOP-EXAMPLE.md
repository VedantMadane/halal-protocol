# Incident-response tabletop example: stale CPI report

This fictional exercise demonstrates how an operator responds when a deployment stops receiving
fresh CPI reports. It is not a real incident, an emergency authorization, or evidence that any
deployment is safe. All identities, addresses, timestamps, and contacts are placeholders.

## Exercise record

| Field | Example value |
| --- | --- |
| Deployment / chain ID | Example testnet / `999999` (placeholder) |
| Exercise date | 2026-08-26 |
| Facilitator | Operations lead (fictional) |
| Participants | Monitoring, governance, CPI-source, and communications owners |
| Starting release | `v0.1.0-alpha.216` (example only) |
| Starting health | `status=healthy` at `2026-08-20T08:30:00Z` |
| Scenario | Report becomes stale while the source publication is delayed |
| Exercise status | Completed with follow-up required |

## Injected timeline

### 1. Detection

At `2026-08-29T08:31:00Z`, the scheduled read-only check exits nonzero:

```text
status=unhealthy
reason=timestamped_cpi_report_stale
last_report_timestamp=<older-than-90-days-in-exercise-clock>
```

The machine-readable wrapper reports `status=unhealthy` and exit code `1`. The frontend may also
show stale CPI health and disable new deposits, but the operator does not treat the UI as the
authority.

### 2. Independent confirmation

The monitoring owner confirms the result against a second RPC or explorer and records:

- the exact PSM address and chain ID;
- `lastReportTimestamp()`, `MAX_REPORT_AGE()`, `cpiRate()`, and `reserveSurplus()`;
- the last accepted-report transaction and block;
- adapter and PSM watermarks, if a signed adapter is configured;
- the source publication calendar and the last raw response/hash available to the source owner.

The result is classified as a freshness incident, not as proof that the CPI value is wrong. If the
two RPCs disagree, the incident is escalated as an RPC/monitoring outage instead.

### 3. Immediate containment

The operator keeps deposits paused, stops public promotion, and does not invent, backdate, or replay
a report merely to make health green. Existing withdrawal behavior remains governed by the PSM's
on-chain accounting and reserve availability; no operator manually promises redemption.

The incident record retains the JSON health output, human-readable output, RPC endpoint identities,
check commit, timestamps, and relevant explorer links. It contains no private keys or signatures.

### 4. Recovery decision

The source owner confirms a current official report and the adapter/signers prepare the exact typed
data through the reviewed parser. Before submission, the verifier checks source identity, report
freshness, ordering, chain/domain, signer set, and adapter/PSM watermarks. If the source remains
unavailable or disputed, governance decides whether to wait, use the documented emergency override,
or abandon/migrate the immutable deployment; the monitoring operator cannot choose that alone.

### 5. Recovery proof

After a report is accepted, the team records the transaction and reruns the independent checks:

```sh
./scripts/verify-cpi-report.mjs --help
RPC_URL="$RPC_URL" PSM="$PSM" CPI_ADAPTER="$CPI_ADAPTER" \
  EXPECTED_CPI_SOURCE_ID="$EXPECTED_CPI_SOURCE_ID" \
  ./scripts/check-deployment-health.sh --json > deployment-health-after.json
node scripts/consume-health-json.mjs < deployment-health-after.json
```

Recovery is not declared from one green frontend screen. The record must show a fresh accepted
report, matching adapter and PSM watermarks where applicable, current reserve coverage, a zero exit
from the health consumer, and source-response evidence. Any leftover warning or unverified source
assumption remains an explicit follow-up.

## Closeout record

```text
Detection worked because: the scheduled read-only check alerted on the stale-report reason.
Containment worked because: deposits stayed blocked and no unverified report was submitted.
Recovery required: source-owner evidence and the reviewed updater/adapter path; governance for any override.
Evidence retained: before/after JSON, RPC observations, report transaction, source hash, and review notes.
Follow-up owner: fictional operations lead.
Next rehearsal: repeat with a reserve deficit and a reserve-token pause.
```

This exercise proves only that the response procedure is understandable and evidence-oriented. It
does not prove CPI-source correctness, reserve solvency, signer custody, issuer safety, or recovery
of an immutable deployment.
