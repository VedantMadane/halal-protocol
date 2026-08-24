"use client";

import { useEffect, useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { VestingProgress } from "./VestingProgress";
import type { VestingSchedule } from "@/hooks/useVesting";
import { useVestingRelease } from "@/hooks/useVestingRelease";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { useTxState } from "@/hooks/useTxState";
import { halalVestingAbi } from "@/abis";
import { formatDate, formatDurationSeconds, shortAddress } from "@/lib/format";

export function VestingScheduleCard({
  label,
  vestingAddress,
  schedule,
  isLoading,
  isError,
  canRelease,
  onReleased,
}: {
  label: string;
  vestingAddress: Address | undefined;
  schedule: VestingSchedule | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Show the Release button — only when the connected wallet is this schedule's beneficiary. */
  canRelease: boolean;
  onReleased?: () => void;
}) {
  const releaseTx = useVestingRelease(vestingAddress);
  const deploymentIntegrity = useDeploymentIntegrity();
  const beneficiaryTx = useTxState();
  const acceptTx = useTxState();
  const { address: connectedAddress } = useAccount();
  const [newBeneficiary, setNewBeneficiary] = useState("");

  const isBeneficiary =
    !!connectedAddress && !!schedule && schedule.beneficiary.toLowerCase() === connectedAddress.toLowerCase();
  const isPendingBeneficiary =
    !!connectedAddress &&
    !!schedule &&
    schedule.pendingBeneficiary.toLowerCase() === connectedAddress.toLowerCase();

  useEffect(() => {
    if (releaseTx.isConfirmed || beneficiaryTx.isConfirmed || acceptTx.isConfirmed) onReleased?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseTx.isConfirmed, beneficiaryTx.isConfirmed, acceptTx.isConfirmed]);

  function proposeBeneficiary() {
    if (!vestingAddress || !isAddress(newBeneficiary) || newBeneficiary.toLowerCase() === zeroAddress) return;
    beneficiaryTx.writeContract({
      address: vestingAddress,
      abi: halalVestingAbi,
      functionName: "proposeBeneficiary",
      args: [newBeneficiary],
    });
  }

  function acceptBeneficiary() {
    if (!vestingAddress) return;
    acceptTx.writeContract({
      address: vestingAddress,
      abi: halalVestingAbi,
      functionName: "acceptBeneficiary",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} Vesting</CardTitle>
        <div className="flex gap-2">
          {schedule?.revoked && <Badge tone="danger">Revoked</Badge>}
          {!schedule?.revoked && schedule?.revocable && <Badge tone="accent">Revocable by DAO</Badge>}
          {!schedule?.revoked && !schedule?.revocable && <Badge tone="primary">Not revocable</Badge>}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {isError ? (
          <Alert tone="danger" title="Couldn&apos;t load vesting schedule">
            Refresh the page or check the selected network.
          </Alert>
        ) : isLoading || !schedule ? (
          <>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          <>
            <VestingProgress schedule={schedule} />

            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted">Beneficiary</dt>
                <dd className="font-medium" title={schedule.beneficiary}>
                  {shortAddress(schedule.beneficiary)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Start</dt>
                <dd className="font-medium">{formatDate(schedule.start)}</dd>
              </div>
              <div>
                <dt className="text-muted">Cliff</dt>
                <dd className="font-medium">
                  {schedule.cliff > 0n ? formatDurationSeconds(schedule.cliff) : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Duration</dt>
                <dd className="font-medium">{formatDurationSeconds(schedule.duration)}</dd>
              </div>
            </dl>

            {schedule.pendingBeneficiary.toLowerCase() !== zeroAddress && (
              <p className="text-xs text-muted">
                Pending beneficiary: <span className="font-medium">{shortAddress(schedule.pendingBeneficiary)}</span>
              </p>
            )}

            {!deploymentIntegrity.isVerified && (
              <Alert tone="danger" title="Deployment configuration could not be verified">
                Refresh the page before signing a vesting transaction.
              </Alert>
            )}

            {isBeneficiary && deploymentIntegrity.isVerified && (
              <div className="space-y-3 border-t border-card-border pt-4">
                <p className="text-xs text-muted">
                  Propose a new beneficiary address. The new address must accept before future releases are redirected.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    inputMode="text"
                    placeholder="New beneficiary address (0x…)"
                    value={newBeneficiary}
                    onChange={(event) => setNewBeneficiary(event.target.value.trim())}
                    className="min-w-0 flex-1 rounded-xl border border-card-border bg-background-subtle px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button
                    size="sm"
                    onClick={proposeBeneficiary}
                    disabled={!isAddress(newBeneficiary) || newBeneficiary.toLowerCase() === zeroAddress}
                    loading={beneficiaryTx.isPending || beneficiaryTx.isConfirming}
                  >
                    Propose
                  </Button>
                </div>
                <TxStatus
                  {...beneficiaryTx}
                  pendingLabel="Confirm beneficiary proposal in your wallet…"
                  successLabel="Beneficiary proposed. The new address must accept the transfer."
                />
              </div>
            )}

            {isPendingBeneficiary && deploymentIntegrity.isVerified && (
              <div className="space-y-3 border-t border-card-border pt-4">
                <p className="text-xs text-muted">This address is the pending beneficiary. Accept to complete the transfer.</p>
                <Button
                  size="sm"
                  onClick={acceptBeneficiary}
                  loading={acceptTx.isPending || acceptTx.isConfirming}
                >
                  Accept beneficiary transfer
                </Button>
                <TxStatus
                  {...acceptTx}
                  pendingLabel="Confirm beneficiary acceptance in your wallet…"
                  successLabel="Beneficiary transfer accepted."
                />
              </div>
            )}

            {canRelease && deploymentIntegrity.isVerified && (
              <div className="space-y-3 border-t border-card-border pt-4">
                <Button
                  onClick={releaseTx.release}
                  disabled={schedule.releasable === 0n}
                  loading={releaseTx.isPending || releaseTx.isConfirming}
                >
                  {schedule.releasable === 0n ? "Nothing to release yet" : "Release vested tokens"}
                </Button>
                <TxStatus
                  {...releaseTx}
                  pendingLabel="Confirm release in your wallet…"
                  successLabel="Vested tokens released to the beneficiary."
                />
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
