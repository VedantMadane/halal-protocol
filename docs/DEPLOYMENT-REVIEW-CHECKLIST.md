# Public deployment review worksheet

Copy this worksheet once for each public deployment and keep the completed record in the
deployment journal. It is an evidence-collection aid for a testnet or reference deployment; it is
not a security audit, economic guarantee, or approval to accept funds.

Never paste private keys, seed phrases, RPC credentials, or signed messages into this worksheet.
The local Anvil demo uses disposable accounts and addresses and must not be used as public
deployment evidence.

## Review record

| Field | Value |
| --- | --- |
| Reviewer(s) |  |
| Review date (UTC) |  |
| Network / chain ID |  |
| Release tag |  |
| Deployment commit |  |
| Deployment transaction |  |
| Deployment block |  |
| Public status | `testnet only` until separately approved |
| Journal URL |  |

## 1. Freeze the identity of the deployment

- [ ] Record the exact release tag and commit used by the deployment. Confirm the commit is
      reachable from the repository and has a passing CI result. See the [deployment registry
      schema](DEPLOYMENT-REGISTRY.md) and `git show <commit>`.
- [ ] Record the numeric chain ID from the target RPC and compare it with the deployment command's
      `EXPECTED_CHAIN_ID`. Run `cast chain-id --rpc-url "$RPC_URL"`.
- [ ] Record the deployment transaction hash, block number, explorer transaction URL, and source
      verification URL. Keep the explorer links HTTPS and verify that they point to this exact
      deployment.
- [ ] Confirm the target chain is one the dApp currently supports: `31337` (local Anvil), `421614`
      (Arbitrum Sepolia), or `42161` (Arbitrum One). A new chain requires frontend configuration
      and validation changes before registration.

Evidence:

```text
Network / chain ID:
Release:
Commit:
Deployment transaction:
Deployment block:
Explorer transaction URL:
Source verification URL:
```

## 2. Record and verify the address set

Record all seven core contract addresses plus the reserve token. The read-only verifier is
[`scripts/verify-deployment.sh`](../scripts/verify-deployment.sh); it checks bytecode and the
cross-contract wiring listed below.

| Component | Address | Explorer source URL | Verified |
| --- | --- | --- | --- |
| HLC token |  |  | [ ] |
| Team vesting |  |  | [ ] |
| Treasury vesting |  |  | [ ] |
| DAO |  |  | [ ] |
| Timelock |  |  | [ ] |
| HalalPSM |  |  | [ ] |
| Reserve token |  |  | [ ] |
| CPI adapter (if used) |  |  | [ ] |

- [ ] Confirm every listed address has contract bytecode on the intended chain.
- [ ] Run the complete read-only verifier with the exact addresses and retain its output:

  ```sh
  RPC_URL="$RPC_URL" EXPECTED_CHAIN_ID=421614 \
  TIMELOCK=0x... TOKEN=0x... TEAM_VESTING=0x... TREASURY_VESTING=0x... \
  DAO=0x... PSM=0x... RESERVE_TOKEN=0x... \
  TEAM_BENEFICIARY=0x... TREASURY_BENEFICIARY=0x... DEPLOYER_ADDRESS=0x... \
  ./scripts/verify-deployment.sh 2>&1 | tee deployment-verifier.txt
  ```

- [ ] The verifier exits zero and the retained output is linked from the journal. Do not treat a
      manually copied address list as a substitute for this command.
- [ ] Confirm source verification and constructor arguments independently on the target explorer.

## 3. Review custody and permissions

Use [`docs/OPERATOR-RUNBOOK.md`](OPERATOR-RUNBOOK.md), [`docs/THREAT-MODEL.md`](THREAT-MODEL.md),
and the verifier output as the authority for this section.

- [ ] Team and treasury beneficiaries are distinct, nonzero, and not the deployer.
- [ ] The beneficiary addresses are controlled by the intended multisig or custody process; record
      the custody evidence without recording private material.
- [ ] The token's admin, minter, and burner roles are held only by the intended timelock/PSM paths.
- [ ] The DAO points to the intended HLC token and timelock.
- [ ] The timelock delay is positive and the intended proposer/executor/admin roles are present.
- [ ] The deployer has no lingering token admin/minter/burner, timelock admin, PSM admin/parameter,
      or PSM updater privilege unless a separately documented launch exception applies.
