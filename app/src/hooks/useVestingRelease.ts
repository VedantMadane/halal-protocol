"use client";

import type { Address } from "viem";
import { halalVestingAbi } from "@/abis";
import { useTxState } from "./useTxState";

/** Wraps HalalVesting.release() — callable by anyone, always sends vested tokens to the beneficiary. */
export function useVestingRelease(vestingAddress: Address | undefined) {
  const tx = useTxState();

  function release() {
    if (!vestingAddress) return;
    tx.writeContract({
      address: vestingAddress,
      abi: halalVestingAbi,
      functionName: "release",
    });
  }

  return { ...tx, release };
}
