import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDeploymentReceipt } from "./verify-deployment-receipt.mjs";

const registryPath = fileURLToPath(new URL("../app/src/config/deployment-registry.json", import.meta.url));
const verifierPath = fileURLToPath(new URL("./verify-deployment.sh", import.meta.url));
const addressFields = ["TOKEN", "TEAM_VESTING", "TREASURY_VESTING", "DAO", "PSM", "TIMELOCK", "RESERVE_TOKEN"];
const registryAddressFields = {
  TOKEN: "token",
  TEAM_VESTING: "teamVesting",
  TREASURY_VESTING: "treasuryVesting",
  DAO: "dao",
  PSM: "psm",
  TIMELOCK: "timelock",
  RESERVE_TOKEN: "reserveToken",
};
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

function usage() {
  console.log(`Usage: node scripts/record-deployment-manifest.mjs --chain-id <id> [options]

Required environment:
  RPC_URL EXPECTED_CHAIN_ID TOKEN TEAM_VESTING TREASURY_VESTING DAO PSM TIMELOCK
  RESERVE_TOKEN RESERVE_SYMBOL DEPLOYMENT_BLOCK TEAM_BENEFICIARY
  TREASURY_BENEFICIARY DEPLOYER_ADDRESS
Optional adapter environment (provide all four when using the governed CPI adapter):
  CPI_ADAPTER EXPECTED_CPI_SOURCE EXPECTED_CPI_SOURCE_ID CPI_POLICY_URL

Options:
  --network <name>     Human-readable network name
  --release <tag>      Release tag containing the deployment
  --commit <sha>       Commit containing the deployment
  --deployment-tx <h>  Deployment transaction hash
  --explorer-url <url> Explorer page for the deployment
  --source-url <url>   Explorer source-verification page
  --journal-url <url>  Public deployment journal or evidence page
  --output <path>      Registry path (defaults to the checked-in registry)
  --help               Show this help
`);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") {
      usage();
      process.exit(0);
    }
    if (!argument.startsWith("--") || index + 1 >= args.length || args[index + 1].startsWith("--")) {
      throw new Error(`Invalid argument: ${argument}`);
    }
    const name = argument.slice(2);
    if (!["chain-id", "network", "release", "commit", "deployment-tx", "explorer-url", "source-url", "journal-url", "output"].includes(name)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    options[name] = args[index + 1];
    index += 1;
  }
  if (!options["chain-id"] || !/^\d+$/.test(options["chain-id"]) || BigInt(options["chain-id"]) === 0n) {
    throw new Error("--chain-id must be a positive decimal chain ID.");
  }
  return options;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const options = parseArgs(process.argv.slice(2));
const chainId = options["chain-id"];
const expectedChainId = requiredEnvironment("EXPECTED_CHAIN_ID");
if (expectedChainId !== chainId) {
  throw new Error(`--chain-id (${chainId}) must match EXPECTED_CHAIN_ID (${expectedChainId}).`);
}

const addresses = {};
for (const environmentName of addressFields) {
  const value = requiredEnvironment(environmentName);
  if (!addressPattern.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${environmentName} must be a non-zero Ethereum address.`);
  }
  addresses[registryAddressFields[environmentName]] = value.toLowerCase();
}

const reserveTokenSymbol = requiredEnvironment("RESERVE_SYMBOL");
const deploymentBlock = requiredEnvironment("DEPLOYMENT_BLOCK");
if (!/^\d+$/.test(deploymentBlock) || BigInt(deploymentBlock) === 0n) {
  throw new Error("DEPLOYMENT_BLOCK must be a positive decimal string.");
}

const cpiAdapter = process.env.CPI_ADAPTER?.trim();
const cpiSource = process.env.EXPECTED_CPI_SOURCE?.trim();
const cpiSourceId = process.env.EXPECTED_CPI_SOURCE_ID?.trim();
const cpiPolicyUrl = process.env.CPI_POLICY_URL?.trim();
if (cpiAdapter !== undefined || cpiSource !== undefined || cpiSourceId !== undefined || cpiPolicyUrl !== undefined) {
  if (!cpiAdapter || !addressPattern.test(cpiAdapter) || /^0x0{40}$/i.test(cpiAdapter)) {
    throw new Error("CPI_ADAPTER must be a non-zero Ethereum address when adapter metadata is provided.");
  }
  if (!cpiSource || !cpiSource.trim()) throw new Error("EXPECTED_CPI_SOURCE must be a non-empty source label when adapter metadata is provided.");
  if (!cpiSourceId || !/^0x[0-9a-fA-F]{64}$/.test(cpiSourceId) || /^0x0{64}$/i.test(cpiSourceId)) {
    throw new Error("EXPECTED_CPI_SOURCE_ID must be a non-zero bytes32 value when adapter metadata is provided.");
  }
  if (!cpiPolicyUrl) throw new Error("CPI_POLICY_URL must be provided when adapter metadata is provided.");
  try {
    if (new URL(cpiPolicyUrl).protocol !== "https:") throw new Error();
  } catch {
    throw new Error("CPI_POLICY_URL must be an HTTPS URL when adapter metadata is provided.");
  }
}

const deploymentTx = options["deployment-tx"];
if (!deploymentTx || !/^0x[0-9a-fA-F]{64}$/.test(deploymentTx)) {
  throw new Error("--deployment-tx must be a 32-byte transaction hash.");
}

function requiredHttpsUrl(optionName) {
  const value = options[optionName];
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`--${optionName} must be an HTTPS URL.`);
  }
  return value;
}

const explorerUrl = requiredHttpsUrl("explorer-url");
const sourceVerificationUrl = requiredHttpsUrl("source-url");
const journalUrl = requiredHttpsUrl("journal-url");

console.log(`Verifying deployment on chain ${chainId} before updating the registry...`);
try {
  const receipt = JSON.parse(
    execFileSync("cast", ["receipt", deploymentTx, "--rpc-url", process.env.RPC_URL, "--json"], { encoding: "utf8" })
  );
  const latestBlock = execFileSync(
    "cast",
    ["block", "latest", "--field", "number", "--rpc-url", process.env.RPC_URL],
    { encoding: "utf8" }
  )
    .trim()
    .split(/\s+/)[0];
  verifyDeploymentReceipt({ deploymentTx, deploymentBlock, receipt, latestBlock });
} catch (error) {
  throw new Error(`Deployment transaction evidence could not be verified: ${error.message}`);
}
execFileSync("bash", [verifierPath], { env: process.env, stdio: "inherit" });

const registryFile = options.output ? resolve(options.output) : registryPath;
const registry = JSON.parse(await readFile(registryFile, "utf8"));
if (!registry || Array.isArray(registry) || typeof registry !== "object") {
  throw new Error("Deployment registry must contain a JSON object keyed by chain ID.");
}

const metadata = {};
for (const field of ["network", "release", "commit"]) {
  if (options[field]) metadata[field] = options[field];
}
registry[chainId] = {
  ...metadata,
  deploymentTx,
  explorerUrl,
  sourceVerificationUrl,
  journalUrl,
  ...addresses,
  reserveTokenSymbol,
  deploymentBlock,
  ...(cpiAdapter ? { cpiAdapter: cpiAdapter.toLowerCase(), cpiSource, cpiSourceId: cpiSourceId.toLowerCase(), cpiPolicyUrl } : {}),
};

await writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Recorded verified deployment ${chainId} in ${registryFile}`);
