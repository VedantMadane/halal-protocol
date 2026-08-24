"use client";

import { useReadContracts } from "wagmi";
import { halalPsmAbi, erc20Abi } from "@/abis";
import { useDeployment } from "./useDeployment";
import { hasReadFailure, partialReadError } from "@/lib/readResults";

/** Aggregate HalalPSM state: CPI rate, reserve health, and reserve token metadata. */
export function usePsmState() {
  const { deployment, isDeployed } = useDeployment();

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts: deployment
      ? ([
          { address: deployment.psm, abi: halalPsmAbi, functionName: "cpiRate" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "previousCPI" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "reserveRequired" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "reserveSurplus" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "lastUpdated" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "minUpdateInterval" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "source" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "totalHlcIssued" },
          { address: deployment.reserveToken, abi: erc20Abi, functionName: "balanceOf", args: [deployment.psm] },
          { address: deployment.reserveToken, abi: erc20Abi, functionName: "decimals" },
          { address: deployment.reserveToken, abi: erc20Abi, functionName: "symbol" },
        ] as const)
      : [],
    query: { enabled: isDeployed, refetchInterval: 20_000 },
  });
  // These getters were added after the initial immutable deployments. Keep them in a separate,
  // optional read batch so an older deployment still exposes its core PSM data and simply shows
  // source-report metadata as unavailable.
  const { data: reportData } = useReadContracts({
    contracts: deployment
      ? ([
          { address: deployment.psm, abi: halalPsmAbi, functionName: "lastReportTimestamp" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "MAX_REPORT_AGE" },
        ] as const)
      : [],
    query: { enabled: isDeployed, refetchInterval: 20_000 },
  });
  const readFailed = hasReadFailure(data);

  const get = <T>(i: number): T | undefined => (data?.[i]?.status === "success" ? (data[i].result as T) : undefined);
  const getReport = <T>(i: number): T | undefined =>
    reportData?.[i]?.status === "success" ? (reportData[i].result as T) : undefined;

  return {
    cpiRate: get<bigint>(0),
    previousCPI: get<bigint>(1),
    reserveRequired: get<bigint>(2),
    reserveSurplus: get<bigint>(3), // int256, may be negative
    lastUpdated: get<bigint>(4),
    minUpdateInterval: get<bigint>(5),
    source: get<string>(6),
    totalHlcIssued: get<bigint>(7),
    reserveBalance: get<bigint>(8),
    reserveDecimals: get<number>(9),
    reserveSymbol: get<string>(10),
    lastReportTimestamp: getReport<bigint>(0),
    maxReportAge: getReport<bigint>(1),
    isLoading,
    isError: isError || readFailed,
    error: error ?? (readFailed ? partialReadError() : undefined),
    refetch,
  };
}
