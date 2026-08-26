import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONSUMER = path.join(ROOT, "scripts/consume-health-json.mjs");
const OUTPUT_JSON = path.join(ROOT, "scripts/health-output-json.mjs");

function run(report) {
  return spawnSync(process.execPath, [CONSUMER], {
    cwd: ROOT,
    input: JSON.stringify(report),
    encoding: "utf8",
  });
}

function runUnclassifiedHealthFailure() {
  return spawnSync("bash", ["-c", `printf '%s\\n' 'RPC connection failed' | HEALTH_CHECK_EXIT_STATUS=1 node '${OUTPUT_JSON}'`], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

const healthy = { schemaVersion: 1, status: "healthy", reasons: [], warnings: [], observed: { chain_id: "31337" } };
const unhealthy = {
  schemaVersion: 1,
  status: "unhealthy",
  reasons: ["reserve_deficit"],
  warnings: ["normal_cpi_update_overdue"],
  observed: { reserve_surplus: "-1" },
};

test("returns zero for healthy health JSON", () => {
  const result = run(healthy);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /halal_health status=healthy reasons=none warnings=none/);
});

test("preserves unhealthy health JSON as a nonzero exit", () => {
  const result = run(unhealthy);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /status=unhealthy reasons=reserve_deficit warnings=normal_cpi_update_overdue/);
});

test("classifies an unstructured failed health check as unhealthy JSON", () => {
  const result = runUnclassifiedHealthFailure();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "unhealthy");
  assert.deepEqual(report.reasons, ["health_check_failed"]);
});

test("rejects an unsupported health schema", () => {
  const result = run({ ...healthy, schemaVersion: 2 });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /reason=unsupported_health_schema/);
});
