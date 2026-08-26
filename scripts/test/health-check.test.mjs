import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HEALTH_CHECK = path.join(ROOT, "scripts/check-deployment-health.sh");
const PSM_HEALTH_CHECK = path.join(ROOT, "scripts/check-psm-health.sh");
const ADAPTER_DEMO = path.join(ROOT, "scripts/local-adapter-demo.sh");

function run(script, env, options = {}) {
  const result = spawnSync("bash", [script], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: options.timeout ?? 30_000,
  });
  return { ...result, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function runPsmHealthWithFakeCast(overrides = {}) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "halal-health-check-"));
  const fakeCast = path.join(tempDir, "cast");
  const values = {
    timestamp: "1000",
    reserveSurplus: "0",
    lastReportTimestamp: "900",
    maxReportAge: "200",
    lastUpdated: "1000",
    minUpdateInterval: "200",
    source: '"BLS-CPI"',
    ...overrides,
  };
  writeFileSync(
    fakeCast,
    `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *"block latest"*) echo '${values.timestamp}' ;;
  *"reserveSurplus"*) echo '${values.reserveSurplus}' ;;
  *"lastReportTimestamp"*) echo '${values.lastReportTimestamp}' ;;
  *"MAX_REPORT_AGE"*) echo '${values.maxReportAge}' ;;
  *"lastUpdated"*) echo '${values.lastUpdated}' ;;
  *"minUpdateInterval"*) echo '${values.minUpdateInterval}' ;;
  *"source()(string)"*) echo '${values.source}' ;;
  *) echo "unexpected fake cast call: $*" >&2; exit 1 ;;
esac
`,
  );
  chmodSync(fakeCast, 0o755);

  try {
    return run(PSM_HEALTH_CHECK, {
      ...process.env,
      PATH: `${tempDir}:${process.env.PATH}`,
      RPC_URL: "http://fake-rpc.invalid",
      PSM: "0x0000000000000000000000000000000000000001",
      FAIL_ON_UPDATE_OVERDUE: "false",
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("healthy disposable adapter rehearsal returns zero and status=healthy", () => {
  const result = run(ADAPTER_DEMO, { ...process.env }, { timeout: 120_000 });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /^status=healthy$/m);
});

test("missing deployment-health configuration is classified and nonzero", () => {
  const env = { ...process.env };
  delete env.RPC_URL;
  delete env.EXPECTED_CHAIN_ID;
  delete env.PSM;

  const result = run(HEALTH_CHECK, env);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /status=unhealthy/);
  assert.match(result.output, /reason=missing_required_environment_variable/);
  assert.match(result.output, /missing_variable=RPC_URL/);
});

test("failed deployment wiring is classified and nonzero", () => {
  const result = run(HEALTH_CHECK, {
    ...process.env,
    RPC_URL: "http://127.0.0.1:1",
    EXPECTED_CHAIN_ID: "421614",
    PSM: "0x0000000000000000000000000000000000000001",
  });
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /reason=deployment_wiring_check_failed/);
});

test("standalone PSM health check reports a healthy fake-RPC state", () => {
  const result = runPsmHealthWithFakeCast();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /^psm=0x0000000000000000000000000000000000000001$/m);
  assert.match(result.output, /^cpi_source=BLS-CPI$/m);
  assert.match(result.output, /^status=healthy$/m);
});

test("standalone PSM health check reports stale CPI data", () => {
  const result = runPsmHealthWithFakeCast({ lastReportTimestamp: "700" });
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /^status=unhealthy$/m);
  assert.match(result.output, /^reason=timestamped_cpi_report_stale$/m);
});

test("standalone PSM health check reports a reserve deficit", () => {
  const result = runPsmHealthWithFakeCast({ reserveSurplus: "-1" });
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /^status=unhealthy$/m);
  assert.match(result.output, /^reason=reserve_deficit$/m);
});
