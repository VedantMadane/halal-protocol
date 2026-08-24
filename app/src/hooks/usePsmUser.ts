"use client";

import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi, halalPsmAbi, halalTokenAbi } from "@/abis";
import { useDeployment } from "./useDeployment";
import { hasReadFailure, partialReadError } from "@/lib/readResults";

/**
 * Per-wallet PSM state: reserve token balance/allowance, HLC balance/allowance, and the amount
 * of HLC this specific address is actually entitled to redeem here (`redeemableBalance`).
 * `withdraw` is capped by `redeemableBalance`, not by the wallet's raw HLC balance — PSM-minted
 * HLC's redemption right is per-depositor, so only HLC this address itself minted through
 * `deposit` (and hasn't already redeemed) can be withdrawn here.
 */
export function usePsmUserState() {
  const { deployment } = useDeployment();
  const { address } = useAccount();

  const enabled = !!deployment && !!address;

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts:
      deployment && address
        ? ([
            { address: deployment.reserveToken, abi: erc20Abi, functionName: "balanceOf", args: [address] },
            {
              address: deployment.reserveToken,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address, deployment.psm],
            },
            { address: deployment.token, abi: halalTokenAbi, functionName: "balanceOf", args: [address] },
            {
              address: deployment.token,
              abi: halalTokenAbi,
              functionName: "allowance",
              args: [address, deployment.psm],
            },
            { address: deployment.psm, abi: halalPsmAbi, functionName: "redeemableBalance", args: [address] },
          ] as const)
        : [],
    query: { enabled, refetchInterval: 15_000 },
  });
  const readFailed = hasReadFailure(data);

  const get = <T>(i: number): T | undefined => (data?.[i]?.status === "success" ? (data[i].result as T) : undefined);

  return {
    reserveBalance: get<bigint>(0),
    reserveAllowance: get<bigint>(1),
    hlcBalance: get<bigint>(2),
    hlcAllowance: get<bigint>(3),
    redeemableBalance: get<bigint>(4),
    isLoading,
    isError: isError || readFailed,
    error: error ?? (readFailed ? partialReadError() : undefined),
    refetch,
  };
}
