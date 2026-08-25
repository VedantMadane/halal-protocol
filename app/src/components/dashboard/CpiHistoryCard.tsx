"use client";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCpiHistory } from "@/hooks/useCpiHistory";
import { formatCPIRate, formatDate, shortAddress } from "@/lib/format";

export function CpiHistoryCard() {
  const history = useCpiHistory();

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPI update history</CardTitle>
        {history.isLoading ? <Skeleton className="h-6 w-16" /> : history.isError ? <Badge tone="danger">Read failed</Badge> : <Badge tone="neutral">On-chain log</Badge>}
      </CardHeader>
      <CardBody>
        {history.isError ? (
          <Alert tone="danger">The CPI event history could not be read. Check the selected RPC before relying on the timeline.</Alert>
        ) : history.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        ) : history.data?.length ? (
          <div className="space-y-3">
            {history.data.map((update) => (
              <div className="flex items-center justify-between gap-3 text-xs" key={`${update.transactionHash ?? "unknown"}-${update.blockNumber}`}>
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatCPIRate(update.previousCPI)} → {formatCPIRate(update.newCPI)}
                  </p>
                  <p className="text-muted">
                    {update.viaUpdater ? "Updater report" : "Governance override"} · {formatDate(update.blockTimestamp)} · block {update.blockNumber.toString()}
                  </p>
                </div>
                {update.transactionHash && <code className="shrink-0 text-muted" title={update.transactionHash}>{shortAddress(update.transactionHash, 5)}</code>}
              </div>
            ))}
            <p className="pt-1 text-xs text-muted">Values come from the PSM&apos;s immutable event log. The timeline is limited to the six most recent updates.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">No CPI updates were found after the configured deployment block.</p>
        )}
      </CardBody>
    </Card>
  );
}
