import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyDeploymentReceipt } from "../verify-deployment-receipt.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const validator = join(root, "scripts/validate-deployment-registry.mjs");

function deployment(overrides = {}) {
  return {
    network: "test",
    release: "test",
    commit: "0".repeat(40),
    deploymentTx: `0x${"1".repeat(64)}`,
    explorerUrl: "https://example.com/tx/0x1",
    sourceVerificationUrl: "https://example.com/address/0x1#code",
    journalUrl: "https://example.com/journal/1",
    token: `0x${"1".repeat(40)}`,
    teamVesting: `0x${"2".repeat(40)}`,
    treasuryVesting: `0x${"3".repeat(40)}`,
    psm: `0x${"4".repeat(40)}`,
    dao: `0x${"5".repeat(40)}`,
    timelock: `0x${"6".repeat(40)}`,
    reserveToken: `0x${"7".repeat(40)}`,
    reserveTokenSymbol: "mDAI",
    deploymentBlock: "1",
    cpiAdapter: `0x${"8".repeat(40)}`,
    cpiSourceId: `0x${"9".repeat(64)}`,
    ...overrides,
  };
}

async function runValidator(entry, chainId = "31337") {
  const directory = await mkdtemp(join(tmpdir(), "halal-registry-"));
  const path = join(directory, "registry.json");
  await writeFile(path, `${JSON.stringify({ [chainId]: entry })}\n`);
  const result = spawnSync(process.execPath, [validator], {
    cwd: root,
    env: { ...process.env, DEPLOYMENT_REGISTRY_PATH: path },
    encoding: "utf8",
  });
  await rm(directory, { recursive: true, force: true });
  return result;
}

test("accepts a complete registry entry with governed CPI adapter metadata", async () => {
  const result = await runValidator(deployment());
  assert.equal(result.status, 0, result.stderr);
});

test("rejects a zero CPI source ID", async () => {
  const result = await runValidator(deployment({ cpiSourceId: `0x${"0".repeat(64)}` }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid cpiSourceId/);
});

test("rejects a chain the frontend does not support", async () => {
  const result = await runValidator(deployment(), "1");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported deployment registry chain ID/);
});

test("requires a deployment journal", async () => {
  const result = await runValidator(deployment({ journalUrl: undefined }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs a journalUrl/);
});

test("accepts a successful mined deployment transaction", () => {
  verifyDeploymentReceipt({
    deploymentTx: `0x${"1".repeat(64)}`,
    deploymentBlock: "100",
    latestBlock: "0x70",
    receipt: { transactionHash: `0x${"1".repeat(64)}`, blockNumber: "0x64", status: "0x1" },
  });
});

test("rejects a failed deployment transaction", () => {
  assert.throws(
    () => verifyDeploymentReceipt({
      deploymentTx: `0x${"1".repeat(64)}`,
      deploymentBlock: "100",
      latestBlock: "112",
      receipt: { transactionHash: `0x${"1".repeat(64)}`, blockNumber: "100", status: "0x0" },
    }),
    /did not succeed/
  );
});

test("rejects deployment evidence above the chain tip", () => {
  assert.throws(
    () => verifyDeploymentReceipt({
      deploymentTx: `0x${"1".repeat(64)}`,
      deploymentBlock: "200",
      latestBlock: "150",
      receipt: { transactionHash: `0x${"1".repeat(64)}`, blockNumber: "200", status: "0x1" },
    }),
    /not yet mined/
  );
});
