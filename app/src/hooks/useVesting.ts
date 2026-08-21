"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { halalVestingAbi } from "@/abis";

export interface VestingSchedule {
  beneficiary: Address;
  totalAllocation: bigint;
  released: bigint;
  releasable: bigint;
  vested: bigint; // derived: released + releasable, avoids a separate vestedAmount(now) call
  revoked: boolean;
  revocable: boolean;
  start: bigint;
  cliff: bigint;
  duration: bigint;
}

/** Reads a single HalalVesting instance's full schedule. `address` may be undefined (disabled). */
export function useVestingSchedule(address: Address | undefined) {
  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts: address
      ? ([
          { address, abi: halalVestingAbi, functionName: "beneficiary" },
          { address, abi: halalVestingAbi, functionName: "totalAllocation" },
          { address, abi: halalVestingAbi, functionName: "released" },
          { address, abi: halalVestingAbi, functionName: "releasable" },
          { address, abi: halalVestingAbi, functionName: "revoked" },
          { address, abi: halalVestingAbi, functionName: "revocable" },
          { address, abi: halalVestingAbi, functionName: "start" },
          { address, abi: halalVestingAbi, functionName: "cliff" },
          { address, abi: halalVestingAbi, functionName: "duration" },
        ] as const)
      : [],
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const get = <T>(i: number): T | undefined => (data?.[i]?.status === "success" ? (data[i].result as T) : undefined);

  const released = get<bigint>(2);
  const releasable = get<bigint>(3);

  const schedule: VestingSchedule | undefined =
    address && released !== undefined && releasable !== undefined
      ? {
          beneficiary: get<Address>(0)!,
          totalAllocation: get<bigint>(1)!,
          released,
          releasable,
          vested: released + releasable,
          revoked: get<boolean>(4) ?? false,
          revocable: get<boolean>(5) ?? false,
          start: get<bigint>(6)!,
          cliff: get<bigint>(7)!,
          duration: get<bigint>(8)!,
        }
      : undefined;

  return { schedule, isLoading, isError, error, refetch };
}
