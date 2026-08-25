# Guidance for coding agents

This repository is the working Halal (HLC) protocol monorepo. It contains immutable-reference
Solidity contracts, Foundry tests and deployment scripts, deterministic CPI tooling, and a Next.js
dApp. Check the current tree and git history before making assumptions; this file is a map, not a
substitute for the source code or the threat model.

## Project map

- `contracts/src/` — `HalalToken`, `HalalVesting`, `HalalPSM`, `HalalDAO`, `HalalTimelock`, and the
  optional `CPIReportAdapter`.
- `contracts/test/` — Foundry unit, fuzz, differential, governance, adapter, and stateful invariant
  tests.
- `contracts/script/` — production deployment, disposable local deployment, adapter rehearsal, and
  governance examples.
- `scripts/` — read-only deployment/PSM health checks, BLS CPI parsing and report preparation,
  registry validation, economic modeling, and local smoke tests.
- `app/` — Next.js dashboard, governance, PSM, vesting, and deployment-health pages.
- `docs/` — architecture, invariants, threat model, operator runbook, CPI adapter specification,
  deployment registry, economic model, and roadmap.

## First commands

From the repository root:

```shell
make verify
./scripts/local-demo.sh
make adapter-demo
```

`make verify` is the complete local gate: registry and shell checks, Node tests, signed CPI adapter
rehearsal, contract build/tests/lint, frontend lint/build/smoke, and browser E2E coverage. The local
demo uses disposable Anvil state and a faucet-only mock reserve; never treat it as a public or
funded deployment.

## Safety boundaries

- The protocol is unaudited and not production-ready. Do not imply otherwise in code, docs, issues,
  or release notes.
- Never commit private keys, seed phrases, RPC credentials, or real deployment secrets.
- Report suspected fund-risking vulnerabilities privately through `SECURITY.md`; do not put exploit
  details in a public issue or pull request.
- Before changing `contracts/src/`, read `docs/THREAT-MODEL.md`, `docs/INVARIANTS.md`, and
  `docs/DESIGN-DECISIONS.md`, open or link an issue for non-trivial behavior, and add focused tests.
- Core contracts are non-upgradeable by design. New capabilities should normally be separate,
  narrowly scoped modules granted roles by DAO governance, not hidden admin or upgrade paths.
- Treat `HalalPSM` redemption credit, reserve collateralization, CPI freshness, role wiring, and
  timelock governance as security-critical state. Plain ERC20 transfers intentionally do not move
  PSM redemption credit.
- A public deployment belongs in `app/src/config/deployment-registry.json` only after the verifier,
  health check, source links, reserve review, beneficiary review, and deployment journal evidence
  required by `docs/DEPLOYMENT-REGISTRY.md` are complete.

## Contribution workflow

Use a topic branch and a Conventional Commit. Read `CONTRIBUTING.md` and
`docs/CONTRIBUTOR-MAP.md`; start with the active `good first issue` tickets for bounded work.
Generated frontend ABIs must be regenerated with `cd app && pnpm gen:abis` after Solidity interface
changes. Keep documentation, test counts, changelog, and citation metadata synchronized when a
release-worthy change is made.

Relevant focused commands:

```shell
cd contracts && forge test --match-test <pattern> -vv
cd app && pnpm lint && pnpm build
node --test scripts/test/*.test.mjs
node scripts/validate-deployment-registry.mjs
```

Use `apply_patch` for edits, preserve unrelated user changes, and verify the final diff before
committing. Do not modify vendored dependencies under `contracts/lib/` unless the task explicitly
requires it.

## Canonical references

- `README.md` — public overview, evidence table, local demo, and contributor funnel.
- `docs/TECHNICAL-DOCS.md` — detailed API/deployment reference.
- `docs/ROADMAP.md` — risk-ordered path to testnet and production readiness.
- `docs/CPI-ADAPTER-SPEC.md` — source provenance, signer custody, and adapter handoff requirements.
- `docs/OPERATOR-RUNBOOK.md` — recurring health checks and incident response.
- `docs/DEPLOYMENT-REGISTRY.md` — evidence required before publishing addresses to the dApp.

The `.attic/` directory contains unrelated historical presentation and Android platform-tool
artifacts. Do not treat them as protocol source or documentation.
