"use client";

import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { getFriendlyErrorMessage } from "@/lib/errors";

/**
 * Wraps wagmi's write + receipt-wait pair into one status object so components don't each
 * re-derive "pending signature vs confirming vs mined vs reverted" by hand.
 */
export function useTxState() {
  const { writeContract, writeContractAsync, data: hash, error: writeError, isPending, reset } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const error = writeError ?? receiptError;

  return {
    writeContract,
    writeContractAsync,
    hash,
    isPending, // waiting on wallet signature / submission
    isConfirming, // submitted, waiting for a block
    isConfirmed, // mined successfully
    isError: !!error,
    errorMessage: error ? getFriendlyErrorMessage(error) : undefined,
    reset,
  };
}
