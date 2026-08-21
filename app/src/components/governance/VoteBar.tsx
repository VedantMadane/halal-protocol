import { formatTokenGrouped } from "@/lib/format";

export function VoteBar({
  against,
  forVotes,
  abstain,
  compact,
}: {
  against: bigint | undefined;
  forVotes: bigint | undefined;
  abstain: bigint | undefined;
  compact?: boolean;
}) {
  const a = against ?? 0n;
  const f = forVotes ?? 0n;
  const ab = abstain ?? 0n;
  const total = a + f + ab;

  const pct = (v: bigint) => (total > 0n ? Number((v * 10000n) / total) / 100 : 0);
  const forPct = pct(f);
  const againstPct = pct(a);
  const abstainPct = pct(ab);

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-background-subtle">
        {total > 0n ? (
          <>
            <div className="h-full bg-primary" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-danger" style={{ width: `${againstPct}%` }} />
            <div className="h-full bg-muted" style={{ width: `${abstainPct}%` }} />
          </>
        ) : null}
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
            For {formatTokenGrouped(f, 18, 0)} ({forPct.toFixed(1)}%)
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger" />
            Against {formatTokenGrouped(a, 18, 0)} ({againstPct.toFixed(1)}%)
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted" />
            Abstain {formatTokenGrouped(ab, 18, 0)} ({abstainPct.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}
