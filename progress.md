# Progress log

## 2026-08-26 — reserve-deficit contributor task

- Implemented issue #56 as a deterministic browser regression: the local timelock creates an
  under-collateralized PSM state, `/health` reports blocking reserve coverage, and `/psm` explains
  the pause while disabling new deposits before any wallet transaction is submitted.
- Wrapped the scenario in an Anvil snapshot/revert so it does not contaminate later tests. Frontend
  lint and the complete browser suite pass (12/12).

## 2026-08-26 — CPI source-policy template

- Implemented issue #54 with a provider-neutral `docs/CPI-SOURCE-POLICY-TEMPLATE.md` covering source
  identity, units/rounding, parser evidence, revision policy, signer custody, and monitoring.
- Linked it from the adapter specification, operator runbook, deployment review checklist, and README.
- Registry validation passed; published alpha169, confirmed all six hosted workflows green, and
  closed issue #54 with the evidence.

## 2026-08-26 — contributor queue accuracy

- Audited #55 and found its healthy adapter and durable mismatch scenarios already covered by the
  existing 11-test browser suite; closed it as already covered rather than advertising duplicate work.
- Opened #56 for the missing reserve-deficit health-state browser regression and repointed README and
  contributor-map starter links to #54 and #56.
- Published the queue correction as alpha170 after validation.

## 2026-08-26 — CPI owner custody preflight

- Hardened the production CPI adapter deployment script so `ADAPTER_OWNER` must be an already
  deployed contract, normally the protocol timelock, and cannot be an EOA or the deployer.
- Added focused deployment-config coverage (9/9), synchronized the public suite count to 185 tests,
  and documented the production/rehearsal distinction.
- Full local verification passed; published alpha167, confirmed all six hosted workflows green, and
  recorded the result on issue #17.

## 2026-08-26 — contributor queue replenishment

- Found and removed closed issues #50–#53 from the public good-first-issue entry points.
- Opened #54 (CPI source-policy template) and #55 (configured adapter health-page browser coverage),
  both labeled `good first issue`, `help wanted`, and a focused area label; README and contributor
  map now point only to active starter work.
- Published the contributor-funnel refresh as alpha168 after link and label validation.

## 2026-08-26 — adversarial reserve-token invariants

- Implemented issue #53 with stateful handlers for a 1% fee-on-transfer reserve and a false-returning
  reserve; preserved credit conservation, collateralization, and supply decomposition while proving
  rejected transfers leave accounting unchanged.
- Focused suite passes 5/5; updated threat-model/invariant documentation and synchronized the public
  suite count to 184 tests. Elevated deep-style invariants pass 5/5 at 128 × 8,192 calls; the full
  repository gate also passes, so publication is ready.
- Published alpha166, confirmed all six hosted workflows green, and closed issue #53 with the
  verification evidence.

## 2026-08-26 — deployment custody preflight

- Hardened the production deployment script so both vesting beneficiaries must already be deployed
  contracts, matching the multisig/custody policy in issue #40; the local Anvil demo remains EOA-compatible.
- Added focused deployment-config coverage (8/8 passing) and documented the production/local distinction
  in the contracts README and operator runbook. Full verification passed: 179 Solidity tests (including
  3 invariants), 34 Node tests, 11 browser tests, lint/build, smoke checks, and adapter rehearsal.
- Published alpha165, confirmed all six hosted workflows green, and posted the repository-side
  prerequisite evidence to issue #40.

## 2026-08-26 — redeemable-credit documentation

- Implemented issue #52 with a worked, explicitly illustrative example covering ordinary ERC20 transfer, `transferRedeemable`, withdrawal, and `cancelRedeemable`, tied to the current invariants and test names.
- Published alpha164, closed #52, and confirmed all six release-triggered hosted workflows are green.

## 2026-08-26 — vesting handoff CI stabilization

- Hosted CI exposed a timing-sensitive acceptance-toast assertion in the new two-wallet vesting regression; replaced it with durable post-transaction beneficiary and pending-state assertions.
- Local lint, build, and all 11 browser tests pass. Published alpha163 with durable-state assertions; all six hosted workflows are green and the worktree is clean.

## 2026-08-26 — vesting handoff UX

