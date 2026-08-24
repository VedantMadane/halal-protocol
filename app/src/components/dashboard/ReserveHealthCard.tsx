import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTokenGrouped } from "@/lib/format";

const RATIO_SCALE = 1_000_000n;

/** Convert arbitrary uint256 reserve values to a bounded UI ratio without Number overflow. */
function reserveRatio(balance: bigint | undefined, required: bigint | undefined): number {
  if (required === 0n) return 1;
  if (balance === undefined || required === undefined || required === 0n) return 0;
  const scaled = balance >= required ? RATIO_SCALE : (balance * RATIO_SCALE) / required;
  return Number(scaled) / Number(RATIO_SCALE);
}

export function ReserveHealthCard({
  reserveBalance,
  reserveRequired,
  reserveSurplus,
  reserveDecimals,
  reserveSymbol,
  isLoading,
}: {
  reserveBalance: bigint | undefined;
  reserveRequired: bigint | undefined;
  reserveSurplus: bigint | undefined; // int256, may be negative
  reserveDecimals: number | undefined;
  reserveSymbol: string | undefined;
  isLoading: boolean;
}) {
  const decimals = reserveDecimals ?? 18;
  const isHealthy = reserveSurplus !== undefined ? reserveSurplus >= 0n : undefined;
  const ratio = reserveRatio(reserveBalance, reserveRequired);

  return (
    <Card>
      <CardHeader>
        <CardTitle>PSM Reserve Health</CardTitle>
        {isLoading ? (
          <Skeleton className="h-6 w-20" />
        ) : isHealthy === undefined ? null : (
          <Badge tone={isHealthy ? "primary" : "danger"}>{isHealthy ? "Fully collateralized" : "Under-collateralized"}</Badge>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-2 w-full" />
          </>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted">Reserve on hand</p>
                <p className="tabular text-xl font-semibold">
                  {formatTokenGrouped(reserveBalance, decimals)} {reserveSymbol ?? ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Required to fully back HLC</p>
                <p className="tabular text-xl font-semibold">
                  {formatTokenGrouped(reserveRequired, decimals)} {reserveSymbol ?? ""}
                </p>
              </div>
            </div>
            <ProgressBar ratio={ratio} tone={isHealthy ? "primary" : "danger"} />
            <p className="text-xs text-muted-foreground">
              {reserveSurplus !== undefined ? (
                reserveSurplus >= 0n ? (
                  <>
                    Surplus of {formatTokenGrouped(reserveSurplus, decimals)} {reserveSymbol ?? ""} above what&apos;s
                    needed to redeem all outstanding PSM-issued HLC at the current rate.
                  </>
                ) : (
                  <>
                    Shortfall of {formatTokenGrouped(-reserveSurplus, decimals)} {reserveSymbol ?? ""}. Withdrawals still
                    succeed first-come-first-served up to the available reserve.
                  </>
                )
              ) : (
                "—"
              )}
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
