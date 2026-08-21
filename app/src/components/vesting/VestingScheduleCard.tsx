"use client";

import { useEffect } from "react";
import type { Address } from "viem";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { VestingProgress } from "./VestingProgress";
import type { VestingSchedule } from "@/hooks/useVesting";
import { useVestingRelease } from "@/hooks/useVestingRelease";
import { formatDate, formatDurationSeconds, shortAddress } from "@/lib/format";

export function VestingScheduleCard({
  label,
  vestingAddress,
  schedule,
  isLoading,
  canRelease,
  onReleased,
}: {
  label: string;
  vestingAddress: Address | undefined;
  schedule: VestingSchedule | undefined;
  isLoading: boolean;
  /** Show the Release button — only when the connected wallet is this schedule's beneficiary. */
  canRelease: boolean;
  onReleased?: () => void;
}) {
  const releaseTx = useVestingRelease(vestingAddress);

  useEffect(() => {
    if (releaseTx.isConfirmed) onReleased?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseTx.isConfirmed]);

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
        {isLoading || !schedule ? (
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

            {canRelease && (
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
