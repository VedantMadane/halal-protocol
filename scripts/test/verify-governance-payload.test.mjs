import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyGovernancePayload } from "../verify-governance-payload.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(ROOT, "scripts/verify-governance-payload.mjs");
const PSM = "0x3333333333333333333333333333333333333333";
const ADAPTER = "0x2222222222222222222222222222222222222222";
const POLICY = {
  targets: {
    [PSM]: {
      label: "fictional PSM",
      maxValue: "0",
      selectors: {
        "0x2f2ff15d": "grantRole(bytes32,address)",
        "0x99d25455": "setSource(string)",
      },
    },
  },
};
const GRANT = "0x2f2ff15d73e573f9566d61418a34d5de3ff49360f9c51fec37f7486551670290f6285dab0000000000000000000000002222222222222222222222222222222222222222";
const SOURCE = "0x99d254550000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000f424c533a43555552303030305341300000000000000000000000000000000000";

const safeBundle = () => ({ targets: [PSM, PSM], values: ["0", "0"], calldatas: [GRANT, SOURCE], description: "fictional safe handoff" });

test("accepts an exact, zero-value known-target bundle", () => {
  const result = verifyGovernancePayload(safeBundle(), POLICY);
  assert.equal(result.authorized, true);
  assert.deepEqual(result.actions.map((action) => action.decoded), ["grantRole(bytes32,address)", "setSource(string)"]);
});

test("rejects unknown targets while preserving raw calldata", () => {
  const bundle = { targets: [ADAPTER], values: ["0"], calldatas: [GRANT] };
  const result = verifyGovernancePayload(bundle, POLICY);
  assert.equal(result.authorized, false);
  assert.equal(result.actions[0].calldata, GRANT);
  assert.equal(result.actions[0].decoded, null);
  assert.match(result.errors[0], /not present in the explicit policy/);
});

test("rejects malformed, disallowed, and non-zero-value actions", () => {
  const malformed = verifyGovernancePayload({ targets: [PSM], values: ["0"], calldatas: ["0x2f2ff1"] }, POLICY);
  assert.equal(malformed.authorized, false);
  assert.match(malformed.errors.join(" "), /shorter than a 4-byte selector/);

  const disallowed = verifyGovernancePayload({ targets: [PSM], values: ["0"], calldatas: ["0x12345678"] }, POLICY);
  assert.equal(disallowed.authorized, false);
  assert.match(disallowed.errors.join(" "), /not allowed/);

  const value = verifyGovernancePayload({ targets: [PSM], values: ["1"], calldatas: [SOURCE] }, POLICY);
  assert.equal(value.authorized, false);
  assert.match(value.errors.join(" "), /exceeds the policy maximum/);

  const truncatedKnownSelector = verifyGovernancePayload({ targets: [PSM], values: ["0"], calldatas: [GRANT.slice(0, -2)] }, POLICY);
  assert.equal(truncatedKnownSelector.authorized, false);
  assert.match(truncatedKnownSelector.errors.join(" "), /truncated/);

  const addressWordStart = 10 + 64;
  const nonCanonicalAddress = `${GRANT.slice(0, addressWordStart)}01${GRANT.slice(addressWordStart + 2)}`;
  const nonCanonical = verifyGovernancePayload({ targets: [PSM], values: ["0"], calldatas: [nonCanonicalAddress] }, POLICY);
  assert.equal(nonCanonical.authorized, false);
  assert.match(nonCanonical.errors.join(" "), /non-canonical address/);

  const invalidStringOffset = `${SOURCE.slice(0, 10)}${"00".repeat(32)}${SOURCE.slice(74)}`;
  const invalidString = verifyGovernancePayload({ targets: [PSM], values: ["0"], calldatas: [invalidStringOffset] }, POLICY);
  assert.equal(invalidString.authorized, false);
  assert.match(invalidString.errors.join(" "), /invalid string offset/);
});

test("rejects action-array mismatches and unsafe JSON numbers", () => {
  assert.throws(() => verifyGovernancePayload({ targets: [PSM], values: [], calldatas: [] }, POLICY), /identical lengths/);
  const result = verifyGovernancePayload({ targets: [PSM], values: [1], calldatas: [SOURCE] }, POLICY);
  assert.equal(result.authorized, false);
  assert.match(result.errors[0], /decimal string/);
});

test("CLI returns non-zero for an unknown target and JSON diagnostics", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "halal-governance-payload-"));
  try {
    const bundlePath = path.join(directory, "bundle.json");
    const policyPath = path.join(directory, "policy.json");
    writeFileSync(bundlePath, JSON.stringify({ targets: [ADAPTER], values: ["0"], calldatas: [GRANT] }));
    writeFileSync(policyPath, JSON.stringify(POLICY));
    const result = spawnSync(process.execPath, [SCRIPT, "--bundle", bundlePath, "--policy", policyPath], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).authorized, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function nextRandom(state) {
  state.value = (state.value + 0x6d2b79f5) >>> 0;
  let result = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
  result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
  return ((result ^ (result >>> 14)) >>> 0) / 0x1_0000_0000;
}

function randomAddress(state) {
  let value = "0x";
  for (let index = 0; index < 40; index += 1) value += Math.floor(nextRandom(state) * 16).toString(16);
  return value === "0x" + "0".repeat(40) ? ADAPTER : value;
}

test("seeded property coverage never authorizes malformed or unauthorized bundles", () => {
  const state = { value: 0x91_5eed };
  for (let iteration = 0; iteration < 256; iteration += 1) {
    const seed = state.value;
    const cases = [
      { targets: [randomAddress(state)], values: ["0"], calldatas: [GRANT] },
      { targets: [PSM], values: ["0"], calldatas: [`0x${Math.floor(nextRandom(state) * 0x1_0000).toString(16).padStart(4, "0")}`] },
      { targets: [PSM], values: [String(1 + Math.floor(nextRandom(state) * 1_000_000))], calldatas: [SOURCE] },
      { targets: [PSM], values: ["0"], calldatas: ["0xdeadbeef"] },
      { targets: [PSM], values: ["00"], calldatas: [SOURCE] },
    ];
    for (const bundle of cases) {
      const result = verifyGovernancePayload(bundle, POLICY);
      assert.equal(result.authorized, false, `seed ${seed} was unexpectedly authorized: ${JSON.stringify(bundle)}`);
    }
  }
});
