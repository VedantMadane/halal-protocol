"use client";

import { useChainId } from "wagmi";
import { getDeployment, type HalalDeployment } from "@/config/contracts";
import { isSupportedChainId } from "@/config/chains";

export interface DeploymentInfo {
  chainId: number;
  /** True if the connected/selected chain is one of the app's supported chains at all. */
  isSupportedChain: boolean;
  /** The contract addresses for this chain, if Halal has been deployed here. */
  deployment: HalalDeployment | undefined;
  /** Convenience flag: deployment !== undefined. */
  isDeployed: boolean;
}

/**
 * Resolves the current chain's Halal deployment (or the lack of one). Every page should key
 * its "not deployed on this network" empty state off `isDeployed` rather than assuming any
 * particular chain has addresses configured.
 */
export function useDeployment(): DeploymentInfo {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);

  return {
    chainId,
    isSupportedChain: isSupportedChainId(chainId),
    deployment,
    isDeployed: deployment !== undefined,
  };
}
