"use client";

import { useAccount } from "wagmi";
import { useDeployment } from "@/hooks/useDeployment";
import { getChainName } from "@/config/chains";

export function NetworkBadge() {
  const { isConnected } = useAccount();
  const { chainId, isSupportedChain, isDeployed } = useDeployment();

  if (!isConnected) return null;

  const name = getChainName(chainId);

  if (!isSupportedChain) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        Unsupported network
      </span>
    );
  }

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
        isDeployed ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent"
      }`}
      title={isDeployed ? `Halal is live on ${name}` : `Halal is not deployed on ${name} yet`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isDeployed ? "bg-primary" : "bg-accent"}`} />
      {name}
      {!isDeployed && " · not deployed"}
    </span>
  );
}
