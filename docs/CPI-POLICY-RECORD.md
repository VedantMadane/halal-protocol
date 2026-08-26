# Machine-readable CPI policy records

`scripts/validate-cpi-policy.mjs` checks a JSON companion record for the human-readable
[CPI source-policy template](CPI-SOURCE-POLICY-TEMPLATE.md). It is an evidence-shape and
consistency check, not an oracle, source, deployment, or security approval.

Run it without an RPC, wallet, private key, or file mutation:

```sh
node scripts/validate-cpi-policy.mjs \
  --input scripts/test/fixtures/cpi-policy-draft.json --json
```

The result is one of:

- `draft`: structurally valid but with explicit pending decisions; not reviewable or approved.
- `reviewable`: required fields and evidence links are present and internally consistent. This
  does not authenticate the source, validate transport contents, approve the oracle, or replace an
  independent security review.
- `invalid`: required fields, evidence formats, status semantics, or signer quorum checks failed.

Reviewed records require `status: "reviewed"`, HTTPS archive and evidence links, a parser commit and
raw-response SHA-256, a source-publication `reportedAt` policy, a valid signer quorum, and at least
one independently identified reviewer. A draft may use explicit `PENDING` values, which are listed
in the machine-readable `pending` array rather than silently treated as complete.

Reference fixtures are [`cpi-policy-draft.json`](../scripts/test/fixtures/cpi-policy-draft.json) and
[`cpi-policy-reviewed.json`](../scripts/test/fixtures/cpi-policy-reviewed.json). They use fictional
evidence and must not be copied as production approval. Issue [#94](https://github.com/fredrikblau/halal-protocol/issues/94)
tracks improvements to this format and validator.
