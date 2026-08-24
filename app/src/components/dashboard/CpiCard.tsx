"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCPIRate, formatDate } from "@/lib/format";

export function CpiCard({
  cpiRate,
  previousCPI,
  lastUpdated,
  minUpdateInterval,
  source,
  reserveSymbol,
  isLoading,
}: {
  cpiRate: bigint | undefined;
  previousCPI: bigint | undefined;
  lastUpdated: bigint | undefined;
  minUpdateInterval: bigint | undefined;
  source: string | undefined;
  reserveSymbol: string | undefined;
  isLoading: boolean;
}) {
  const [now, setNow] = useState<bigint>();

  useEffect(() => {
    const refreshNow = () => setNow(BigInt(Math.floor(Date.now() / 1000)));
    refreshNow();
    const interval = window.setInterval(refreshNow, 20_000);
    return () => window.clearInterval(interval);
  }, []);

  const delta =
    cpiRate !== undefined && previousCPI !== undefined && previousCPI > 0n
      ? ((Number(cpiRate) - Number(previousCPI)) / Number(previousCPI)) * 100
      : undefined;
  const updateOverdue =
    now !== undefined && lastUpdated !== undefined && minUpdateInterval !== undefined
      ? now > lastUpdated + minUpdateInterval
      : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPI Rate</CardTitle>
        {!isLoading && updateOverdue && <Badge tone="danger">Update overdue</Badge>}
      </CardHeader>
      <CardBody className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="tabular text-3xl font-semibold tracking-tight">{formatCPIRate(cpiRate)}</span>
            <span className="text-sm text-muted">{reserveSymbol ?? "reserve"} / HLC</span>
            {delta !== undefined && (
              <span className={`ml-auto text-xs font-medium ${delta >= 0 ? "text-primary" : "text-danger"}`}>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2)}% vs. previous
              </span>
            )}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted">Previous rate</dt>
            <dd className="tabular font-medium">{formatCPIRate(previousCPI)}</dd>
          </div>
          <div>
            <dt className="text-muted">Last updated</dt>
            <dd className="font-medium">{formatDate(lastUpdated)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">Source</dt>
            <dd className="truncate font-medium">{source || "Not set"}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
