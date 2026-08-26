# Release verification walkthrough

This guide verifies that a published Halal release is reproducible from its tagged source and that
the repository's automated evidence is present. It does **not** constitute an independent
smart-contract audit, economic review, deployment approval, or endorsement of the release.

The commands below use a disposable clone. They do not require a private key, RPC credential, wallet,
or signed message. `make verify` starts only local Anvil processes and restores temporary frontend
configuration when it exits.

## 1. Start from a clean clone

```sh
git clone https://github.com/fredrikblau/halal-protocol.git halal-release-review
cd halal-release-review
git fetch --tags --force origin
git status --short
```

The final command must print nothing. Choose the exact signed release tag to review; this example
uses the latest published alpha at the time of writing:

```sh
TAG=v0.1.0-alpha.205
TAG_COMMIT="$(git rev-parse "$TAG^{commit}")"
git show --no-patch --decorate "$TAG_COMMIT"
test "$(git rev-parse "$TAG^{commit}")" = "$TAG_COMMIT"
```

Review the tag's commit history and release notes before running tests. A tag identifies source; it
does not prove that a deployed address runs that source.

## 2. Verify the reproducible release bundle

Published GitHub releases contain a gzip-normalized source archive and a SHA-256 sidecar. Download
both assets without modifying the checkout and verify them from the directory containing the files:

```sh
mkdir -p /tmp/halal-release-artifacts
gh release download "$TAG" --repo fredrikblau/halal-protocol \
  --pattern "halal-protocol-${TAG}.tar.gz" \
  --pattern "halal-protocol-${TAG}.tar.gz.sha256" \
  --dir /tmp/halal-release-artifacts
(cd /tmp/halal-release-artifacts && sha256sum --check "halal-protocol-${TAG}.tar.gz.sha256")
```

The expected result is `OK`. The release workflow also publishes a GitHub build-provenance
attestation. Where the local GitHub CLI supports artifact attestations, verify it with:

```sh
gh attestation verify \
  "/tmp/halal-release-artifacts/halal-protocol-${TAG}.tar.gz" \
  --repo fredrikblau/halal-protocol
```

If the CLI does not support this command, review the **Attestations** section of the release
workflow run and record that limitation; do not replace it with an unverifiable claim.

## 3. Run the repository verification gates

Run the full local gate from the tagged checkout:

```sh
git checkout --detach "$TAG"
make verify
```

The gate includes deployment-registry validation, shell syntax checks, parser/health/economic-model
tests, the signed CPI adapter rehearsal, Foundry build/tests/lint, frontend lint/build, a configured
local dApp smoke test, and the browser permit-flow suite. The local deployment uses disposable
Anvil accounts and must not be pointed at a public RPC.

For faster review of individual gates:

```sh
node scripts/validate-deployment-registry.mjs
bash -n scripts/*.sh
node --test scripts/test/*.test.mjs
cd contracts && forge test --force
cd ../app && pnpm lint && pnpm build
```

Record the command output and the exact `TAG_COMMIT` in the review notes. A green local gate is
evidence about this checkout only.

## 4. Confirm generated frontend ABIs are deterministic

From the tagged checkout, regenerate the frontend interfaces and confirm that the generator leaves
no diff:

```sh
make abis
git diff --exit-code -- app/src/abis
```

An empty diff means the checked-in ABI files match the contracts compiled from the selected tag.
If a diff appears, stop and investigate the compiler, dependencies, source tree, or generated
artifacts before reviewing the release further. Restore disposable generated changes only after
capturing the diff for the review record.

## 5. Confirm hosted checks and scope their meaning

Find the CI run for the exact tagged commit. On a release tag, use the commit SHA rather than a
branch's latest result:

```sh
gh run list --repo fredrikblau/halal-protocol --commit "$TAG_COMMIT" \
  --json name,status,conclusion,url
```

Every applicable workflow should be `completed` with `success`. Open each URL and check that it
tested the same commit. The checks cover repository build, tests, static analysis, dependency
analysis, and supply-chain scoring; they do not replace independent contract, oracle, reserve,
economic, operational, or deployment review.

## 6. Safe review record

Record at minimum:

```text
Release tag:
Tagged commit:
Bundle SHA-256:
Attestation URL / result:
make verify result:
ABI diff result:
Hosted workflow URLs and conclusions:
Reviewer:
Open findings:
```

Never commit private keys, seed phrases, RPC credentials, signed messages, downloaded secrets, or
local `.env` files. Report suspected vulnerabilities through [`SECURITY.md`](../SECURITY.md), not
a public issue. A successful walkthrough means the release evidence is reproducible; it does not
mean the unaudited protocol is safe for meaningful funds.
