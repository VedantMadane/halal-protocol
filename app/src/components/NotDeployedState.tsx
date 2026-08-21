"use client";

import { useAccount } from "wagmi";
import { EmptyState } from "./ui/EmptyState";
import { getChainName, supportedChains } from "@/config/chains";
import { useDeployment } from "@/hooks/useDeployment";

/**
 * Shared empty state for "Halal has no contracts configured on the connected/selected chain."
 * Every page checks `useDeployment().isDeployed` and renders this instead of attempting reads
 * against `undefined` addresses.
 */
export function NotDeployedState() {
  const { isConnected } = useAccount();
  const { chainId, isSupportedChain } = useDeployment();

  if (!isConnected) {
    return (
      <EmptyState
        title="Not deployed on this network"
        description={
          <>
            Halal isn&apos;t deployed anywhere yet — addresses are filled in per network in{" "}
            <code className="rounded bg-background-subtle px-1 py-0.5 text-xs">
              src/config/contracts.ts
            </code>{" "}
            once a real deployment exists. Supported networks: {supportedChains.map((c) => c.name).join(", ")}.
          </>
        }
      />
    );
  }

  if (!isSupportedChain) {
    return (
      <EmptyState
        title="Unsupported network"
        description={
          <>
            Your wallet is connected to a network Halal doesn&apos;t support. Switch to one of:{" "}
            {supportedChains.map((c) => c.name).join(", ")}.
          </>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Not deployed on this network"
      description={
        <>
          Halal has no contracts configured for {getChainName(chainId)} yet. Fill in addresses for chain id{" "}
          {chainId} in <code className="rounded bg-background-subtle px-1 py-0.5 text-xs">src/config/contracts.ts</code>{" "}
          once a real deployment exists.
        </>
      }
    />
  );
}
