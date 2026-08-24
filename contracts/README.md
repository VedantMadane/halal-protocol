# Halal Contracts

Foundry project for the Halal (HLC) protocol: `HalalToken`, `HalalVesting`, `HalalPSM`,
`HalalDAO`, `HalalTimelock`. For the protocol overview, architecture, and governance model, see
the [root README](../README.md) and [`../docs/`](../docs).

## Layout

- `src/` — the five core contracts.
- `test/` — Foundry test suite (122 tests at the time of writing: 119 unit/configuration tests plus 3 stateful
  PSM invariants; run `forge test` to confirm).
- `script/Deploy.s.sol` — full deployment script (token, vesting, DAO, timelock, role wiring).
- `../scripts/verify-deployment.sh` — read-only post-deployment wiring and role verifier.
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

After deployment, independently verify the on-chain wiring before accepting funds:

```shell
../scripts/verify-deployment.sh
```

Set `RPC_URL`, `EXPECTED_CHAIN_ID`, `TIMELOCK`, `TOKEN`, `TEAM_VESTING`, `TREASURY_VESTING`, `DAO`,
`PSM`, and `RESERVE_TOKEN`; optionally set `DEPLOYER_ADDRESS` and `CPI_UPDATER` to check those role
assignments too. The verifier checks the RPC chain identity, that every supplied address has
contract bytecode, the DAO's token/timelock links, the PSM and vesting links, genesis balances,
role wiring, and a nonzero timelock delay. It is read-only and does not require a private key or
`--broadcast`.
