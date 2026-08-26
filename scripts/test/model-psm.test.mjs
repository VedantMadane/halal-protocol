import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = path.join(ROOT, "scripts/model-psm.mjs");

function runModel(...arguments_) {
  const result = spawnSync(process.execPath, [MODEL, ...arguments_], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { ...result, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function csvRows(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => /^\d+,/.test(line))
    .map((line) => line.split(","));
}

test("economic model emits deterministic reserve shortfall rows", () => {
  const result = runModel("--months=2", "--monthly-inflation-bps=50", "--initial-reserve=10");
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(csvRows(result.stdout), [
    ["0", "1000000", "10000000000000000000", "10000000000000000000", "+0", "0"],
    ["1", "1005000", "10000000000000000000", "10050000000000000000", "-50000000000000000", "50000000000000000"],
    ["2", "1010025", "10000000000000000000", "10100250000000000000", "-100250000000000000", "100250000000000000"],
  ]);
});

test("economic model applies exact reserve top-ups to remove the deficit", () => {
  const result = runModel("--months=2", "--monthly-inflation-bps=50", "--initial-reserve=10", "--apply-topups=true");
  assert.equal(result.status, 0, result.output);
  for (const row of csvRows(result.stdout)) {
    assert.equal(row[4], "+0", `unexpected surplus/deficit in row ${row[0]}`);
    assert.equal(row[2], row[3], `reserve does not cover requirement in row ${row[0]}`);
  }
});

test("economic model rejects a monthly CPI step above the PSM limit", () => {
  const result = runModel("--months=1", "--monthly-inflation-bps=2001");
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /monthly-inflation-bps must be at most 2000/);
});

test("economic model rejects malformed numeric options", () => {
  const result = runModel("--initial-reserve=10.5");
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /initial-reserve must be a non-negative integer/);
});
