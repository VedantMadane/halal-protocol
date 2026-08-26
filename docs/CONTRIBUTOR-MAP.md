# Contributor map

Pick a bounded problem, read the linked design note, and open an issue before changing protocol
behavior. A useful contribution leaves a test, a reproducible command, or a documented decision
that another reviewer can check.

The current security review scope is [issue #16](https://github.com/fredrikblau/halal-protocol/issues/16).
Start there if you want to inspect the PSM, CPI boundaries, reserve assumptions, or governance
operations. Report fund-risking findings through [`SECURITY.md`](../SECURITY.md), not the issue.

## Good first issues

Choose the task that matches your interests; each issue includes a bounded scope, acceptance
criteria, and a safe local verification path:

- [Vesting beneficiary browser coverage (#50)](https://github.com/fredrikblau/halal-protocol/issues/50) —
  end-to-end coverage for the two-step beneficiary handoff.
- [Copyable deployment-health evidence (#51)](https://github.com/fredrikblau/halal-protocol/issues/51) —
  a keyboard-accessible frontend action for sharing safe, read-only health output.
- [Worked redeemable-credit example (#52)](https://github.com/fredrikblau/halal-protocol/issues/52) —
  documentation showing HLC balances and redemption credits through a complete flow.

The completed [local-demo troubleshooting guide](LOCAL-DEMO-TROUBLESHOOTING.md) covers prerequisites,
ports, stale configuration, cleanup, and expected success signals.

The [deployment review worksheet (#42)](https://github.com/fredrikblau/halal-protocol/issues/42)
is a completed example of the contribution standard above.

## Choose a path

| Interest | Start here | A finished contribution proves |
| --- | --- | --- |
| Solidity security | [`docs/THREAT-MODEL.md`](THREAT-MODEL.md), [`contracts/test/`](../contracts/test/) | An adversarial test, the affected invariant, and a clear risk explanation |
| Reserve-token behavior | [`HalalPSM.t.sol`](../contracts/test/HalalPSM.t.sol), [`HalalPSMArithmetic.t.sol`](../contracts/test/HalalPSMArithmetic.t.sol) | A reserve-token fixture and tests for balance deltas, fees, decimals, or callback behavior |
| CPI/oracle integration | [`HalalPSM.sol`](../contracts/src/HalalPSM.sol), [`docs/CPI-ADAPTER-SPEC.md`](CPI-ADAPTER-SPEC.md), [`docs/OPERATOR-RUNBOOK.md`](OPERATOR-RUNBOOK.md) | A reviewed adapter or relayer with source provenance, heartbeat, fallback, and rotation rules |
| Monitoring | [`scripts/check-deployment-health.sh`](../scripts/check-deployment-health.sh), [`docs/OPERATOR-RUNBOOK.md`](OPERATOR-RUNBOOK.md) | A read-only alert integration that preserves the scripts' fail-closed exit behavior |
| Economic research | [`docs/ECONOMIC-MODEL.md`](ECONOMIC-MODEL.md), [`scripts/model-psm.mjs`](../scripts/model-psm.mjs) | A reproducible scenario, explicit assumptions, and a comparison with the Solidity rounding rules |
| dApp UX | [`app/src/components/`](../app/src/components/), [`app/README.md`](../app/README.md) | A usable flow on the local demo, responsive states, and passing lint/build checks |
| Governance design | [`docs/DAO-Guide.md`](DAO-Guide.md), [`contracts/script/Examples.s.sol`](../contracts/script/Examples.s.sol) | Decoded proposal actions, timing analysis, and tests for the timelock path |
| Documentation | [`docs/DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md), [`deployment-config test guide`](DEPLOYMENT-CONFIG-TESTS.md) | A correction tied to current source code, with commands or links a reviewer can follow |

## Run the project

From the repository root:

```shell
make verify
make economic-model
./scripts/local-demo.sh
```

The local demo uses a disposable Anvil chain and a faucet-only `mDAI` token. Never use its
published development mnemonic or reserve token on a public network.

## Submit work

Open an issue for a non-trivial change and describe the problem, the smallest proposed scope, and
the evidence you plan to add. Use a topic branch and a Conventional Commit. A pull request should
link the issue, state whether it changes deployed behavior, and include the commands you ran.

Do not disclose security vulnerabilities in an issue or pull request. Follow [`SECURITY.md`](../SECURITY.md)
for private reporting. Contract changes require extra review because the reference contracts are
immutable and unaudited.
