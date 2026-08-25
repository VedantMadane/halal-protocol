#!/usr/bin/env node

const CPI_PRECISION = 1_000_000n;
const MIN_CPI = 100_000n;
const MAX_CPI = 2_000_000n;
const MAX_STEP_BPS = 2_000n;
const BPS = 10_000n;
const RESERVE_DECIMALS = 18n;
const RESERVE_SCALE = 10n ** RESERVE_DECIMALS;

const args = new Map();
for (const argument of process.argv.slice(2)) {
  const [key, value] = argument.split("=", 2);
  if (!key.startsWith("--")) throw new Error(`Unknown argument: ${argument}`);
  args.set(key.slice(2), value ?? "true");
}

function integerArgument(name, fallback, minimum) {
  const raw = args.get(name) ?? fallback.toString();
  if (!/^[0-9]+$/.test(raw)) throw new Error(`--${name} must be a non-negative integer`);
  const value = BigInt(raw);
  if (value < minimum) throw new Error(`--${name} must be at least ${minimum}`);
  return value;
}

function formatSigned(value) {
  return value < 0n ? `-${-value}` : `+${value}`;
}

const months = integerArgument("months", 24n, 0n);
const monthlyInflationBps = integerArgument("monthly-inflation-bps", 50n, 0n);
const initialCpi = integerArgument("initial-cpi-ppm", CPI_PRECISION, MIN_CPI);
const initialReserveWhole = integerArgument("initial-reserve", 1_000_000n, 1n);
const applyTopUps = args.get("apply-topups") === "true";

if (initialCpi > MAX_CPI) throw new Error(`--initial-cpi-ppm must be at most ${MAX_CPI}`);
if (monthlyInflationBps > MAX_STEP_BPS) {
  throw new Error(`--monthly-inflation-bps must be at most ${MAX_STEP_BPS} (the PSM step limit)`);
}
if (months > 1_000n) throw new Error("--months must be at most 1000");

const initialReserve = initialReserveWhole * RESERVE_SCALE;
let cpi = initialCpi;
let reserveHeld = initialReserve;
const hlcIssued = (initialReserve * CPI_PRECISION) / cpi;

console.log("model=halal-psm-18-decimal-reserve");
console.log(`months=${months}`);
console.log(`monthly_inflation_bps=${monthlyInflationBps}`);
console.log(`initial_reserve_whole_units=${initialReserveWhole}`);
console.log(`initial_cpi_ppm=${initialCpi}`);
console.log(`apply_topups=${applyTopUps}`);
console.log(`initial_hlc_issued_base_units=${hlcIssued}`);
console.log("month,cpi_ppm,reserve_held_base_units,reserve_required_base_units,reserve_surplus_or_deficit_base_units,top_up_base_units");

for (let month = 0n; month <= months; month += 1n) {
  if (month > 0n) {
    const nextCpi = (cpi * (BPS + monthlyInflationBps)) / BPS;
    const step = nextCpi - cpi;
    if (nextCpi > MAX_CPI) throw new Error(`CPI exceeds MAX_CPI at month ${month}: ${nextCpi}`);
    if (step > (cpi * MAX_STEP_BPS) / BPS) throw new Error(`CPI step exceeds the PSM limit at month ${month}`);
    cpi = nextCpi;
  }

  const required = (hlcIssued * cpi) / CPI_PRECISION;
  const topUp = required > reserveHeld ? required - reserveHeld : 0n;
  if (applyTopUps) reserveHeld += topUp;
  const surplusOrDeficit = reserveHeld >= required ? reserveHeld - required : -(required - reserveHeld);
  console.log(`${month},${cpi},${reserveHeld},${required},${formatSigned(surplusOrDeficit)},${topUp}`);
}
