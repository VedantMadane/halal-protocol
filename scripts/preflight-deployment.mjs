import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const defaultRegistryPath = fileURLToPath(new URL("../app/src/config/deployment-registry.json", import.meta.url));
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const supportedChainIds = new Set(["31337", "421614", "42161"]);
const requiredAddresses = ["token", "teamVesting", "treasuryVesting", "psm", "dao", "timelock", "reserveToken"];

function usage() {
  console.log(`Usage: node scripts/preflight-deployment.mjs [options]

Read-only offline readiness report. It does not use an RPC, sign, broadcast, or modify files.

Options:
  --registry <path>       Registry JSON path (defaults to the checked-in registry)
  --chain-id <id>         Require this supported chain to have a deployment entry
  --json                  Emit a versioned JSON report instead of human-readable rows
  --help                  Show this help
`);
}

function parseArgs(args) {
  const options = { registry: defaultRegistryPath, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") {
      usage();
      return null;
    }
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (!["--registry", "--chain-id"].includes(argument) || index + 1 >= args.length || args[index + 1].startsWith("--")) {
      throw new Error(`Invalid argument: ${argument}`);
    }
    const value = args[++index];
    if (argument === "--registry") options.registry = resolve(value);
    if (argument === "--chain-id") options.chainId = value;
  }
  if (options.chainId !== undefined && (!/^\d+$/.test(options.chainId) || BigInt(options.chainId) === 0n)) {
    throw new Error("--chain-id must be a positive decimal chain ID.");
  }
  return options;
}

function check(report, label, ok, detail) {
  report.checks.push({ label, status: ok ? "pass" : "fail", detail });
  if (!ok) report.status = "not_ready";
}

function nonZeroAddress(value) {
  return typeof value === "string" && addressPattern.test(value) && !/^0x0{40}$/i.test(value);
}

function validateEntry(report, chainId, deployment) {
  const prefix = `chain ${chainId}`;
  const object = deployment && typeof deployment === "object" && !Array.isArray(deployment);
  check(report, `${prefix}: deployment object`, object, object ? "present" : "missing or not an object");
  if (!object) return;

  check(report, `${prefix}: supported chain`, supportedChainIds.has(chainId), supportedChainIds.has(chainId) ? "frontend supports this chain" : "add frontend support before registering it");
  for (const field of requiredAddresses) {
    const valid = nonZeroAddress(deployment[field]);
    check(report, `${prefix}: ${field}`, valid, valid ? "non-zero address" : "missing or invalid non-zero address");
  }
  const adapterFieldsPresent = deployment.cpiAdapter !== undefined || deployment.cpiSourceId !== undefined;
  if (adapterFieldsPresent) {
    const adapterValid = nonZeroAddress(deployment.cpiAdapter);
    const sourceIdValid = typeof deployment.cpiSourceId === "string" && hashPattern.test(deployment.cpiSourceId) && !/^0x0{64}$/i.test(deployment.cpiSourceId);
    check(report, `${prefix}: CPI adapter pair`, adapterValid && sourceIdValid, adapterValid && sourceIdValid ? "adapter and source ID are present" : "provide both valid, non-zero adapter and source ID values");
  }
  const symbolValid = typeof deployment.reserveTokenSymbol === "string" && deployment.reserveTokenSymbol.trim() !== "";
  check(report, `${prefix}: reserve token symbol`, symbolValid, symbolValid ? "present" : "missing or blank");
  const blockValid = typeof deployment.deploymentBlock === "string" && /^\d+$/.test(deployment.deploymentBlock) && BigInt(deployment.deploymentBlock) > 0n;
  check(report, `${prefix}: deployment block`, blockValid, blockValid ? "positive block recorded" : "missing or invalid positive block");
  const txValid = typeof deployment.deploymentTx === "string" && hashPattern.test(deployment.deploymentTx);
  check(report, `${prefix}: deployment transaction`, txValid, txValid ? "transaction hash recorded" : "missing or invalid transaction hash");
  for (const field of ["explorerUrl", "sourceVerificationUrl", "journalUrl"]) {
    let valid = false;
    try {
      valid = typeof deployment[field] === "string" && new URL(deployment[field]).protocol === "https:";
    } catch {
      valid = false;
    }
    check(report, `${prefix}: ${field}`, valid, valid ? "HTTPS evidence link" : "missing or non-HTTPS evidence link");
  }
}

export function preflightDeploymentRegistry(registry, { chainId } = {}) {
  const report = { schemaVersion: 1, status: "ready", checks: [] };
  const object = registry && typeof registry === "object" && !Array.isArray(registry);
  check(report, "registry object", object, object ? "JSON object" : "registry must be a JSON object keyed by chain ID");
  if (!object) return report;

  const chainIds = Object.keys(registry);
  check(report, "registered deployment", chainIds.length > 0, chainIds.length > 0 ? `${chainIds.length} deployment(s) found` : "registry is empty; publish reviewed deployment evidence before launch");
  if (chainId !== undefined) {
    check(report, `requested chain ${chainId}`, Object.hasOwn(registry, chainId), Object.hasOwn(registry, chainId) ? "deployment entry found" : "no deployment entry for requested chain");
  }
  for (const [registeredChainId, deployment] of Object.entries(registry)) validateEntry(report, registeredChainId, deployment);
  return report;
}

function printHuman(report, registryPath) {
  console.log(`Deployment preflight (offline): ${registryPath}`);
  for (const checkResult of report.checks) {
    console.log(`[${checkResult.status.toUpperCase()}] ${checkResult.label}: ${checkResult.detail}`);
  }
  console.log(`status=${report.status}`);
  if (report.status !== "ready") console.log("next_action=resolve every failed check before deployment or role grants");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options === null) return;
  try {
    const registry = JSON.parse(await readFile(options.registry, "utf8"));
    const report = preflightDeploymentRegistry(registry, options);
    if (options.json) console.log(JSON.stringify({ ...report, registryPath: options.registry }, null, 2));
    else printHuman(report, options.registry);
    process.exitCode = report.status === "ready" ? 0 : 1;
  } catch (error) {
    const report = {
      schemaVersion: 1,
      status: "not_ready",
      checks: [{ label: "registry readable JSON", status: "fail", detail: error.message }],
      nextAction: "provide a readable registry containing valid JSON",
      registryPath: options.registry,
    };
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.error(`Deployment preflight (offline): ${options.registry}`);
      console.error(`[FAIL] ${report.checks[0].label}: ${report.checks[0].detail}`);
      console.error("status=not_ready");
      console.error(`next_action=${report.nextAction}`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
