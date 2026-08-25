import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const registryPath = fileURLToPath(new URL("../app/src/config/deployment-registry.json", import.meta.url));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const requiredAddresses = ["token", "teamVesting", "treasuryVesting", "psm", "dao", "timelock", "reserveToken"];

if (!registry || Array.isArray(registry) || typeof registry !== "object") {
  throw new Error("Deployment registry must contain a JSON object keyed by chain ID.");
}

for (const [chainId, deployment] of Object.entries(registry)) {
  if (!/^\d+$/.test(chainId) || Number(chainId) <= 0) {
    throw new Error(`Invalid deployment registry chain ID: ${chainId}`);
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

  if (typeof deployment.reserveTokenSymbol !== "string" || deployment.reserveTokenSymbol.trim() === "") {
    throw new Error(`Deployment ${chainId} needs a reserveTokenSymbol.`);
  }

  const deploymentBlock = String(deployment.deploymentBlock ?? "");
  if (!/^\d+$/.test(deploymentBlock) || BigInt(deploymentBlock) === 0n) {
    throw new Error(`Deployment ${chainId} needs a positive deploymentBlock.`);
  }

  for (const optional of ["network", "release", "commit"]) {
    if (deployment[optional] !== undefined && typeof deployment[optional] !== "string") {
      throw new Error(`Deployment ${chainId} has a non-string ${optional} field.`);
    }
  }
}

console.log(`Deployment registry valid: ${Object.keys(registry).length} deployment(s)`);
