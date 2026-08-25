# Operator Runbook

This runbook covers a reference deployment of the Halal contracts. It assumes the operator has
the repository checkout, Foundry, a read-only RPC endpoint, and access to the deployment and
governance accounts. Keep private keys in the signer or custody system; do not put them in this
repository, shell history, CI logs, or monitoring configuration.

The contracts are immutable and the reference system has no general pause. `HalalPSM` rejects new
deposits until it has a fresh CPI report, and rejects them again when that report exceeds
`MAX_REPORT_AGE`. Existing users can still withdraw their own redeemable credit when the reserve
and accounting checks permit it. Treat the PSM health check as an alert and follow the reserve and
governance procedures below.

## 1. Launch acceptance

Complete these checks before accepting a public deposit.

### 1.1 Confirm the deployment inputs

Record the following in a deployment journal:

- chain name and chain ID;
- reserve token address, symbol, decimals, and transfer behavior;
- team and treasury beneficiary addresses, with multisig ownership confirmed;
- DAO, timelock, token, vesting, and PSM addresses;
- CPI source, report publisher, updater account, key custody, and rotation contact;
- deployer address and the commit or release used for deployment.

The reserve token is an external dependency. Check fee-on-transfer behavior, blacklist or pause
controls, upgradeability, decimals, and the issuer's admin powers before deployment. The PSM
accounts for balance deltas and rejects unsupported decimals, but it cannot make a hostile or frozen
reserve token safe.

### 1.2 Deploy and verify

Use a dedicated deployer key and set an explicit chain ID. The production script reads its
configuration from environment variables:

```shell
cd contracts
PRIVATE_KEY=0x... \
RPC_URL=https://... \
EXPECTED_CHAIN_ID=421614 \
RESERVE_TOKEN=0x... \
TEAM_BENEFICIARY=0x... \
TREASURY_BENEFICIARY=0x... \
CPI_UPDATER=0x... \
forge script script/Deploy.s.sol:DeployHalalSystem \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
```

Copy the printed addresses into the journal. Run the read-only verifier from the repository root,
including `CPI_UPDATER` when the deployment bootstraps an updater:

```shell
RPC_URL="$RPC_URL" EXPECTED_CHAIN_ID=421614 \
TIMELOCK=0x... TOKEN=0x... TEAM_VESTING=0x... TREASURY_VESTING=0x... \
DAO=0x... PSM=0x... RESERVE_TOKEN=0x... \
TEAM_BENEFICIARY=0x... TREASURY_BENEFICIARY=0x... \
DEPLOYER_ADDRESS=0x... CPI_UPDATER=0x... \
./scripts/verify-deployment.sh
```

The verifier checks bytecode, chain identity, immutable wiring, vesting policy, token roles,
timelock roles, PSM roles, and the absence of deployer privileges. Stop the launch if it fails.
Verify every contract's source and constructor arguments on the target explorer after the verifier
passes. Explorer verification does not replace the verifier.

### 1.3 Bootstrap the CPI feed

The PSM starts with `lastReportTimestamp == 0`, and its deposit entrypoints reject calls until a
report has been accepted. Submit a current report through the preferred timestamped path before
opening the frontend:

```shell
REPORT_AT=... # source publication timestamp, in Unix seconds
REPORT_CPI=... # CPI_PRECISION units; 1.0 is 1000000
cast send "$PSM" \
  'updateCPIWithTimestamp(uint256,uint256)' "$REPORT_CPI" "$REPORT_AT" \
  --private-key "$UPDATER_KEY" --rpc-url "$RPC_URL"
```

The first report can be accepted immediately when it is in the past, no more than 90 days old, and
new enough to establish the report watermark. Later reports must advance that watermark and wait
for the configured update interval. The updater account cannot bypass the CPI bounds, step limit,
cadence, freshness, or reserve-adequacy checks.

Confirm the result without a signer:

```shell
RPC_URL="$RPC_URL" PSM="$PSM" ./scripts/check-psm-health.sh
```

Require `status=healthy`. Save the output and transaction hash in the journal.

## 2. Recurring monitoring

Run the combined deployment audit from a host that can reach the RPC. It needs no private key and
checks contract wiring before it checks live PSM health:

```shell
RPC_URL=https://... EXPECTED_CHAIN_ID=421614 \
TIMELOCK=0x... TOKEN=0x... TEAM_VESTING=0x... TREASURY_VESTING=0x... \
DAO=0x... PSM=0x... RESERVE_TOKEN=0x... \
TEAM_BENEFICIARY=0x... TREASURY_BENEFICIARY=0x... DEPLOYER_ADDRESS=0x... \
./scripts/check-deployment-health.sh
```

