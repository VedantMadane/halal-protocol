"use client";

import { useChainId } from "wagmi";
import { Alert } from "./ui/Alert";
import { getExplorerTxUrl } from "@/config/chains";

interface TxStatusProps {
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  isError: boolean;
  errorMessage?: string;
  hash?: string;
  pendingLabel?: string;
  confirmingLabel?: string;
  successLabel?: string;
}

export function TxStatus({
  isPending,
  isConfirming,
  isConfirmed,
  isError,
  errorMessage,
  hash,
  pendingLabel = "Confirm in your wallet…",
  confirmingLabel = "Transaction submitted — waiting for confirmation…",
  successLabel = "Transaction confirmed.",
}: TxStatusProps) {
  const chainId = useChainId();
  const explorerUrl = getExplorerTxUrl(chainId, hash);

  if (isError) {
    return <Alert tone="danger" title="Transaction failed">{errorMessage}</Alert>;
  }
  if (isConfirmed) {
    return (
      <Alert tone="success" title="Success">
        {successLabel}{" "}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="underline">
            View on explorer
          </a>
        )}
      </Alert>
    );
  }
  if (isConfirming) {
    return (
      <Alert tone="info" title="Pending">
        {confirmingLabel}{" "}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="underline">
            View on explorer
          </a>
        )}
      </Alert>
    );
  }
  if (isPending) {
    return <Alert tone="info">{pendingLabel}</Alert>;
  }
  return null;
}
