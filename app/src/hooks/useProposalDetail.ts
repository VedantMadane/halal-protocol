"use client";

import { useAccount, useReadContracts } from "wagmi";
import { halalDaoAbi, halalTokenAbi } from "@/abis";
import { useDeployment } from "./useDeployment";
import { hasReadFailure, partialReadError } from "@/lib/readResults";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Live on-chain state for a single proposal: state, tally, snapshot/deadline, quorum, hasVoted. */
export function useProposalDetail(proposalId: bigint | undefined) {
  const { deployment } = useDeployment();
  const { address } = useAccount();

  const enabled = !!deployment && proposalId !== undefined;

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts:
      deployment && proposalId !== undefined
        ? ([
            { address: deployment.dao, abi: halalDaoAbi, functionName: "state", args: [proposalId] },
            { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalVotes", args: [proposalId] },
            { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalSnapshot", args: [proposalId] },
            { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalDeadline", args: [proposalId] },
            { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalProposer", args: [proposalId] },
            {
              address: deployment.dao,
              abi: halalDaoAbi,
              functionName: "hasVoted",
              args: [proposalId, address ?? ZERO_ADDRESS],
            },
            { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalEta", args: [proposalId] },
          ] as const)
        : [],
    query: {
      enabled,
      refetchInterval: 12_000,
    },
  });

  const state = data?.[0]?.status === "success" ? Number(data[0].result) : undefined;
  const votesRaw = data?.[1]?.status === "success" ? (data[1].result as readonly [bigint, bigint, bigint]) : undefined;
  const votes = votesRaw ? { against: votesRaw[0], for: votesRaw[1], abstain: votesRaw[2] } : undefined;
  const snapshot = data?.[2]?.status === "success" ? (data[2].result as bigint) : undefined;
  const deadline = data?.[3]?.status === "success" ? (data[3].result as bigint) : undefined;
  const proposer = data?.[4]?.status === "success" ? (data[4].result as string) : undefined;
  const hasVoted = data?.[5]?.status === "success" ? (data[5].result as boolean) : undefined;
  const proposalEta = data?.[6]?.status === "success" ? (data[6].result as bigint) : undefined;

  // Quorum and the connected wallet's voting power are only well-defined once we have a
  // snapshot block/timepoint to evaluate them at (matches what castVote actually checks).
  const {
    data: snapshotData,
    isLoading: snapshotLoading,
    isError: snapshotReadError,
    error: snapshotError,
  } = useReadContracts({
    contracts:
      deployment && snapshot !== undefined
        ? ([
            { address: deployment.dao, abi: halalDaoAbi, functionName: "quorum", args: [snapshot] },
            {
              address: deployment.token,
              abi: halalTokenAbi,
              functionName: "getPastVotes",
              args: [address ?? ZERO_ADDRESS, snapshot],
            },
          ] as const)
        : [],
    query: { enabled: enabled && snapshot !== undefined },
  });
  const readFailed = hasReadFailure(data) || hasReadFailure(snapshotData);
  const quorumNeeded = snapshotData?.[0]?.status === "success" ? (snapshotData[0].result as bigint) : undefined;
  const votingPowerAtSnapshot = snapshotData?.[1]?.status === "success" ? (snapshotData[1].result as bigint) : undefined;

  return {
    state,
    votes,
    snapshot,
    deadline,
    proposer,
    hasVoted,
    proposalEta,
    quorumNeeded,
    votingPowerAtSnapshot,
    isLoading: isLoading || snapshotLoading,
    isError: isError || snapshotReadError || readFailed,
    error: error ?? snapshotError ?? (readFailed ? partialReadError() : undefined),
    refetch,
  };
}
