"use client";

import { useReadContracts } from "wagmi";
import { halalTokenAbi } from "@/abis";
import { useDeployment } from "./useDeployment";
import { hasReadFailure, partialReadError } from "@/lib/readResults";

/** HalalToken-level protocol stats: total supply, name/symbol (sanity display only). */
export function useTokenInfo() {
  const { deployment, isDeployed } = useDeployment();

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts: deployment
      ? ([
          { address: deployment.token, abi: halalTokenAbi, functionName: "totalSupply" },
          { address: deployment.token, abi: halalTokenAbi, functionName: "TEAM_ALLOCATION" },
          { address: deployment.token, abi: halalTokenAbi, functionName: "TREASURY_ALLOCATION" },
        ] as const)
      : [],
    query: { enabled: isDeployed, refetchInterval: 20_000 },
  });
  const readFailed = hasReadFailure(data);

  return {
    totalSupply: data?.[0]?.status === "success" ? (data[0].result as bigint) : undefined,
    teamAllocation: data?.[1]?.status === "success" ? (data[1].result as bigint) : undefined,
    treasuryAllocation: data?.[2]?.status === "success" ? (data[2].result as bigint) : undefined,
    isLoading,
    isError: isError || readFailed,
    error: error ?? (readFailed ? partialReadError() : undefined),
    refetch,
  };
}
