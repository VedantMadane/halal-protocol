"use client";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCpiAdapter } from "@/hooks/useCpiAdapter";
import { useDeployment } from "@/hooks/useDeployment";
import { formatDate, shortAddress } from "@/lib/format";

export function CpiAdapterCard() {
  const { deployment } = useDeployment();
  const adapter = useCpiAdapter();

  if (!deployment?.cpiAdapter) return null;

  const signerCountMatches =
    adapter.signerCount !== undefined &&
    adapter.signers !== undefined &&
    BigInt(adapter.signers.length) === adapter.signerCount;
  const quorumValid =
    adapter.threshold !== undefined &&
    adapter.signerCount !== undefined &&
    adapter.threshold > 0n &&
    adapter.threshold <= adapter.signerCount &&
    signerCountMatches;
  const wiringValid =
    adapter.psm?.toLowerCase() === deployment.psm.toLowerCase() &&
    adapter.owner?.toLowerCase() === deployment.timelock.toLowerCase() &&
    adapter.sourceId?.toLowerCase() === deployment.cpiSourceId?.toLowerCase();
  const isVerified = !adapter.isError && quorumValid && wiringValid;

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPI report adapter</CardTitle>
        {adapter.isLoading ? (
          <Skeleton className="h-6 w-20" />
        ) : adapter.isError ? (
          <Badge tone="danger">Read failed</Badge>
        ) : (
          <Badge tone={isVerified ? "primary" : "danger"}>{isVerified ? "Verified quorum" : "Review wiring"}</Badge>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        {adapter.isError ? (
          <Alert tone="danger">The live adapter state could not be read. Do not sign a CPI report until the RPC is healthy.</Alert>
        ) : adapter.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-56" />
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted">Adapter</dt>
                <dd className="font-medium" title={adapter.adapter}>{shortAddress(adapter.adapter)}</dd>
              </div>
              <div>
                <dt className="text-muted">Owner</dt>
                <dd className="font-medium" title={adapter.owner}>{shortAddress(adapter.owner)}</dd>
              </div>
              <div>
                <dt className="text-muted">Source ID</dt>
                <dd className="font-medium" title={adapter.sourceId}>{shortAddress(adapter.sourceId, 6)}</dd>
              </div>
              <div>
                <dt className="text-muted">Last submitted report</dt>
                <dd className="font-medium">{formatDate(adapter.lastSubmittedTimestamp)}</dd>
              </div>
            </dl>
            <div className="rounded-xl bg-background-subtle p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted">Report quorum</span>
                <span className="tabular font-semibold">
                  {adapter.threshold?.toString() ?? "—"} of {adapter.signerCount?.toString() ?? "—"} signatures
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {adapter.signers?.map((signer, index) => (
                  <div className="flex items-center justify-between text-xs" key={signer}>
                    <span className="text-muted">Signer {index + 1}</span>
                    <code title={signer}>{shortAddress(signer)}</code>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted">
              The adapter authenticates the configured signer quorum. The source policy and signer custody still require
              independent operational review.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
