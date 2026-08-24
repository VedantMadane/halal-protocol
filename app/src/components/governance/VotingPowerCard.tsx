"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TxStatus } from "@/components/TxStatus";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useDeployment } from "@/hooks/useDeployment";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { useTxState } from "@/hooks/useTxState";
import { halalTokenAbi } from "@/abis";
import { formatTokenGrouped, shortAddress } from "@/lib/format";

export function VotingPowerCard() {
  const { isConnected, address } = useAccount();
  const { deployment } = useDeployment();
  const deploymentIntegrity = useDeploymentIntegrity();
  const power = useVotingPower();
  const delegateTx = useTxState();

  useEffect(() => {
    if (delegateTx.isConfirmed) void power.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegateTx.isConfirmed]);

  if (!isConnected) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-1 py-6 text-center">
          <p className="text-sm font-medium">Connect your wallet to see your voting power</p>
          <p className="text-xs text-muted">You&apos;ll need at least the proposal threshold in delegated votes to propose.</p>
        </CardBody>
      </Card>
    );
  }

  function handleSelfDelegate() {
    if (!deployment || !address) return;
    delegateTx.writeContract({
      address: deployment.token,
      abi: halalTokenAbi,
      functionName: "delegate",
      args: [address],
    });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {power.isError && (
          <Alert tone="danger" title="Voting power could not be loaded">
            Refresh the page or check your selected network before delegating or creating a proposal.
          </Alert>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-6 sm:flex sm:gap-8">
            <div>
              <p className="text-xs text-muted">HLC balance</p>
              <p className="tabular text-lg font-semibold">{formatTokenGrouped(power.balance, 18)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Voting power</p>
              <p className="tabular text-lg font-semibold">{formatTokenGrouped(power.votes, 18)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Delegated to</p>
              <p className="text-sm font-medium">
                {power.hasDelegated ? (power.isSelfDelegated ? "Self" : shortAddress(power.delegate)) : "Not delegated"}
              </p>
            </div>
          </div>

          {!power.isError && deploymentIntegrity.isVerified && !power.isSelfDelegated && (
            <div className="space-y-2">
              <Button size="sm" onClick={handleSelfDelegate} loading={delegateTx.isPending || delegateTx.isConfirming}>
                Self-delegate to activate voting power
              </Button>
              <TxStatus
                {...delegateTx}
                pendingLabel="Confirm delegation in your wallet…"
                successLabel="Delegated — your voting power is now active."
              />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
