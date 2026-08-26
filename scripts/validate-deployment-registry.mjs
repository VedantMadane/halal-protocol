import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const registryPath = process.env.DEPLOYMENT_REGISTRY_PATH
  ? resolve(process.env.DEPLOYMENT_REGISTRY_PATH)
  : fileURLToPath(new URL("../app/src/config/deployment-registry.json", import.meta.url));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const requiredAddresses = ["token", "teamVesting", "treasuryVesting", "psm", "dao", "timelock", "reserveToken"];
const supportedChainIds = new Set(["31337", "421614", "42161"]);

if (!registry || Array.isArray(registry) || typeof registry !== "object") {
  throw new Error("Deployment registry must contain a JSON object keyed by chain ID.");
}

for (const [chainId, deployment] of Object.entries(registry)) {
  if (!/^\d+$/.test(chainId) || Number(chainId) <= 0) {
    throw new Error(`Invalid deployment registry chain ID: ${chainId}`);
  }
  if (!supportedChainIds.has(chainId)) {
    throw new Error(`Unsupported deployment registry chain ID: ${chainId}. Add the chain to the frontend before registering it.`);
  }
  if (!deployment || typeof deployment !== "object" || Array.isArray(deployment)) {
    throw new Error(`Deployment ${chainId} must be a JSON object.`);
  }

  for (const field of requiredAddresses) {
    const value = deployment[field];
    if (typeof value !== "string" || !addressPattern.test(value) || /^0x0{40}$/i.test(value)) {
      throw new Error(`Deployment ${chainId} has an invalid ${field} address.`);
    }
  }

  const hasAdapter = deployment.cpiAdapter !== undefined || deployment.cpiSourceId !== undefined || deployment.cpiPolicyUrl !== undefined;
  if (hasAdapter) {
    if (typeof deployment.cpiAdapter !== "string" || !addressPattern.test(deployment.cpiAdapter) || /^0x0{40}$/i.test(deployment.cpiAdapter)) {
      throw new Error(`Deployment ${chainId} has an invalid cpiAdapter address.`);
    }
    if (
      typeof deployment.cpiSourceId !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(deployment.cpiSourceId) ||
      /^0x0{64}$/i.test(deployment.cpiSourceId)
    ) {
      throw new Error(`Deployment ${chainId} has an invalid cpiSourceId.`);
    }
    try {
      if (typeof deployment.cpiPolicyUrl !== "string" || new URL(deployment.cpiPolicyUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new Error(`Deployment ${chainId} has an invalid cpiPolicyUrl.`);
    }
  }

  if (typeof deployment.reserveTokenSymbol !== "string" || deployment.reserveTokenSymbol.trim() === "") {
    throw new Error(`Deployment ${chainId} needs a reserveTokenSymbol.`);
  }

  const deploymentBlock = deployment.deploymentBlock;
  if (typeof deploymentBlock !== "string" || !/^\d+$/.test(deploymentBlock) || BigInt(deploymentBlock) === 0n) {
    throw new Error(`Deployment ${chainId} needs a positive deploymentBlock.`);
  }

  for (const optional of ["network", "release", "commit"]) {
    if (deployment[optional] !== undefined && typeof deployment[optional] !== "string") {
      throw new Error(`Deployment ${chainId} has a non-string ${optional} field.`);
    }
  }

  if (typeof deployment.deploymentTx !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(deployment.deploymentTx)) {
    throw new Error(`Deployment ${chainId} needs a deploymentTx hash.`);
  }
  for (const link of ["explorerUrl", "sourceVerificationUrl", "journalUrl"]) {
    if (deployment[link] === undefined) throw new Error(`Deployment ${chainId} needs a ${link}.`);
    try {
      const parsed = new URL(deployment[link]);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      throw new Error(`Deployment ${chainId} has an invalid ${link}.`);
    }
  }
}

console.log(`Deployment registry valid: ${Object.keys(registry).length} deployment(s)`);
