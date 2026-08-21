"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { NotDeployedState } from "@/components/NotDeployedState";
import { CpiCard } from "@/components/dashboard/CpiCard";
import { ReserveHealthCard } from "@/components/dashboard/ReserveHealthCard";
import { SwapForm } from "@/components/psm/SwapForm";
import { useDeployment } from "@/hooks/useDeployment";
import { usePsmState } from "@/hooks/usePsm";

export default function PsmPage() {
  const { isDeployed } = useDeployment();
  const psm = usePsmState();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="PSM Swap"
        description="Deposit the reserve asset to mint HLC, or redeem HLC you've minted here back into reserve, at the current CPI-adjusted rate."
      />

      {!isDeployed ? (
        <NotDeployedState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Swap</CardTitle>
              </CardHeader>
              <CardBody>
                <SwapForm cpiRate={psm.cpiRate} />
              </CardBody>
            </Card>
          </div>
          <div className="space-y-4 lg:col-span-2">
            <CpiCard
              cpiRate={psm.cpiRate}
              previousCPI={psm.previousCPI}
              lastUpdated={psm.lastUpdated}
              source={psm.source}
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
        </div>
      )}
    </div>
  );
}
