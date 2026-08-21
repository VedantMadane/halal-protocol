import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  loading,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {icon}
      </div>
      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-background-subtle" />
      ) : (
        <span className="tabular text-2xl font-semibold tracking-tight text-foreground">{value}</span>
      )}
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}
