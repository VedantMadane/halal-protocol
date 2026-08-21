import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { VestingProgress } from "@/components/vesting/VestingProgress";
import type { VestingSchedule } from "@/hooks/useVesting";
import { formatDate, formatDurationSeconds } from "@/lib/format";

export function VestingSummaryCard({
  label,
  schedule,
  isLoading,
}: {
  label: string;
  schedule: VestingSchedule | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} Vesting</CardTitle>
        {schedule?.revoked && <Badge tone="danger">Revoked</Badge>}
        {!schedule?.revoked && schedule?.revocable && <Badge tone="accent">Revocable</Badge>}
      </CardHeader>
      <CardBody className="space-y-3">
        {isLoading || !schedule ? (
          <>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            <VestingProgress schedule={schedule} />
            <p className="text-xs text-muted-foreground">
              Started {formatDate(schedule.start)} · {formatDurationSeconds(schedule.duration)} duration
              {schedule.cliff > 0n && <> · {formatDurationSeconds(schedule.cliff)} cliff</>}
            </p>
            <Link href="/vesting" className="text-xs font-medium text-primary hover:underline">
              View schedule →
            </Link>
          </>
        )}
      </CardBody>
    </Card>
  );
}
