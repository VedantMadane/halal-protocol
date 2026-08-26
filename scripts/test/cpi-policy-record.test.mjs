import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { validateCpiPolicy } from "../validate-cpi-policy.mjs";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/validate-cpi-policy.mjs");
const FIXTURES = path.join(ROOT, "scripts/test/fixtures");

async function fixture(name) { return JSON.parse(await readFile(path.join(FIXTURES, name), "utf8")); }

test("accepts an explicit draft without calling it reviewable", async () => {
  const report = validateCpiPolicy(await fixture("cpi-policy-draft.json"));
  assert.equal(report.status, "draft");
  assert.ok(report.pending.length > 10);
  assert.deepEqual(report.errors, []);
});

test("accepts a complete reviewed record as reviewable evidence", async () => {
  const report = validateCpiPolicy(await fixture("cpi-policy-reviewed.json"));
  assert.equal(report.status, "reviewable");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.pending, []);
});

test("rejects reviewed placeholders, invalid hashes, and unsafe links", async () => {
  const invalid = await fixture("cpi-policy-reviewed.json");
  invalid.source.policyOwner = "PENDING — assign an owner";
  invalid.retrieval.rawResponseSha256 = "not-a-hash";
  invalid.review.evidenceLinks = ["http://unsafe.example/review"];
  const report = validateCpiPolicy(invalid);
  assert.equal(report.status, "invalid");
  assert.match(report.errors.join("\n"), /policyOwner.*pending/);
  assert.match(report.errors.join("\n"), /rawResponseSha256/);
  assert.match(report.errors.join("\n"), /evidenceLinks/);
});

test("rejects zero-value evidence placeholders", async () => {
  const invalid = await fixture("cpi-policy-reviewed.json");
  invalid.retrieval.parserCommit = "0".repeat(40);
  invalid.retrieval.rawResponseSha256 = "0".repeat(64);
  const report = validateCpiPolicy(invalid);
  assert.equal(report.status, "invalid");
  assert.match(report.errors.join("\n"), /parserCommit/);
  assert.match(report.errors.join("\n"), /rawResponseSha256/);
});

test("rejects contradictory signer quorum and rejected status", async () => {
  const invalid = await fixture("cpi-policy-reviewed.json");
  invalid.status = "rejected";
  invalid.authorization.threshold = 3;
  invalid.authorization.signerAddresses[1] = invalid.authorization.signerAddresses[0];
  const report = validateCpiPolicy(invalid);
  assert.equal(report.status, "invalid");
  assert.match(report.errors.join("\n"), /threshold/);
  assert.match(report.errors.join("\n"), /duplicates/);
  assert.match(report.errors.join("\n"), /rejected policies/);
});

test("CLI emits versioned JSON and a nonzero status for invalid input", async () => {
  const invalid = await fixture("cpi-policy-reviewed.json");
  invalid.source = {};
  const directory = await mkdtemp(path.join(tmpdir(), "halal-cpi-policy-"));
  const input = path.join(directory, "invalid.json");
  await writeFile(input, JSON.stringify(invalid));
  const result = spawnSync(process.execPath, [SCRIPT, "--input", input, "--json"], { encoding: "utf8" });
  await rm(directory, { recursive: true, force: true });
  assert.notEqual(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "invalid");
  assert.equal(report.schemaVersion, 1);
  assert.ok(report.errors.length > 0);
});
