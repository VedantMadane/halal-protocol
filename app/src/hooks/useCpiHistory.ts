"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId, usePublicClient } from "wagmi";
import { decodeEventLog, getAbiItem, type Hex } from "viem";
import { halalPsmAbi } from "@/abis";
import { getLogsChunked } from "@/lib/logs";
import { useDeployment } from "./useDeployment";

const cpiUpdatedEvent = getAbiItem({ abi: halalPsmAbi, name: "CPIUpdated" });

export interface CpiUpdate {
  previousCPI: bigint;
  newCPI: bigint;
  viaUpdater: boolean;
  blockNumber: bigint;
  blockTimestamp: bigint | undefined;
  transactionHash: Hex | undefined;
}

/** Reads the recent CPI update timeline directly from the PSM event log. */
export function useCpiHistory(limit = 6) {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { deployment, isDeployed } = useDeployment();

  return useQuery({
    queryKey: ["halal", "cpiHistory", chainId, deployment?.psm, deployment?.deploymentBlock.toString(), limit],
    queryFn: async (): Promise<CpiUpdate[]> => {
      if (!publicClient || !deployment) return [];
      const latest = await publicClient.getBlockNumber();
      const logs = await getLogsChunked(publicClient, {
        address: deployment.psm,
        event: cpiUpdatedEvent,
        fromBlock: deployment.deploymentBlock,
        toBlock: latest,
      });
      const recentLogs = logs
        .sort((a, b) => {
          const blockA = a.blockNumber ?? 0n;
          const blockB = b.blockNumber ?? 0n;
          if (blockA !== blockB) return blockA > blockB ? -1 : 1;
          return (b.logIndex ?? 0n) > (a.logIndex ?? 0n) ? 1 : -1;
        })
        .slice(0, limit);
      const blockNumbers = [...new Set(recentLogs.map((log) => log.blockNumber).filter((block): block is bigint => block !== null))];
      const blocks = await Promise.all(blockNumbers.map((blockNumber) => publicClient.getBlock({ blockNumber })));
      const timestamps = new Map(blocks.map((block) => [block.number, block.timestamp]));

      return recentLogs.map((log) => {
        const decoded = decodeEventLog({
          abi: halalPsmAbi,
          eventName: "CPIUpdated",
          data: log.data,
          topics: log.topics,
        });
        const args = decoded.args as { previousCPI: bigint; newCPI: bigint; viaUpdater: boolean };
        const blockNumber = log.blockNumber ?? 0n;
        return {
          previousCPI: args.previousCPI,
          newCPI: args.newCPI,
          viaUpdater: args.viaUpdater,
          blockNumber,
          blockTimestamp: timestamps.get(blockNumber),
          transactionHash: log.transactionHash ?? undefined,
        };
      });
    },
    enabled: !!publicClient && isDeployed,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
