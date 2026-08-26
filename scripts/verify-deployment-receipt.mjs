const transactionHashPattern = /^0x[0-9a-fA-F]{64}$/;

function quantity(value, label) {
  if (typeof value !== "string" || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) {
    throw new Error(`${label} must be an RPC quantity.`);
  }
  return BigInt(value);
}

/** Verify the minimum mined-transaction evidence for a deployment manifest. */
export function verifyDeploymentReceipt({ deploymentTx, deploymentBlock, receipt, latestBlock }) {
  if (typeof deploymentTx !== "string" || !transactionHashPattern.test(deploymentTx)) {
    throw new Error("deployment transaction must be a 32-byte transaction hash.");
  }
  if (!receipt || typeof receipt !== "object") throw new Error("deployment transaction receipt is missing.");
  if (typeof receipt.transactionHash !== "string" || receipt.transactionHash.toLowerCase() !== deploymentTx.toLowerCase()) {
    throw new Error("deployment transaction receipt hash does not match --deployment-tx.");
  }
  if (receipt.status !== "0x1" && receipt.status !== "1") {
    throw new Error("deployment transaction did not succeed.");
  }
  const claimedBlock = quantity(deploymentBlock, "DEPLOYMENT_BLOCK");
  const receiptBlock = quantity(receipt.blockNumber, "deployment receipt blockNumber");
  const chainTip = quantity(latestBlock, "latest block");
  if (claimedBlock === 0n) throw new Error("DEPLOYMENT_BLOCK must be positive.");
  if (claimedBlock > receiptBlock) {
    throw new Error("DEPLOYMENT_BLOCK cannot be after the deployment transaction block.");
  }
  if (claimedBlock > chainTip || receiptBlock > chainTip) {
    throw new Error("deployment evidence points to a block that is not yet mined.");
  }
}
