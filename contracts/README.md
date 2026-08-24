# Halal Contracts

Foundry project for the Halal (HLC) protocol: `HalalToken`, `HalalVesting`, `HalalPSM`,
`HalalDAO`, `HalalTimelock`. For the protocol overview, architecture, and governance model, see
the [root README](../README.md) and [`../docs/`](../docs).

## Layout

- `src/` — the five core contracts.
- `test/` — Foundry test suite (115 tests at the time of writing: 112 unit/configuration tests plus 3 stateful
  PSM invariants; run `forge test` to confirm).
- `script/Deploy.s.sol` — full deployment script (token, vesting, DAO, timelock, role wiring).
- The production deployer selects an approximately one-week voting period on Arbitrum by default;
  review or override it for every target chain.
- `script/Examples.s.sol` — example governance proposal templates (CPI update, source switch,
  role grants, vesting revocation).

## Usage

### Build

```shell
forge build
```

### Test

```shell
forge test -vvv
```

### Format

```shell
forge fmt src test script
```

CI checks formatting for first-party code only, so local verification can avoid rewriting the
vendored libraries:

```shell
forge fmt --check src test script
```

### Gas report / coverage

```shell
forge build --gas-report
forge coverage
```

### Deploy

Requires a `.env` with `PRIVATE_KEY`, `RPC_URL`, `RESERVE_TOKEN`, `TEAM_BENEFICIARY`, and
`TREASURY_BENEFICIARY` (plus optional governance parameters) — see
[`../docs/DAO-Guide.md`](../docs/DAO-Guide.md) for the full walkthrough.

```shell
forge script script/Deploy.s.sol:DeployHalalSystem --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```