For a health-only check, run:

```shell
RPC_URL=https://... PSM=0x... ./scripts/check-psm-health.sh
```

For a deployment with a governed adapter and recorded source metadata, pass the adapter and both
source expectations. Include the timelock as the expected adapter owner. The check then fails if
governance removed the updater role, changed the source label, pointed the adapter at another PSM,
changed its owner, or changed its quorum:

```shell
RPC_URL=https://... PSM=0x... \
CPI_UPDATER=0x... CPI_ADAPTER=0x... \
EXPECTED_CPI_ADAPTER_OWNER=0x<timelock> \
EXPECTED_CPI_SOURCE=https://... EXPECTED_CPI_SOURCE_ID=0x... \
./scripts/check-psm-health.sh
```

The script emits `key=value` records suitable for a cron wrapper, log shipper, or small exporter.
For a configured adapter it also emits one `cpi_adapter_signer_<index>` record per current signer;
compare those addresses with the deployment journal after each rotation. Alert on a nonzero exit
code and retain the emitted values:

| Signal | Meaning | First response |
| --- | --- | --- |
| `reason=timestamped_cpi_report_missing` | No timestamped source report has been accepted | The PSM rejects deposits; bootstrap a reviewed report through the updater |
| `reason=timestamped_cpi_report_stale` | The latest report is older than `MAX_REPORT_AGE` | The PSM rejects deposits; investigate the source and relayer |
| `reason=reserve_deficit` | Current reserve is below `reserveRequired()` | Stop public promotion, investigate reserve movements, and prepare a governance-approved top-up |
| `reason=configured_cpi_updater_missing_role` | The expected updater no longer holds `UPDATER_ROLE` | Inspect role events and execute a reviewed rotation or restoration proposal |
| `reason=cpi_source_mismatch` | The on-chain source label differs from the deployment record | Review the source-change proposal before accepting new reports |
| `reason=cpi_adapter_psm_mismatch` | The adapter does not target the monitored PSM | Stop updates and inspect the adapter deployment and role grant |
| `reason=cpi_adapter_owner_expectation_missing` | Adapter monitoring lacks the expected timelock owner | Add the deployment timelock as `EXPECTED_CPI_ADAPTER_OWNER` |
| `reason=cpi_adapter_owner_mismatch` | The adapter owner differs from the expected timelock | Stop updates and review ownership transfer events |
| `reason=cpi_adapter_source_id_mismatch` | The adapter's signed-report source ID differs from the deployment record | Rotate to the reviewed adapter for the documented source series |
| `reason=cpi_adapter_quorum_invalid` | The adapter threshold cannot be met by its configured signers | Stop updates and repair the adapter through governance |
| `warning=normal_cpi_update_overdue` | `lastUpdated + minUpdateInterval` has passed | Check the updater queue and source publication schedule |

The default `FAIL_ON_UPDATE_OVERDUE=true` makes overdue cadence an alert. Use
`FAIL_ON_UPDATE_OVERDUE=false` only when a separate alerting rule handles cadence:

```shell
RPC_URL=https://... PSM=0x... FAIL_ON_UPDATE_OVERDUE=false \
  ./scripts/check-psm-health.sh
```

Also monitor these on-chain events and state changes:

- `CPIUpdated` and `CPIReportAccepted` for rate, source timestamp, and updater cadence;
- `ReserveDeposited`, `ReserveWithdrawn`, `Deposited`, `Withdrawn`, and `RedeemableCancelled`;
- `RoleGranted` and `RoleRevoked` on the token, PSM, timelock, and vesting contracts;
- governance proposals, queues, executions, cancellations, and proposal descriptions;
- reserve token upgrades, issuer pauses, blacklist changes, and fee-policy changes.

The health script is the minimum check. Pair it with event indexing and an explorer or archive RPC
when monitoring a public deployment.

## 3. CPI updater operations

Use a dedicated updater account or reviewed consumer. Give it only `UPDATER_ROLE` on the PSM, keep
the signing key in a restricted custody system, and record the source publication timestamp with
each submission. Prefer `updateCPIWithTimestamp` so replayed and delayed source data fails on-chain.

For a quorum adapter, prepare the typed data with `scripts/prepare-cpi-report.mjs`, collect
signatures through the approved custody process, and verify them before submitting. Use the signer
addresses printed by `check-psm-health.sh` and keep them in ascending order:

```shell
node scripts/verify-cpi-report.mjs \
  --typed-data /path/to/typed-data.json \
  --rpc-url "$RPC_URL" --adapter 0x<adapter> \
  --signers 0x<lowest-signer>,0x<next-signer> \
  --signatures 0x<signature-for-lowest>,0x<signature-for-next>
```

Keep the verifier output with the report archive. It contains the adapter, PSM, source ID, live
watermarks, freshness window, signer list, and signature count, but no private key material. The
command fails before signature recovery when the report is stale, replayed, future-dated, or older
than the PSM's accepted-report watermark.

Before each submission, verify:

1. the report came from the documented source;
2. `REPORT_AT` identifies the source publication time, not the relayer's current time;
3. the source value uses the PSM's `CPI_PRECISION` units;
4. the current report is newer than the last accepted report;
5. the cadence has elapsed and the reserve can support the resulting rate.

To rotate an updater, use a normal DAO proposal that calls `grantRole(UPDATER_ROLE, newUpdater)`
and `revokeRole(UPDATER_ROLE, oldUpdater)` on the PSM. The timelock is the PSM role admin. Queue the
proposal, allow the configured voting and timelock windows to complete, verify the executed events,
then run `scripts/verify-deployment.sh` with the new updater address. Keep the old key available
until the new account has successfully submitted a report, then revoke or destroy it according to
the custody policy.

Do not use `mockCPI` as a routine updater path. It is a DAO-gated emergency override that bypasses
the normal step and interval limits. Document the reason, proposed value, reserve impact, and
follow-up source correction in the governance proposal.

## 4. Governance proposal review

Before voting or queueing a proposal, reviewers should:

- decode every target, value, and calldata field;
- compare the target and selector with the published contract source;
- calculate reserve impact at the current and plausible future CPI rates;
- check whether the action grants `MINTER_ROLE`, `BURNER_ROLE`, `PARAM_ROLE`, or `UPDATER_ROLE`;
- confirm beneficiary, reserve token, oracle source, and multisig addresses;
- confirm that the action respects the timelock delay and the published change rationale;
- record the proposal ID, description hash, decoded actions, votes, queue transaction, and execution
  transaction in the deployment journal.

The DAO can govern parameters and extensions, but it cannot make an unsafe reserve token reliable
or recover a compromised signer automatically. Keep proposal review independent from the account
that submits or executes the proposal.

## 5. Incident response

### Missing or stale CPI report

1. Confirm the alert against a second RPC or explorer.
2. Check source publication, updater custody, nonce state, and the last accepted timestamp.
3. Keep the dApp in its safety state and publish the incident status.
4. Submit a verified report when the source and timestamp are available.
5. If the source is wrong or unavailable, prepare a DAO-reviewed emergency action; do not invent a
   report to make the dashboard green.

### Reserve deficit

1. Confirm `reserveSurplus()` and the reserve token balance from an independent RPC.
2. Identify CPI changes, withdrawals, cancellations, reserve transfers, and reserve-token events
   since the last healthy check.
3. Stop new public promotion. The frontend blocks deposits while the deficit remains visible;
   the contract's CPI freshness gate remains independent of that reserve alert.
4. Prepare a governance proposal to top up the reserve or apply another documented mitigation.
5. Do not withdraw reserve surplus while the deficit exists. Re-run the health check after every
   governance or reserve action.

### Suspected updater or privileged-key compromise

1. Revoke or rotate the affected signer through the timelocked governance path if governance still
   controls the role admin.
2. Review all recent `CPIUpdated`, `RoleGranted`, `RoleRevoked`, and governance events.
3. Preserve RPC responses, transaction hashes, source reports, and custody logs.
4. Publish a clear incident notice with affected deployments and user actions.
5. Treat immutable contract behavior as fixed. A code correction requires a separately deployed and
   reviewed system followed by a documented migration.

## 6. Evidence to retain

For each deployment and release, retain:

- git commit and release tag;
- exact environment-variable names and non-secret values;
- deployment transaction hashes and printed addresses;
- verifier output and explorer source-verification links;
- health-check output before and after the first report;
- reserve-token due-diligence notes;
- updater source reports, timestamps, and submission hashes;
- governance proposal IDs, decoded actions, votes, queue, and execution hashes;
- incidents, decisions, and remediation links.

The repository's tests and scripts provide evidence about the reference implementation. They do not
prove that a deployed reserve token, oracle source, signer, RPC endpoint, or governance community is
safe. Record those external assumptions beside the on-chain evidence.