- Implemented issue #50's end-to-end vesting handoff coverage and fixed the underlying UX gap: pending beneficiaries now see the schedule and can accept, while only the active beneficiary can release.
- Added a two-wallet Playwright regression; focused validation and the full 11-test frontend suite pass. Published alpha162 and closed #50; hosted CI later exposed a transient-toast race in the regression.

## 2026-08-26 — deployment-health evidence UX

- Implemented issue #51: the health page now copies a public, machine-readable summary containing chain ID, timestamp, overall checks, and visible reasons, with accessible success/error feedback.
- Focused lint/browser validation and full frontend build/e2e validation pass. Published alpha161, closed #51, and all six hosted workflows are green.

## 2026-08-26 — deeper security contribution path

- Coverage review confirmed 178 Solidity tests pass; production contracts have strong line/function coverage but meaningful branch gaps remain in PSM and CPI adapter paths.
- Opened #53 for test-first stateful PSM coverage across adversarial reserve-token semantics and linked it from the README and contributor map.
- Prepared alpha160 publication.

## 2026-08-26 — contributor queue refresh

- Found stale links to completed good-first issues in the README and contributor map.
- Opened #50 (vesting browser coverage), #51 (copyable health evidence), and #52 (redeemable-credit example), each with `good first issue`, `help wanted`, focused labels, scope, acceptance criteria, and verification guidance.
- Repointed contributor entry points and published alpha159. All six hosted workflows are green and the worktree is clean.

## 2026-08-26 — contributor queue refresh

- Found stale links to completed good-first issues in the README and contributor map.
- Opened #50 (vesting browser coverage), #51 (copyable health evidence), and #52 (redeemable-credit example), each with `good first issue`, `help wanted`, focused labels, scope, acceptance criteria, and verification guidance.
- Repointed contributor entry points and prepared alpha159 publication.

## 2026-08-26 — documentation accuracy follow-up

- Alpha157 hosted checks are green; found stale current-facing claims of 174 Foundry tests while the verified suite now contains 178 (175 unit/configuration plus 3 invariants).
- Synchronized the affected README, contributor, architecture, DAO, technical, and contracts documentation. Published alpha158; all six hosted workflows are green and the worktree is clean.

## 2026-08-26 — vesting dependency hardening

- Added `HalalVesting` constructor checks for contract bytecode on both the reserve token and DAO timelock dependencies.
- Added focused regression coverage and updated the threat model/changelog for alpha156; refreshed generated ABIs in alpha157 after hosted CI caught the drift. All alpha157 hosted checks are green.

## 2026-08-26

- Started a protocol-hardening pass using persistent file-based planning.
- Prior published baseline: alpha146; worktree was clean before this pass.
- Next: inspect core contract boundaries and select a material, testable improvement.
- Audited PSM, CPI adapter, deployment scripts, threat model, and relevant tests; no immediate
  arithmetic or access-control exploit was established. Constructor dependency validation remains
  a possible defense-in-depth improvement, but needs careful compatibility review.
- Found and fixed the adapter EOA sink edge: an EOA can return successful empty-data calls, so the
  adapter could falsely advance its report watermark. Added constructor code checks for the adapter
  sink and PSM token dependencies, plus regression tests. Targeted suites: 93 passed.
- Full verification reached 174 passing Solidity tests, then stopped at `forge fmt --check` for one
  extra blank line in the new test; no behavioral test failed.
- Formatter normalization made the local gate proceed, but hosted CI correctly caught stale checked-in
  ABIs after the new custom errors. Regenerated `app/src/abis/HalalPSM.ts` and
  `app/src/abis/CPIReportAdapter.ts`; alpha147 remains superseded until the ABI follow-up is published.
- Published ABI follow-up alpha148. Full verification passed with 25 Node tests, 174 Solidity tests,
  6 browser tests, local smoke/rehearsal checks, and generated-ABI verification; all six hosted
  workflows are green. Worktree is clean and synchronized.
- Audited the public contributor funnel and found stale links to closed issues #43 and #44. Opened
  #45, #47, and #48 with `good first issue` plus focused labels and explicit scope/acceptance
  criteria; closed accidental duplicate #46. Updated README and contributor map to point at the
  verified open tasks.
