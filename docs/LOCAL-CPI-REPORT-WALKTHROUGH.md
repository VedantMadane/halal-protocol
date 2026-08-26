# Local CPI report walkthrough

This walkthrough exercises the complete signed-report path on a disposable Anvil chain:

```text
source JSON → typed EIP-712 data → local signer signatures → live adapter checks → verification
```

It is development documentation only. The Anvil chain, accounts, adapter, PSM, and reserve token
created here are disposable and have no public or financial value. Never point these commands at a
public RPC, replace the local accounts with real keys, or reuse the development accounts outside
Anvil.

## Prerequisites

From a fresh clone, install Foundry and Node.js. Confirm the tools are available:

```sh
forge --version
cast --version
node --version
```

No RPC endpoint, wallet, API key, or funded account is needed. The repository's local harness
starts Anvil and derives temporary signer accounts internally.

## Recommended complete rehearsal

Run the maintained end-to-end harness from the repository root:

```sh
make adapter-demo
```

The harness starts a fresh Anvil chain on `http://127.0.0.1:8545`, deploys a local PSM and a
two-of-two `CPIReportAdapter`, creates and accepts a local CPI report, runs the read-only health
check, prepares typed EIP-712 data, and verifies a quorum of local signatures. It refuses to use
an existing process and removes its temporary Anvil process when it exits.

The expected final line is:

```text
Local CPI adapter rehearsal passed on chain 31337.
```

The harness is the safest copy-paste path because it keeps temporary signing material inside the
local process and does not require a contributor to copy a private key into a shell variable. Its
implementation is [`scripts/local-adapter-demo.sh`](../scripts/local-adapter-demo.sh).

## Inspect report preparation

`prepare-cpi-report.mjs` converts a source record into the exact typed data consumed by the adapter.
The example fixture uses illustrative addresses and chain metadata; it is not a live deployment:

```sh
node scripts/prepare-cpi-report.mjs \
  --input scripts/test/cpi-report.example.json \
  --typed-data-out /tmp/halal-cpi-typed-data.json
```

The command prints the normalized `chainId`, adapter, source ID, CPI value in `CPI_PRECISION`
units, report timestamp, and output path. Inspect the generated JSON with:

```sh
node -e 'const report = require("/tmp/halal-cpi-typed-data.json"); console.log(JSON.stringify(report, null, 2))'
```

For a report to be accepted, these values must remain consistent:

| Value | Must match |
| --- | --- |
| `chainId` | The live RPC chain ID and the adapter's EIP-712 domain |
| `adapter` | The live adapter address and typed-data `verifyingContract` |
| `sourceId` | The reviewed source identity and the adapter's immutable source ID |
| `cpi` / `reportedCPI` | The decimal source value and integer `CPI_PRECISION` representation |
| `reportedAt` | A positive, non-future timestamp newer than both live report watermarks |
| signer list | Live adapter signers, in strictly ascending address order |
| signature count | The adapter threshold, with one signature paired to each sorted signer |

The preparation command rejects malformed identities, unsupported CPI values, excess precision,
and future timestamps before any transaction or signature is attempted.

## Manual verification shape

The complete harness performs signing internally. If you are reviewing the individual verifier, its
public interface is:

```sh
node scripts/verify-cpi-report.mjs \
  --typed-data /path/to/typed-data.json \
  --rpc-url http://127.0.0.1:8545 \
  --adapter 0x<local-adapter> \
  --signers 0x<lowest-local-signer>,0x<next-local-signer> \
  --signatures 0x<signature-for-lowest>,0x<signature-for-next>
```

The angle-bracket values are output-dependent placeholders, not credentials. Do not replace them
with keys or signatures from a public network. The verifier reads the live chain ID, adapter PSM,
source ID, signer set, threshold, adapter watermark, PSM watermark, freshness window, and block
time. It delegates EIP-712 recovery to `cast` without needing a private key.

A successful result is one JSON object with `"status":"verified"`, normalized addresses, the
source ID, report timestamps, sorted signers, and signature counts.

## Intentional failure: wrong source identity

The adapter binds reports to a specific `bytes32` source ID. Change only `sourceId` in a copy of the
input JSON, prepare new typed data, and run the verifier with the original local adapter and
signatures. The verifier must fail before signature recovery with an error equivalent to:

```text
typed data sourceId does not match the adapter
```

A stale, replayed, future, or incorrectly ordered report must likewise fail closed. The boundary
tests are in [`scripts/test/verify-cpi-report.test.mjs`](../scripts/test/verify-cpi-report.test.mjs).

## What this does not prove

This walkthrough proves that the local scripts agree with a disposable local adapter. It does not
prove that a CPI publisher is correct, signer keys are safely held, a reserve token is safe, or the
contracts are audited. For a public deployment, follow the
[`CPI adapter specification`](CPI-ADAPTER-SPEC.md), complete the
[`deployment review worksheet`](DEPLOYMENT-REVIEW-CHECKLIST.md), archive the source response and
hash, and obtain the independent review required by the operator runbook.
