"use client";

import { useAccount, useReadContracts } from "wagmi";
import { halalTokenAbi, halalDaoAbi } from "@/abis";
import { useDeployment } from "./useDeployment";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** The connected wallet's HLC balance, voting power, delegate, and the DAO's proposal threshold. */
export function useVotingPower() {
  const { deployment } = useDeployment();
  const { address } = useAccount();

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts:
      deployment && address
        ? ([
            { address: deployment.token, abi: halalTokenAbi, functionName: "balanceOf", args: [address] },
            { address: deployment.token, abi: halalTokenAbi, functionName: "getVotes", args: [address] },
            { address: deployment.token, abi: halalTokenAbi, functionName: "delegates", args: [address] },
            { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalThreshold" },
          ] as const)
        : [],
    query: { enabled: !!deployment && !!address, refetchInterval: 20_000 },
  });

  const get = <T>(i: number): T | undefined => (data?.[i]?.status === "success" ? (data[i].result as T) : undefined);

  const delegate = get<string>(2);

  return {
    balance: get<bigint>(0),
    votes: get<bigint>(1),
    delegate,
    hasDelegated: !!delegate && delegate.toLowerCase() !== ZERO_ADDRESS,
    isSelfDelegated: !!delegate && !!address && delegate.toLowerCase() === address.toLowerCase(),
    proposalThreshold: get<bigint>(3),
    isLoading,
    isError,
    error,
    refetch,
  };
}
