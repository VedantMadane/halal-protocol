import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatTokenGrouped } from "@/lib/format";
import type { VestingSchedule } from "@/hooks/useVesting";

export function VestingProgress({ schedule }: { schedule: VestingSchedule }) {
  const ratio = schedule.totalAllocation > 0n ? Number(schedule.vested) / Number(schedule.totalAllocation) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted">Vested of total allocation</span>
        <span className="tabular text-xs font-medium">
          {formatTokenGrouped(schedule.vested, 18)} / {formatTokenGrouped(schedule.totalAllocation, 18)} HLC
        </span>
      </div>
      <ProgressBar ratio={ratio} tone={schedule.revoked ? "danger" : "primary"} />
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Released" value={`${formatTokenGrouped(schedule.released, 18)} HLC`} />
        <Stat label="Releasable now" value={`${formatTokenGrouped(schedule.releasable, 18)} HLC`} />
        <Stat
          label="Remaining"
          value={`${formatTokenGrouped(schedule.totalAllocation - schedule.vested, 18)} HLC`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background-subtle px-2.5 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="tabular font-medium text-foreground">{value}</p>
    </div>
  );
}
