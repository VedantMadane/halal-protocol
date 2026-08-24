"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { NotDeployedState } from "@/components/NotDeployedState";
import { CpiCard } from "@/components/dashboard/CpiCard";
import { ReserveHealthCard } from "@/components/dashboard/ReserveHealthCard";
import { VestingSummaryCard } from "@/components/dashboard/VestingSummaryCard";
import { Alert } from "@/components/ui/Alert";
import { useDeployment } from "@/hooks/useDeployment";
import { useTokenInfo } from "@/hooks/useTokenInfo";
import { usePsmState } from "@/hooks/usePsm";
import { useVestingSchedule } from "@/hooks/useVesting";
import { formatTokenGrouped } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

export default function DashboardPage() {
  const { deployment, isDeployed } = useDeployment();
  const token = useTokenInfo();
  const psm = usePsmState();
  const team = useVestingSchedule(deployment?.teamVesting);
  const treasury = useVestingSchedule(deployment?.treasuryVesting);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Protocol Overview"
        description="Live supply, peg rate, reserve health, and vesting status for the Halal protocol."
      />

      {!isDeployed ? (
        <NotDeployedState />
      ) : (
        <div className="space-y-6">
          {(token.isError || psm.isError || team.isError || treasury.isError) && (
            <Alert tone="danger" title="Some protocol data could not be loaded">
              {getFriendlyErrorMessage(token.error ?? psm.error ?? team.error ?? treasury.error)} Refresh the page or check your network.
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="HLC Total Supply"
              value={`${formatTokenGrouped(token.totalSupply, 18)} HLC`}
              loading={token.isLoading}
            />
            <StatTile
              label="PSM-Issued HLC"
              value={`${formatTokenGrouped(psm.totalHlcIssued, 18)} HLC`}
              sub="Minted against deposited reserve"
              loading={psm.isLoading}
            />
            <StatTile
              label="Team + Treasury Allocation"
              value={`${formatTokenGrouped(
                (token.teamAllocation ?? 0n) + (token.treasuryAllocation ?? 0n),
                18,
              )} HLC`}
              sub="Fixed genesis supply, vesting"
              loading={token.isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CpiCard
              cpiRate={psm.cpiRate}
              previousCPI={psm.previousCPI}
              lastUpdated={psm.lastUpdated}
              source={psm.source}
              reserveSymbol={psm.reserveSymbol}
              isLoading={psm.isLoading}
            />
            <ReserveHealthCard
              reserveBalance={psm.reserveBalance}
              reserveRequired={psm.reserveRequired}
              reserveSurplus={psm.reserveSurplus}
              reserveDecimals={psm.reserveDecimals}
              reserveSymbol={psm.reserveSymbol}
              isLoading={psm.isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <VestingSummaryCard label="Team" schedule={team.schedule} isLoading={team.isLoading} />
            <VestingSummaryCard label="Treasury" schedule={treasury.schedule} isLoading={treasury.isLoading} />
          </div>
        </div>
      )}
    </div>
  );
}
