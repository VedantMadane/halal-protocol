"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useChainId, useReadContracts } from "wagmi";
import { decodeEventLog, getAbiItem, type Address, type Hex } from "viem";
import { halalDaoAbi } from "@/abis";
import { useDeployment } from "./useDeployment";
import { getLogsChunked } from "@/lib/logs";

const proposalCreatedEvent = getAbiItem({ abi: halalDaoAbi, name: "ProposalCreated" });

export interface ProposalCreatedInfo {
  proposalId: bigint;
  proposer: Address;
  targets: readonly Address[];
  values: readonly bigint[];
  signatures: readonly string[];
  calldatas: readonly Hex[];
  voteStart: bigint;
  voteEnd: bigint;
  description: string;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * Scans HalalDAO's ProposalCreated event log for the full proposal history. There is no
 * subgraph/indexer for this protocol, so this is a pragmatic client-side substitute: it scans
 * from the recorded deployment block to the current head (in chunks, see lib/logs.ts) and
 * caches the result via TanStack Query. Good enough for a v1; a real indexer can replace this
 * later without changing the shape consumers rely on.
 */
export function useProposalEvents() {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { deployment, isDeployed } = useDeployment();

  return useQuery({
    queryKey: ["halal", "proposalEvents", chainId, deployment?.dao],
    queryFn: async (): Promise<ProposalCreatedInfo[]> => {
      if (!publicClient || !deployment) return [];
      const latest = await publicClient.getBlockNumber();
      const logs = await getLogsChunked(publicClient, {
        address: deployment.dao,
        event: proposalCreatedEvent,
        fromBlock: deployment.deploymentBlock,
        toBlock: latest,
      });

      const decoded = logs.map((log) => {
        const { args } = decodeEventLog({
          abi: halalDaoAbi,
          eventName: "ProposalCreated",
          data: log.data,
          topics: log.topics,
        });
        return {
          ...args,
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? ("0x" as Hex),
        } satisfies ProposalCreatedInfo;
      });

      return decoded.sort((a, b) => (a.proposalId > b.proposalId ? -1 : a.proposalId < b.proposalId ? 1 : 0));
    },
    enabled: !!publicClient && isDeployed,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export interface ProposalVotes {
  against: bigint;
  for: bigint;
  abstain: bigint;
}

export interface ProposalListItem extends ProposalCreatedInfo {
  state: number | undefined;
  votes: ProposalVotes | undefined;
}

/** Combines the ProposalCreated event history with live state + vote tally for each proposal. */
export function useProposals() {
  const eventsQuery = useProposalEvents();
  const { deployment } = useDeployment();

  // Memoized so a missing `.data` doesn't produce a fresh `[]` reference every render (which
  // would otherwise make the useMemo hooks below think `events` changed on every render).
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const contracts = useMemo(() => {
    if (!deployment) return [];
    return events.flatMap(
      (p) =>
        [
          { address: deployment.dao, abi: halalDaoAbi, functionName: "state", args: [p.proposalId] },
          { address: deployment.dao, abi: halalDaoAbi, functionName: "proposalVotes", args: [p.proposalId] },
        ] as const,
    );
  }, [deployment, events]);

  const stateQuery = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 15_000,
    },
  });

  const proposals: ProposalListItem[] = useMemo(() => {
    return events.map((event, i) => {
      const stateResult = stateQuery.data?.[i * 2];
      const votesResult = stateQuery.data?.[i * 2 + 1];
      const state = stateResult?.status === "success" ? Number(stateResult.result) : undefined;
      const votes =
        votesResult?.status === "success"
          ? {
              against: (votesResult.result as readonly [bigint, bigint, bigint])[0],
              for: (votesResult.result as readonly [bigint, bigint, bigint])[1],
              abstain: (votesResult.result as readonly [bigint, bigint, bigint])[2],
            }
          : undefined;
      return { ...event, state, votes };
    });
  }, [events, stateQuery.data]);

  return {
    proposals,
    isLoading: eventsQuery.isLoading || (contracts.length > 0 && stateQuery.isLoading),
    isError: eventsQuery.isError || stateQuery.isError,
    error: eventsQuery.error ?? stateQuery.error,
    refetch: () => {
      void eventsQuery.refetch();
      void stateQuery.refetch();
    },
  };
}

/** Looks up a single proposal's ProposalCreated event by id from the cached event history. */
export function useProposalEvent(proposalId: bigint | undefined) {
  const eventsQuery = useProposalEvents();
  const event = useMemo(
    () => eventsQuery.data?.find((p) => p.proposalId === proposalId),
    [eventsQuery.data, proposalId],
  );
  return { event, isLoading: eventsQuery.isLoading, isError: eventsQuery.isError, error: eventsQuery.error };
}
