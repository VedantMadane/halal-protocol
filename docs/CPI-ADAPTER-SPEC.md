# CPI adapter specification

Status: design requirement for a production deployment. This document does not approve a
provider, an oracle product, or a deployment. The reference contracts remain unaudited.

## Purpose

`HalalPSM` accepts a CPI report through `updateCPIWithTimestamp(uint256,uint256)`. The PSM checks
the report's numeric bounds, movement, cadence, reserve impact, timestamp ordering, and age. It
does not identify the statistics agency that produced the number.

An adapter or relayer must supply that missing boundary. The implementation must authenticate the
report source before it calls the PSM and must preserve the source publication timestamp.

## Required topology

```text
official CPI publication
        |
        v
source parser and policy checks
        |
        v
reviewed consumer or relayer  ---- governance-managed UPDATER_ROLE ---->  HalalPSM
        |
        +---- report archive, transaction hash, and monitoring records
```

The adapter may use a Chainlink Functions consumer, a separately operated relayer, or another
reviewed mechanism. The choice belongs in the deployment journal. The adapter must not change the
PSM's accounting, reserve rules, or emergency governance path.

## Report contract

The adapter submits:

```solidity
updateCPIWithTimestamp(uint256 reportedCPI, uint256 reportedAt)
```

The deployment policy must define these fields before it grants `UPDATER_ROLE`:

| Field | Required meaning |
| --- | --- |
| `reportedCPI` | The source's CPI value converted to `CPI_PRECISION` units. `1_000_000` means 1.0. |
| `reportedAt` | The source publication timestamp in Unix seconds, not the relayer submission time. |
| source identity | The agency, index series, geography, release calendar, and source URL. |
| revision policy | Whether a revised publication can replace an accepted report and how governance approves it. |
| unit policy | The exact source units, scaling, rounding, and missing-value behavior. |

The adapter must reject a response when it cannot establish the source identity, publication time,
units, or value. It must not substitute the current block timestamp for a missing source timestamp.

## Trust assumptions

The deployment journal must name an owner for each assumption:

| Boundary | Required control | Evidence to retain |
| --- | --- | --- |
| Source authenticity | Fetch only the documented official series over an authenticated transport or a reviewed oracle service. | Raw response, source URL, retrieval time, parser version, and hash. |
| Parser correctness | Version the parser and test malformed, missing, duplicate, revised, and out-of-range fields. | Reproducible fixtures and test output. |
| Report authorization | Restrict the adapter's submission path to the intended consumer or signer set. | On-chain role state, custody policy, and rotation records. |
| Freshness | Enforce the source heartbeat off-chain and rely on the PSM's 90-day maximum age on-chain. | Alert history and accepted report events. |
| Key rotation | Prepare the replacement before revoking the current updater and verify the first report from the replacement. | Governance proposal, role events, and transaction hashes. |
| Source changes | Change `source` and the updater through a reviewed governance action before accepting the new series. | Proposal calldata, source metadata, and deployment journal entry. |

The PSM's `source` string records operator metadata. It does not authenticate a report. Monitoring
must compare it with the expected deployment record using
[`scripts/check-psm-health.sh`](../scripts/check-psm-health.sh).

## Failure behavior

The adapter and operator must apply these rules:

1. A missing, malformed, delayed, or disputed source report produces no PSM update.
2. A stale watermark causes the PSM to reject new deposits. Existing valid redemption credits
   remain subject to reserve and accounting checks.
3. An adapter outage does not trigger an automatic fallback to an unreviewed source.
4. Governance may use `mockCPI` for an explicit emergency correction. The proposal must record the
   reason, value, reserve impact, source evidence, and follow-up action.
5. A compromised updater must be revoked through the timelock. Operators must preserve report and
   custody evidence for incident review.

The adapter must not treat a successful transaction as proof that the source was correct. The PSM
only proves that the report satisfied its on-chain constraints.

## Reference module

The repository includes [`CPIReportAdapter.sol`](../contracts/src/CPIReportAdapter.sol) as an
optional reference module. It uses the EIP-712 domain `Halal CPI Report Adapter`, version `1`, and
the typed data:

```text
CPIReport(uint256 reportedCPI,uint256 reportedAt,bytes32 sourceId)
```

