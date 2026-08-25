# Reproducible PSM scenario model

`scripts/model-psm.mjs` gives reviewers a small, dependency-free way to inspect the reserve
obligation created by CPI-indexed redemption. It uses the same 18-decimal conversion and integer
rounding direction as `HalalPSM` for a single initial deposit, then applies a monthly CPI path.

Run the default 24-month scenario from the repository root:

```shell
make economic-model
```

The script prints key/value assumptions followed by CSV rows. The default scenario deposits
1,000,000 whole reserve units at CPI `1_000_000` (1.0), then increases CPI by 50 basis points per
month without adding reserve. `reserve_surplus_or_deficit_base_units` shows the reserve shortfall
that governance or the treasury would need to cover.

Run a longer path and apply the required top-up at every step:

```shell
node scripts/model-psm.mjs \
  --months=120 \
  --monthly-inflation-bps=50 \
  --initial-reserve=1000000 \
  --apply-topups=true
```

The model accepts these options:

| Option | Default | Meaning |
| --- | ---: | --- |
| `--months` | `24` | Number of monthly CPI updates to model, up to 1,000 |
| `--monthly-inflation-bps` | `50` | CPI movement per month; the script enforces the PSM's 20% step limit |
| `--initial-cpi-ppm` | `1000000` | Initial CPI in `CPI_PRECISION` units |
| `--initial-reserve` | `1000000` | Initial deposit in whole 18-decimal reserve units |
| `--apply-topups` | `false` | Add each reported top-up to the modeled reserve before the next row |

The model does not fetch CPI data, model withdrawals, include reserve-token fees, or predict market
prices. It answers one narrow question: given a deposit and a CPI path, how much reserve does the
PSM need to redeem the outstanding HLC at each rate? Use the Solidity tests and the operator health
check for on-chain behavior and deployed-state monitoring.

For a reserve token with different decimals, scale the inputs to base units and use the independent
conversion tests in [`contracts/test/HalalPSMArithmetic.t.sol`](../contracts/test/HalalPSMArithmetic.t.sol)
as the arithmetic reference. The model is an analysis aid, not an economic forecast or a safety
case for deploying funds.
