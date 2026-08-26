# CPI source-policy record

Copy this template into the deployment journal before granting `UPDATER_ROLE` to a CPI relayer or
[`CPIReportAdapter`](CPI-ADAPTER-SPEC.md). It records the policy that the on-chain contracts cannot
discover themselves. Fill every field from primary source evidence; do not include private keys,
API credentials, or signed messages.

This is a review worksheet, not an oracle recommendation or a safety approval. The PSM validates
numeric and timing constraints, while this record explains why a report is the value the signers
intended to approve.

## 1. Source identity

| Field | Record |
| --- | --- |
| Publishing agency |  |
| Index / series name |  |
| Geography / population |  |
| Source URL |  |
| Series identifier / query parameters |  |
| Publication calendar and expected heartbeat |  |
| Release timezone |  |
| Policy owner and review date |  |

## 2. Value and timestamp policy

| Field | Record |
| --- | --- |
| Source value units |  |
| Reference period represented by the value |  |
| Conversion to `CPI_PRECISION` units |  |
| Decimal precision and rounding mode |  |
| Missing-value behavior |  |
| Duplicate-value behavior |  |
| `reportedAt` definition | Source publication timestamp, not retrieval or submission time |
| Future, stale, or out-of-order report policy |  |
| Revision policy |  |

State the exact integer transformation in a form another operator can reproduce. For example:

```text
reportedCPI = <source value transformation>
reportedAt  = <documented publication timestamp field>
```

Confirm that the resulting value is within the PSM's `[MIN_CPI, MAX_CPI]` range and that normal
updates satisfy its step and cadence limits. A report that fails those checks must not be forced
through the emergency governance path merely to make the feed advance.

## 3. Retrieval and parser evidence

| Field | Record |
| --- | --- |
| Retrieval transport and authentication |  |
| Parser repository / commit |  |
| Parser version or release |  |
| Retrieval timestamp (UTC) |  |
| Raw response archive location |  |
| Raw response SHA-256 |  |
| Parser test command and result |  |
| Reviewer of parser output |  |

Retain the exact response bytes used to produce each accepted report. When using the repository's
BLS tooling, record the `source.responseSha256` emitted by
[`parse-bls-cpi.mjs`](../scripts/parse-bls-cpi.mjs) beside the downloaded response and generated
typed-data file.

The parser review must cover, at minimum, malformed data, missing fields, duplicate periods,
unexpected series or geography, revised publications, invalid units, out-of-range values, and
timestamp conversion. A passing parser test does not authenticate the source transport.

## 4. Authorization and operations

| Boundary | Decision / evidence |
| --- | --- |
| Signer addresses |  |
| Adapter source ID derivation |  |
| Signature threshold |  |
| Signer custody and quorum policy |  |
| Relayer address and key custody |  |
| PSM `UPDATER_ROLE` grant transaction |  |
| Source metadata set on PSM |  |
| Monitoring command and expected alerts |  |
| Rotation contact and replacement procedure |  |
| Emergency correction policy |  |

For the signed adapter, independently verify the live `sourceId`, owner, signer set, threshold,
PSM binding, and both report watermarks before the first submission:

```sh
node scripts/verify-cpi-report.mjs \
  --typed-data /path/to/typed-data.json \
  --rpc-url "$RPC_URL" --adapter 0x<adapter> \
  --signers 0x<lowest-signer>,0x<next-signer> \
  --signatures 0x<signature-for-lowest>,0x<signature-for-next>
```

After acceptance, retain the report transaction hash and output from:

```sh
RPC_URL="$RPC_URL" PSM="$PSM" CPI_UPDATER=0x<updater> \
EXPECTED_CPI_SOURCE_ID=0x<source-id> ./scripts/check-psm-health.sh
```

The expected result is `status=healthy`. Record any `reason=` output during failures and the
operator response. Do not silently fall back to an unreviewed source.

## Review decision

```text
Source policy status:       [ ] Draft  [ ] Reviewed  [ ] Rejected
Parser policy status:       [ ] Draft  [ ] Reviewed  [ ] Rejected
Signer custody status:      [ ] Draft  [ ] Reviewed  [ ] Rejected
Independent reviewer(s):
Review date (UTC):
Open questions:
Evidence links:
```

Link the completed record from the deployment journal and review it again whenever the source,
parser, signer set, threshold, cadence, or revision policy changes. See the
[`CPI adapter specification`](CPI-ADAPTER-SPEC.md) for the component boundaries and the
[`operator runbook`](OPERATOR-RUNBOOK.md) for launch and monitoring procedures.
