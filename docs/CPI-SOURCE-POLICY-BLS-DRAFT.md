# Proposed CPI source policy — BLS CPI-U all items

**Status: Draft. Not a source recommendation, launch approval, oracle certification, or
independent review. Do not grant `UPDATER_ROLE` based on this document alone.**

This is a worked example of the provider-neutral [CPI source-policy
template](CPI-SOURCE-POLICY-TEMPLATE.md) for the source already used by the repository's parser.
The deployment owner must replace every `PENDING` item with evidence or an explicitly approved
decision before a public deployment.

## 1. Source identity

| Field | Draft record |
| --- | --- |
| Publishing agency | U.S. Bureau of Labor Statistics (BLS) |
| Index / series name | Consumer Price Index for All Urban Consumers (CPI-U), all items |
| Geography / population | U.S. city average; all urban consumers |
| Seasonal adjustment | Not seasonally adjusted |
| Source URL | <https://www.bls.gov/cpi/factsheets/cpi-series-ids.htm> |
| Series identifier | `CUUR0000SA0` |
| Publication calendar | Official BLS CPI release calendar: <https://www.bls.gov/schedule/news_release/cpi.htm> |
| Expected heartbeat | One regular monthly observation; alert if the expected release is not available |
| Release timezone | BLS schedule currently states 08:30 Eastern Time; verify the calendar for each release |
| Policy owner and review date | PENDING — name an accountable protocol operator and UTC review date |

BLS describes `CUUR0000SA0` as CPI-U (`CU`), unadjusted (`U`), regular publication (`R`), U.S.
city average (`0000`), all items (`SA0`). The source identity is not authenticated by the PSM or
by the adapter; the operator must retain the official response and release evidence.

## 2. Value and timestamp policy

| Field | Draft record |
| --- | --- |
| Source value units | CPI index points, ordinarily reported to three decimal places |
| Reference period | The monthly `year` and `period` in the BLS observation |
| Base index | PENDING — approve the CPI observation used as the protocol purchasing-power baseline |
| Conversion to `CPI_PRECISION` | `round((currentIndex / approvedBaseIndex) * 1_000_000)` |
| Decimal precision / rounding | Exact decimal strings; nearest integer CPI-precision unit, ties rounded up |
| Missing-value behavior | Reject; never substitute zero, the prior value, or the current block time |
| Duplicate-value behavior | Reject a report whose `reportedAt` is not newer than the PSM watermark |
| `reportedAt` | The documented BLS publication timestamp for that release, in Unix seconds; never retrieval or submission time |
| Future / stale / out-of-order policy | Reject; the adapter and PSM enforce timestamp ordering and a 90-day maximum age |
| Revision policy | PENDING — define whether a revised BLS observation requires governance approval and archive both versions |

The repository parser implements this exact integer operation through `ratioToCpi`: it parses the
source and baseline as decimal integers, performs integer division with half-up rounding, and emits
the result in `CPI_PRECISION` units. The parser rejects preliminary observations and requires one
successful observation for the exact configured series.

Example, with an approved baseline of `100.000` and a source observation of `105.123`:

```text
reportedCPI = round((105.123 / 100.000) * 1_000_000) = 1_051_230
reportedAt  = the BLS release timestamp recorded in the deployment journal
```

The resulting value must remain inside the PSM's `[100_000, 2_000_000]` range and satisfy its
per-update movement, cadence, reserve-adequacy, and freshness checks. If it does not, the report is
rejected and the operator follows the documented incident path; it is not forced through
`mockCPI` merely to keep the feed moving.

## 3. Retrieval and parser evidence

| Field | Draft record |
| --- | --- |
| Retrieval transport | HTTPS to the documented BLS endpoint; PENDING — approve endpoint and availability policy |
| Parser | `scripts/parse-bls-cpi.mjs` at the deployment commit |
| Parser version | Deployment commit SHA; record the release tag as well |
| Raw response archive | PENDING — immutable operator-controlled archive |
| Raw response SHA-256 | Emit and retain `source.responseSha256` from the parser |
| Parser verification | `node --test scripts/test/*.test.mjs` and the source-specific parser fixtures |
| Reviewer of parser output | PENDING — independent reviewer before role grant |

Retain the exact response bytes, generated typed-data report, parser output, release-calendar
evidence, accepted transaction hash, and the adapter/PSM health output. A passing parser test does
not prove transport authenticity or that the BLS source is economically suitable for the protocol.

## 4. Authorization and operations

| Boundary | Draft decision / evidence |
| --- | --- |
| Signer addresses | PENDING — publish the reviewed adapter signer set in the deployment journal |
| Adapter source ID | PENDING — derive from the immutable policy identity and record the exact bytes32 value |
| Signature threshold | PENDING — approve a quorum and document signer independence |
| Signer custody | PENDING — name custody, rotation, backup, and compromise procedures |
| Relayer custody | PENDING — use a separately controlled submission key and monitor failed submissions |
| PSM role grant | PENDING — grant `UPDATER_ROLE` only after all fields above are reviewed |
| PSM source metadata | Record the exact source label and series ID through governance |
| Monitoring | `scripts/check-psm-health.sh` and `scripts/check-deployment-health.sh`; alert on every nonzero exit |
| Emergency correction | Require a governance `mockCPI` proposal with source evidence, reserve impact, and follow-up |

## Review decision

```text
Source policy status:       [x] Draft  [ ] Reviewed  [ ] Rejected
Parser policy status:       [x] Draft  [ ] Reviewed  [ ] Rejected
Signer custody status:      [x] Draft  [ ] Reviewed  [ ] Rejected
Independent reviewer(s):    PENDING
Review date (UTC):          PENDING
Open questions:             baseline, revision handling, transport endpoint, custody, and launch scope
Evidence links:             BLS series-ID page and CPI release calendar above
```

Before launch, copy the finalized record into the deployment journal and complete the reserve,
beneficiary, role, source, adapter, and monitoring evidence in the [deployment review
checklist](DEPLOYMENT-REVIEW-CHECKLIST.md). This draft deliberately leaves the decision open.