- Published contributor-guide refresh as commit `9d8fa4b`. Local verification passed (25 Node,
  174 Solidity, 6 browser tests plus lint/build/smoke checks), and hosted CI, Deep contract tests,
  Security, Slither, and Scorecard all passed for the new commit. A second accidental duplicate
  (#49) was closed; the canonical public queue is #45, #47, and #48.
- Added explicit fail-closed CPI adapter metadata checks to the frontend integrity hook, dashboard
  card, and health page. ESLint and production build pass; full repository verification is running.
- Full verification passed again: 25 Node, 174 Solidity, and 6 browser tests plus lint, builds,
  smoke checks, and adapter rehearsal. Published as `9eef66b`; hosted CI, Security, Slither, Deep
  Tests, and Scorecard are all green.
- Hardened `check-psm-health.sh` against malformed RPC numerics and invalid overdue-mode values;
  focused health checks pass 8/8. Full verification is running before publication.
- Published the monitoring hardening as `2490ddb`. The complete local gate passed with 27 Node,
  174 Solidity, and 6 browser tests; hosted CI (including changed-path detection, contracts, ABI,
  and frontend jobs), Security, Slither, Deep Tests, and Scorecard all passed.
- Required `EXPECTED_CPI_SOURCE_ID` whenever a health check configures `CPI_ADAPTER`, validated its
  bytes32 format, documented the requirement in the operator runbook, and added regression coverage.
  Final local gate passed with 28 Node, 174 Solidity, and 6 browser tests. Published as `58639cb`;
  all hosted CI jobs and security workflows are green.
- Audited public test-count claims and corrected stale 172/169 references to the current 174/171
  counts in README, contributor, architecture, DAO, technical, and contracts documentation.
- Tightened the health-check preflight so configured adapter metadata is validated before live
  adapter calls; focused health checks pass 10/10. Full verification is running before publication.
- Published the preflight hardening as `8dce455`. Final local gate passed with 29 Node, 174
  Solidity, and 6 browser tests; all hosted CI jobs and security workflows are green.
- Added approval-path simulations to `TransferRedeemableForm`: transfer and claim retirement now
  stop before signing when the exact accounting call would revert; permit paths remain supported.
  Full local verification passed with 29 Node, 174 Solidity, and 6 browser tests. Published as
  `fcb90e4`; hosted frontend/ABI CI and all security workflows are green.
- Added structured PSM/adapter bytecode checks to the health script and a regression for no-code
  addresses; focused health checks pass 11/11. Full verification is running before publication.
- Published the bytecode preflight as `28bc94c`. Final local verification passed with 29 Node, 174
  Solidity, and 6 browser tests; all hosted CI jobs and security workflows are green.
- Prepared and published `v0.1.0-alpha.149`: updated CHANGELOG and CITATION metadata, created the
  prerelease tag, and verified the reproducible source bundle plus SHA-256 checksum. Main-branch
  CI, Security, Slither, Deep Tests, Scorecard, and release-artifact workflows all passed.
- Added four economic-model regression tests; focused suite passes 4/4. Full repository
  verification is running before publication.
- Published `v0.1.0-alpha.150` with the economic-model regression suite and synchronized citation
  metadata. Release tarball/checksum and provenance passed, as did all main-branch CI and security
  workflows; the clean worktree is synchronized at the alpha150 tag.
- Hardened the reusable CPI adapter governance handoff builder against zero addresses and the
  self-revoking adapter edge case; focused coverage passes 23/23 and full verification passes 34
  Node, 175 Solidity, and 6 browser tests. Publication as alpha151 is pending final push/checks.
- Added browser regressions for stale minimum-output quotes and expired withdrawal deadlines;
  focused and full verification pass with 8 browser tests. Publication as alpha152 is pending.
- Added browser coverage for ordinary approval-based redeemable-credit transfer and irreversible
  claim retirement, with on-chain balance, credit, and supply assertions. The focused scenarios
  and lint pass; publication as alpha153 is pending.
- Hardened CPI adapter signer rotation so a pending ownership recipient cannot be added as a signer
  before accepting ownership. Focused adapter tests pass 24/24 and the full verification gate
  passes 176 Solidity tests and 10 browser tests; publication as alpha154 is pending.
- Hardened HalalDAO deployment against a non-contract timelock dependency and added constructor
  regression coverage. Focused governance coverage passes 35/35; publication as alpha155 is pending.
- Added and linked `docs/LOCAL-DEMO-TROUBLESHOOTING.md` with prerequisite, port, stale-address,
  cleanup, log, and success-signal guidance for first-time contributors. Ready to close issue #48
  after the documentation commit is published.
