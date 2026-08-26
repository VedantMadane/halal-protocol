"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { EmptyState } from "./ui/EmptyState";
import { Button } from "./ui/Button";
import { arbitrumSepolia, getChainName, supportedChains } from "@/config/chains";
import { useDeployment } from "@/hooks/useDeployment";
import { getFriendlyErrorMessage } from "@/lib/errors";

/**
 * Shared empty state for "Halal has no contracts configured on the connected/selected chain."
 * Every page checks `useDeployment().isDeployed` and renders this instead of attempting reads
 * against `undefined` addresses.
 */
export function NotDeployedState() {
  const { isConnected } = useAccount();
  const { chainId, isSupportedChain } = useDeployment();
  const switchChain = useSwitchChain();

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
        action={
          <div className="flex flex-col items-center gap-2">
            <Button
              size="sm"
              loading={switchChain.isPending}
              onClick={() => switchChain.switchChain({ chainId: arbitrumSepolia.id })}
            >
              Switch to Arbitrum Sepolia
            </Button>
            {switchChain.isError && (
              <p className="max-w-md text-xs text-danger">
                {getFriendlyErrorMessage(switchChain.error, "networkSwitch")}
              </p>
            )}
          </div>
        }
      />
    );
  }

  if (!isConnected) {
    return (
      <EmptyState
        title="No public deployment configured"
        description={
          <>
            The dApp can show a configured deployment without a wallet. Set the read-only chain and deployment
            variables in <code>.env.local</code>, or connect a wallet to inspect another supported network. Supported
            networks: {supportedChains.map((c) => c.name).join(", ")}.
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
          Halal has no contracts configured for {getChainName(chainId)} yet. Connect to a supported network or check
          the project&apos;s deployment configuration for chain id {chainId}.
        </>
      }
    />
  );
}
