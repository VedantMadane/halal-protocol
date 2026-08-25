"use client";

import { useEffect, useState } from "react";

type PsmSafetyInputs = {
  isLoading?: boolean;
  lastUpdated: bigint | undefined;
  lastReportTimestamp: bigint | undefined;
  maxReportAge: bigint | undefined;
  minUpdateInterval: bigint | undefined;
  reserveSurplus: bigint | undefined;
};

export type PsmSafetyState = {
  reportTimestampMissing: boolean;
  reportStale: boolean;
  updateOverdue: boolean;
  underCollateralized: boolean;
  depositBlockedReason: string | undefined;
};

/**
 * Derives user-facing operating gates from the same freshness and collateral views enforced by
 * the protocol. A stale feed or reserve deficit pauses new deposits, but never hides the recovery
 * path: users may still withdraw their own redeemable credit when the contract permits it.
 */
export function usePsmSafety({
  isLoading = false,
  lastUpdated,
  lastReportTimestamp,
  maxReportAge,
  minUpdateInterval,
  reserveSurplus,
}: PsmSafetyInputs) {
  const [now, setNow] = useState<bigint>();

  useEffect(() => {
    const refreshNow = () => setNow(BigInt(Math.floor(Date.now() / 1000)));
    refreshNow();
    const interval = window.setInterval(refreshNow, 20_000);
    return () => window.clearInterval(interval);
  }, []);

  const reportMetadataUnavailable = lastReportTimestamp === undefined || maxReportAge === undefined;
  const reportTimestampMissing = lastReportTimestamp === 0n;
  const reportStale =
    !reportMetadataUnavailable &&
    !reportTimestampMissing &&
    now !== undefined &&
    now > (lastReportTimestamp as bigint) + (maxReportAge as bigint);
  const updateOverdue =
    now !== undefined &&
    lastUpdated !== undefined &&
    minUpdateInterval !== undefined &&
    now > lastUpdated + minUpdateInterval;
  const underCollateralized = reserveSurplus !== undefined && reserveSurplus < 0n;

  let depositBlockedReason: string | undefined;
  if (isLoading) {
    depositBlockedReason = undefined;
  } else if (underCollateralized) {
    depositBlockedReason = "The PSM is under-reserved. Wait for governance to restore full collateral before depositing.";
  } else if (reportMetadataUnavailable) {
    depositBlockedReason = "This deployment does not expose verifiable CPI report freshness. Deposits are paused for safety.";
  } else if (reportTimestampMissing) {
    depositBlockedReason = "No timestamped CPI report has been accepted yet. Deposits are paused until the feed is initialized.";
  } else if (reportStale) {
    depositBlockedReason = "The CPI source report is stale. Deposits are paused until the updater publishes fresh data.";
  }

  const safety: PsmSafetyState = {
    reportTimestampMissing,
    reportStale,
    updateOverdue,
    underCollateralized,
    depositBlockedReason,
  };
  return safety;
}