- [ ] Any CPI updater is recorded, has the intended `UPDATER_ROLE`, and has a documented key-custody
      and rotation process.

## 4. Perform reserve-token due diligence

The PSM can account for several transfer behaviors, but it cannot make a hostile, frozen, censored,
upgradeable, or issuer-controlled reserve token safe. Use the compatibility matrix in the
[operator runbook](OPERATOR-RUNBOOK.md#11-confirm-the-deployment-inputs) and record conclusions
for the exact token address. Complete the standalone [reserve-asset due-diligence checklist]
(RESERVE-ASSET-DUE-DILIGENCE.md) and link the completed record from the journal.

- [ ] Record reserve token address, symbol, decimals, implementation/proxy details, and issuer. The
      deployment script also fails before broadcasting if the configured reserve address has no
      contract bytecode.
- [ ] Confirm decimals are within the PSM-supported range and match the live contract.
- [ ] Review incoming and outgoing fee behavior, including the actual recipient receipt.
- [ ] Review pause, blacklist, freeze, upgrade, mint, and admin powers of the issuer.
- [ ] Confirm the reserve is suitable for this testnet/reference purpose and document the limitation
      that testnet tokens have no assumed value.
- [ ] Compare the exact token behavior with the focused PSM tests; attach any additional test or
      simulation used for behavior not covered by the repository.

Reserve review notes:

```text
Token / implementation:
Decimals:
Transfer and fee behavior:
Issuer controls:
Testnet suitability and limitations:
Evidence links:
```

## 5. Bootstrap and review CPI reporting

For a governed signed adapter, follow [`docs/CPI-ADAPTER-SPEC.md`](CPI-ADAPTER-SPEC.md) and retain
the source-response hash and exact source evidence for each accepted report.

Use the provider-neutral [`CPI source-policy record`](CPI-SOURCE-POLICY-TEMPLATE.md) to capture the
source identity, value transformation, parser evidence, revision policy, signer custody, and
operational contacts before the adapter receives `UPDATER_ROLE`.

- [ ] Record the CPI source label, source series identity, publisher, update cadence, and fallback
      policy.
- [ ] If an adapter is used, record its address, immutable PSM, source ID, owner/timelock, signer
      addresses, and threshold. Confirm the owner is not one of the signers.
- [ ] Confirm the adapter's signer custody and rotation procedure are separate from the updater
      execution process.
- [ ] Submit a current, past, in-range report through the reviewed updater or adapter path.
- [ ] Confirm the first accepted report advances both adapter and PSM timestamps as expected.
- [ ] Run the read-only health check and retain output showing `status=healthy`:

  ```sh
  RPC_URL="$RPC_URL" PSM="$PSM" \
  CPI_UPDATER=0x... CPI_ADAPTER=0x... \
  EXPECTED_CPI_ADAPTER_OWNER=0x... EXPECTED_CPI_SOURCE_ID=0x... \
  ./scripts/check-psm-health.sh 2>&1 | tee psm-health.txt
  ```

- [ ] Record the accepted report transaction, report timestamp, source publication evidence, and
      `source.responseSha256` when using the BLS parser.
- [ ] Run the combined deployment health check and retain its output. Confirm monitoring is
      configured to alert on nonzero exit status and machine-readable `reason=...` values.

## 6. Register only after the evidence is complete

- [ ] The journal contains the verifier output, health output, source-verification links, reserve
      due diligence, beneficiary/custody review, and first healthy CPI report evidence.
- [ ] Every registry field is copied from the reviewed record, not retyped from memory.
- [ ] The registry entry uses the exact release, commit, chain ID, deployment transaction, HTTPS
      URLs, seven core addresses, reserve symbol, and positive deployment block required by
      [`docs/DEPLOYMENT-REGISTRY.md`](DEPLOYMENT-REGISTRY.md).
- [ ] Run `make registry-check` and inspect the diff before opening a pull request.
- [ ] Mark the deployment explicitly `testnet only` until governance, security review, and launch
      approval are documented separately.

## Reviewer decision

- [ ] Evidence complete; suitable for the stated testnet/reference scope.
- [ ] Evidence incomplete; do not register or promote the deployment.
- [ ] Security or fund-risking concern found; stop and follow [`SECURITY.md`](../SECURITY.md), not
      a public issue or pull request.

Decision and follow-up:

```text
Decision:
Open questions:
Owner and due date:
Journal link:
```
