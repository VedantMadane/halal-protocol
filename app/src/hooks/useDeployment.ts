"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { getDeployment, getReadOnlyChainId, type HalalDeployment } from "@/config/contracts";
import { isSupportedChainId } from "@/config/chains";

interface Eip1193Provider {
  request(args: { method: string }): Promise<unknown>;
  on?: (event: string, listener: (value: unknown) => void) => void;
  removeListener?: (event: string, listener: (value: unknown) => void) => void;
}

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
  const { isConnected } = useAccount();
  const connectedChainId = useChainId();
  const [injectedChainId, setInjectedChainId] = useState<number | undefined>();

  useEffect(() => {
    if (isConnected || typeof window === "undefined") return;
    const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!provider) return;

    let active = true;
    const updateChainId = (value: unknown) => {
      if (typeof value !== "string" || !value.startsWith("0x")) return;
      const parsed = Number.parseInt(value.slice(2), 16);
      if (active && Number.isSafeInteger(parsed)) setInjectedChainId(parsed);
    };
    const readChainId = async () => {
      try {
        updateChainId(await provider.request({ method: "eth_chainId" }));
      } catch {
        // A provider that cannot report its chain must not replace the configured read-only path.
      }
    };

    void readChainId();
    provider.on?.("chainChanged", updateChainId);
    return () => {
      active = false;
      provider.removeListener?.("chainChanged", updateChainId);
    };
  }, [isConnected]);

  const chainId = isConnected ? connectedChainId : injectedChainId ?? getReadOnlyChainId();
  const deployment = getDeployment(chainId);

  return {
    chainId,
    isSupportedChain: isSupportedChainId(chainId),
    deployment,
    isDeployed: deployment !== undefined,
  };
}
