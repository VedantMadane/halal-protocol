# Local deployment evidence example

This example shows how to rehearse the deployment-review evidence path without a public RPC,
private key, real reserve asset, or registry entry. Every address produced by these commands belongs
to a disposable Anvil chain and must be discarded when the command exits.

## 1. Capture the healthy rehearsal

From a clean checkout, run the configured local application smoke test and retain its output:

```sh
mkdir -p evidence/local
make app-smoke 2>&1 | tee evidence/local/app-smoke.txt
```

The output includes the disposable deployment addresses, a fresh local CPI report, the read-only
deployment-wiring verification, reserve/CPI health output, and successful route checks. The script
cleans up Anvil and restores `app/.env.local` when it exits. Do not commit the `evidence/local/`
directory if it contains machine-specific output.

For the signed CPI path, capture the separate two-of-two rehearsal as well:

```sh
make adapter-demo 2>&1 | tee evidence/local/adapter-demo.txt
```

Review these lines before treating the rehearsal as successful:

```text
Deployment registry valid: 0 deployment(s)
status=healthy
Local CPI adapter rehearsal passed on chain 31337.
```

The exact output is evidence that the disposable scripts agree with one another. It is not source
verification, reserve-token due diligence, a public deployment, an audit, or permission to accept
meaningful funds.

## 2. Preserve the evidence map

Copy the relevant observations into a working copy of [`DEPLOYMENT-JOURNAL-TEMPLATE.md`](DEPLOYMENT-JOURNAL-TEMPLATE.md):

| Journal section | Local rehearsal evidence |
| --- | --- |
| Deployment identity | commit from `git rev-parse HEAD`, release tag if applicable, and the smoke-test output file |
| Address and wiring | deployment lines plus the `Halal deployment wiring verified` line |
| CPI source and first report | adapter-demo source ID, accepted timestamp, and `status=healthy` output |
| Health and monitoring | the human-readable health output and the command exit status |
| Final decision | `testnet only` or `blocked`; never `approved scope` from a local rehearsal |

For a public deployment, replace each local observation with the target-chain transaction, verified
source, reserve review, custody evidence, source-policy record, and archived output required by the
[deployment review checklist](DEPLOYMENT-REVIEW-CHECKLIST.md). Run the recorder only after that
evidence is complete:

```sh
node scripts/record-deployment-manifest.mjs --help
```

The recorder now checks that the supplied deployment transaction has a matching successful receipt
and a mined block before it invokes the wiring verifier and writes registry metadata.

## 3. Exercise an unhealthy input path safely

The health wrapper must fail closed when required configuration is absent. This command performs no
RPC call and intentionally produces a machine-readable unhealthy result:

```sh
env -u PSM RPC_URL=http://127.0.0.1:18545 EXPECTED_CHAIN_ID=31337 \
  ./scripts/check-deployment-health.sh --json
```

Expected result includes:

```json
{"schemaVersion":1,"status":"unhealthy","reasons":["missing_required_environment_variable"],"warnings":[],"observed":{"missing_variable":"PSM"}}
```

This is a tooling-path rehearsal, not a claim that any deployment is unhealthy. For a live local
chain, run the health command with the exact addresses printed by the disposable script and retain
both its exit status and its `reason=...` lines; never substitute those values into the checked-in
deployment registry.

## Safety boundary

- Do not point these commands at Arbitrum, mainnet, or an RPC URL containing credentials.
- Do not paste private keys, seed phrases, signed messages, or machine-specific evidence into Git.
- Do not use the faucet-backed local `mDAI` as collateral with economic value.
- A local green rehearsal proves wiring and script behavior only; it cannot prove the reserve asset,
  CPI source, signer custody, governance policy, or immutable contracts are safe.
