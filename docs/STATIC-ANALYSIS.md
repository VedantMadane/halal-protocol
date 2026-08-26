# Static Analysis Record

This record documents the repository's automated static-analysis scope. It is not a professional
security audit, economic review, oracle review, or deployment approval. A zero-finding run only means
that the selected tool and detectors reported no result in the selected source scope.

## Reproduction

The hosted workflow pins Slither Analyzer `0.11.6` by wheel hash and runs Foundry's build before
analysis. From the repository root, after installing that exact tool and Foundry:

```shell
cd contracts
forge build --build-info --deny never --skip ./test/** ./script/** --force
slither . --exclude-dependencies --filter-paths "src" --sarif ../slither-results.sarif
```

The authoritative command and pinned dependency are maintained in
[`.github/workflows/slither.yml`](../.github/workflows/slither.yml). The workflow uploads SARIF and
fails if Slither reports a high-severity result.

## Recorded run

| Field | Value |
| --- | --- |
| Date (UTC) | 2026-08-26 |
| Analyzer | Slither Analyzer 0.11.6 |
| Source scope | `contracts/src/` first-party contracts |
| Excluded scope | `contracts/lib/` dependencies, tests, and scripts |
| Contracts analyzed | 66 |
| Detectors | 102 |
| Results | 0 |
| Exit status | 0 |
| Interpretation | No Slither result in this scope; independent review remains required |

The report does not prove that the contracts are safe. It does not assess reserve-token issuer
controls, CPI source authenticity, signer custody, governance decisions, deployment wiring, economic
adequacy, or bugs outside the selected detectors. Keep the tool output and the exact commit together
when recording a release review.
