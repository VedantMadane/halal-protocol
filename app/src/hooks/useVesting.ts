"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { halalVestingAbi } from "@/abis";
import { hasReadFailure, partialReadError } from "@/lib/readResults";

export interface VestingSchedule {
  beneficiary: Address;
  pendingBeneficiary: Address;
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
          { address, abi: halalVestingAbi, functionName: "pendingBeneficiary" },
        ] as const)
      : [],
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const readFailed = hasReadFailure(data);

  const get = <T>(i: number): T | undefined => (data?.[i]?.status === "success" ? (data[i].result as T) : undefined);

  const released = get<bigint>(2);
  const releasable = get<bigint>(3);
  const beneficiary = get<Address>(0);
  const totalAllocation = get<bigint>(1);
  const revoked = get<boolean>(4);
  const revocable = get<boolean>(5);
  const start = get<bigint>(6);
  const cliff = get<bigint>(7);
  const duration = get<bigint>(8);
  const pendingBeneficiary = get<Address>(9);

  const schedule: VestingSchedule | undefined =
    address &&
    beneficiary !== undefined &&
    totalAllocation !== undefined &&
    released !== undefined &&
    releasable !== undefined &&
    revoked !== undefined &&
    revocable !== undefined &&
    start !== undefined &&
    cliff !== undefined &&
    duration !== undefined &&
    pendingBeneficiary !== undefined
      ? {
          beneficiary,
          pendingBeneficiary,
          totalAllocation,
          released,
          releasable,
          vested: released + releasable,
          revoked,
          revocable,
          start,
          cliff,
          duration,
        }
      : undefined;

  return { schedule, isLoading, isError: isError || readFailed, error: error ?? (readFailed ? partialReadError() : undefined), refetch };
}
