import type { AbiEvent, Log, PublicClient } from "viem";

/**
 * Fetches logs for an event across [fromBlock, toBlock], transparently falling back to
 * chunked requests if the RPC provider rejects the full range (many public RPC endpoints cap
 * eth_getLogs to a few thousand blocks per call). There's no indexer for this protocol yet, so
 * this is the pragmatic client-side substitute described in the project brief: good enough for
 * a v1, not meant to replace a real subgraph at scale. A failed slice is surfaced to the caller
 * instead of being silently omitted, because incomplete governance history is worse than a
 * visible load error.
 */
export async function getLogsChunked<const TAbiEvent extends AbiEvent>(
  client: PublicClient,
  params: {
    address: `0x${string}`;
    event: TAbiEvent;
    fromBlock: bigint;
    toBlock: bigint;
  },
  chunkSize = 50_000n,
): Promise<Log[]> {
  const { address, event, fromBlock, toBlock } = params;
  if (fromBlock > toBlock) return [];

  try {
    return await client.getLogs({ address, event, fromBlock, toBlock });
  } catch {
    // Fall through to chunked fetching below.
  }

  const allLogs: Log[] = [];
  let start = fromBlock;
  let currentChunk = chunkSize;

  while (start <= toBlock) {
    const end = start + currentChunk - 1n > toBlock ? toBlock : start + currentChunk - 1n;
    try {
      const logs = await client.getLogs({ address, event, fromBlock: start, toBlock: end });
      allLogs.push(...logs);
      start = end + 1n;
    } catch {
      // Provider still unhappy with this chunk size — halve it and retry, down to a floor.
      if (currentChunk <= 500n) {
        throw new Error(`Unable to read governance logs for blocks ${start}–${end}.`);
      }
      currentChunk = currentChunk / 2n;
    }
  }

  return allLogs;
}
