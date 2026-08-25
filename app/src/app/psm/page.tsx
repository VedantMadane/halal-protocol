"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { NotDeployedState } from "@/components/NotDeployedState";
import { CpiCard } from "@/components/dashboard/CpiCard";
import { ReserveHealthCard } from "@/components/dashboard/ReserveHealthCard";
import { SwapForm } from "@/components/psm/SwapForm";
import { TransferRedeemableForm } from "@/components/psm/TransferRedeemableForm";
import { useDeployment } from "@/hooks/useDeployment";
import { usePsmState } from "@/hooks/usePsm";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { DeploymentIntegrityBanner } from "@/components/DeploymentIntegrityBanner";
import { PsmSafetyAlert } from "@/components/psm/PsmSafetyAlert";
import { usePsmSafety } from "@/hooks/usePsmSafety";
import { CpiAdapterCard } from "@/components/dashboard/CpiAdapterCard";

export default function PsmPage() {
  const { isDeployed } = useDeployment();
  const psm = usePsmState();
  const safety = usePsmSafety(psm);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="PSM Swap"
        description="Deposit the reserve asset to mint HLC, or redeem HLC you've minted here back into reserve, at the current CPI-adjusted rate."
      />

      {!isDeployed ? (
        <NotDeployedState />
      ) : (
        <div className="space-y-4">
          <DeploymentIntegrityBanner />
          <PsmSafetyAlert safety={safety} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {psm.isError && (
                <Alert tone="danger" title="Some PSM data could not be loaded">
                  {getFriendlyErrorMessage(psm.error)} Refresh the page or check your network.
                </Alert>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Swap</CardTitle>
                </CardHeader>
                <CardBody>
                  <SwapForm cpiRate={psm.cpiRate} depositBlockedReason={safety.depositBlockedReason} />
                </CardBody>
              </Card>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Transfer redemption credit</CardTitle>
                </CardHeader>
                <CardBody>
                  <TransferRedeemableForm />
                </CardBody>
              </Card>
            </div>
            <div className="space-y-4 lg:col-span-2">
              <CpiCard
                cpiRate={psm.cpiRate}
                previousCPI={psm.previousCPI}
                lastUpdated={psm.lastUpdated}
                lastReportTimestamp={psm.lastReportTimestamp}
                maxReportAge={psm.maxReportAge}
                minUpdateInterval={psm.minUpdateInterval}
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
              <CpiAdapterCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