The submitter must provide exactly `threshold` signatures, ordered by recovered signer address in
strictly ascending order. The adapter rejects future or non-increasing publication timestamps,
tracks the last forwarded timestamp, binds each signature to the adapter's immutable `sourceId`,
and protects its PSM call with a reentrancy guard. `Ownable2Step` controls signer rotation and
threshold changes. Set the owner to the protocol timelock before granting the adapter
`UPDATER_ROLE` on the PSM.

The module authenticates the configured signer quorum. It does not prove that those signers parsed
an official CPI source correctly. Operators still need the source policy, parser review, report
archive, and independent security review described below.

### Governance wiring

1. Deploy the adapter with the PSM address, timelock owner, signer set, threshold, and a nonzero
   `sourceId` derived from the documented source series and parser policy.
2. Verify the EIP-712 domain, source ID, signer addresses, threshold, and owner before any report
   is signed.
3. Grant the adapter `UPDATER_ROLE` through the PSM's governance path.
4. Set the PSM `source` metadata through governance and record the expected value in the deployment
   journal.
5. Submit a fresh test report, verify `CPIUpdated` and `CPIReportAccepted`, and run the combined
   deployment health check with `CPI_UPDATER` and `EXPECTED_CPI_SOURCE`.
6. Treat a source-series or parser-policy change as a new adapter deployment. Revoke the old
   adapter's PSM role only after the new adapter passes its first-report and health checks.
7. Review signer additions, removals, threshold changes, and owner transfers as governance actions.

The module remains unaudited. A deployment must not treat the presence of this source file or its
tests as an approval to accept meaningful funds.

## Monitoring requirements

Run the combined audit with the deployment's expected updater and source:

```shell
RPC_URL=https://... EXPECTED_CHAIN_ID=421614 \
TIMELOCK=0x... TOKEN=0x... TEAM_VESTING=0x... TREASURY_VESTING=0x... \
DAO=0x... PSM=0x... RESERVE_TOKEN=0x... \
TEAM_BENEFICIARY=0x... TREASURY_BENEFICIARY=0x... DEPLOYER_ADDRESS=0x... \
CPI_UPDATER=0x... CPI_ADAPTER=0x... \
EXPECTED_CPI_SOURCE=https://... EXPECTED_CPI_SOURCE_ID=0x... \
./scripts/check-deployment-health.sh
```

Alert on these conditions:

- `timestamped_cpi_report_missing`;
- `timestamped_cpi_report_stale`;
- `reserve_deficit`;
- `configured_cpi_updater_missing_role`;
- `cpi_source_mismatch`;
- `cpi_adapter_psm_mismatch`;
- `cpi_adapter_source_id_mismatch`;
- `cpi_adapter_quorum_invalid`;
- overdue normal CPI cadence;
- unexpected `RoleGranted`, `RoleRevoked`, or `SourceUpdated` events.

The operator must retain the source response, parser version, report timestamp, CPI value, PSM
transaction hash, and the health-check output for each accepted report.

## Acceptance tests

Before a deployment grants `UPDATER_ROLE`, the adapter contribution must include:

- unit tests for valid reports and the exact source-to-`CPI_PRECISION` conversion;
- rejection tests for missing fields, malformed values, wrong units, duplicate timestamps,
  future timestamps, stale timestamps, revisions, and unauthorized submissions;
- integration tests that exercise `updateCPIWithTimestamp` and the PSM's bounds, step, cadence,
  reserve, and freshness checks;
- key-rotation tests covering grant, first successful report, and revoke;
- monitoring tests covering an absent role and a mismatched source label;
- a local-demo or fork test that records the report archive and transaction hash;
- an independent security review of the adapter, parser, custody path, and deployment policy.

The contribution must document the exact commands and tool versions used to run these tests.

## Open decisions for the implementer

The following choices require a written deployment decision before implementation:

- the official CPI series and its revision policy;
- a single-source or multi-source quorum model;
- the consumer or signer architecture;
- the source heartbeat and alert lead time;
- the emergency correction process;
- the chain-specific transaction sponsor and key custody system.

See [issue #17](https://github.com/fredrikblau/halal-protocol/issues/17) for the contribution scope.
