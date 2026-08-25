import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HEALTH_CHECK = path.join(ROOT, "scripts/check-deployment-health.sh");
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
