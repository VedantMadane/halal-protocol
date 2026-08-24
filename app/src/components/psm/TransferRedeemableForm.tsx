"use client";

import { useEffect, useState } from "react";
import { isAddress, parseUnits, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { halalPsmAbi, halalTokenAbi } from "@/abis";
import { useDeployment } from "@/hooks/useDeployment";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { usePsmUserState } from "@/hooks/usePsmUser";
import { useTxState } from "@/hooks/useTxState";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TxStatus } from "@/components/TxStatus";
import { formatTokenGrouped } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

function safeParseHlc(value: string): bigint | undefined {
  if (!value || !/^\d*\.?\d*$/.test(value)) return undefined;
  try {
    return parseUnits(value as `${number}`, 18);
  } catch {
    return undefined;
  }
}

export function TransferRedeemableForm() {
  const { deployment } = useDeployment();
  const deploymentIntegrity = useDeploymentIntegrity();
  const { isConnected } = useAccount();
  const user = usePsmUserState();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const approveTx = useTxState();
  const transferTx = useTxState();
  const cancelTx = useTxState();

  useEffect(() => {
    if (approveTx.isConfirmed || transferTx.isConfirmed || cancelTx.isConfirmed) user.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveTx.isConfirmed, transferTx.isConfirmed, cancelTx.isConfirmed]);

  if (!deployment) return null;

  const parsedAmount = safeParseHlc(amount);
  const validRecipient = isAddress(recipient) && recipient.toLowerCase() !== zeroAddress;
  const hasBalance =
    parsedAmount !== undefined &&
    parsedAmount > 0n &&
    user.redeemableBalance !== undefined &&
    user.hlcBalance !== undefined &&
    parsedAmount <= user.redeemableBalance &&
    parsedAmount <= user.hlcBalance;
  const walletDataReady =
    !user.isLoading &&
    !user.isError &&
    user.redeemableBalance !== undefined &&
    user.hlcBalance !== undefined &&
    user.hlcAllowance !== undefined;
  const canAct = walletDataReady && hasBalance;
  const needsApproval =
    canAct && user.hlcAllowance !== undefined && user.hlcAllowance < (parsedAmount as bigint);
  const canSubmit = isConnected && validRecipient && canAct;

  function handleMax() {
    if (user.redeemableBalance === undefined || user.hlcBalance === undefined) return;
    const max = user.redeemableBalance < user.hlcBalance ? user.redeemableBalance : user.hlcBalance;
    setAmount(formatTokenGrouped(max, 18, 18));
  }

  function handleApprove() {
    if (!canAct || parsedAmount === undefined) return;
    approveTx.writeContract({
      address: deployment!.token,
      abi: halalTokenAbi,
      functionName: "approve",
      args: [deployment!.psm, parsedAmount],
    });
  }

  function handleTransfer() {
    if (!canSubmit || parsedAmount === undefined || !isAddress(recipient)) return;
    transferTx.writeContract({
      address: deployment!.psm,
      abi: halalPsmAbi,
      functionName: "transferRedeemable",
      args: [recipient, parsedAmount],
    });
  }

  function handleCancel() {
    if (!isConnected || !canAct || parsedAmount === undefined) return;
    cancelTx.writeContract({
      address: deployment!.psm,
      abi: halalPsmAbi,
      functionName: "cancelRedeemable",
      args: [parsedAmount],
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Transfer HLC minted through this PSM together with its redemption credit. A regular HLC transfer does not
        transfer the credit.
      </p>

      <Alert tone="warning" title="Retiring a claim is irreversible">
        The retirement action burns the selected HLC and releases its redemption claim without returning reserve.
      </Alert>

      {user.isError && (
        <Alert tone="danger" title="Wallet data could not be loaded">
          {getFriendlyErrorMessage(user.error)} Refresh the page or check your network before submitting.
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <label htmlFor="redeemable-recipient">Recipient</label>
        </div>
        <input
          id="redeemable-recipient"
          inputMode="text"
          placeholder="0x…"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value.trim())}
          className="w-full rounded-xl border border-card-border bg-background-subtle px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {recipient && !validRecipient && <p className="text-xs text-danger">Enter a valid non-zero address.</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <label htmlFor="redeemable-amount">Amount</label>
          {isConnected && (
            <button
              type="button"
              onClick={handleMax}
              disabled={user.redeemableBalance === undefined || user.hlcBalance === undefined}
              className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Max: {formatTokenGrouped(user.redeemableBalance !== undefined && user.hlcBalance !== undefined
                ? user.redeemableBalance < user.hlcBalance ? user.redeemableBalance : user.hlcBalance
                : undefined)} HLC
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-card-border bg-background-subtle px-4 py-3">
          <input
            id="redeemable-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "" || /^\d*\.?\d*$/.test(value)) setAmount(value);
            }}
            className="w-full bg-transparent text-lg font-medium outline-none tabular"
          />
          <span className="shrink-0 text-sm font-medium text-muted">HLC</span>
        </div>
      </div>

      {!isConnected ? (
        <Button className="w-full" disabled>Connect wallet to continue</Button>
      ) : !deploymentIntegrity.isVerified ? (
        <Button className="w-full" disabled>
          {deploymentIntegrity.isChecking ? "Verifying deployment" : "Deployment not verified"}
        </Button>
      ) : !walletDataReady ? (
        <Button className="w-full" disabled>Waiting for wallet data</Button>
      ) : !hasBalance ? (
        <Button className="w-full" disabled>Insufficient redeemable HLC</Button>
      ) : needsApproval ? (
        <Button className="w-full" onClick={handleApprove} loading={approveTx.isPending || approveTx.isConfirming}>
          Approve HLC
        </Button>
      ) : (
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={handleTransfer}
            disabled={!canSubmit}
            loading={transferTx.isPending || transferTx.isConfirming}
          >
            {validRecipient ? "Transfer redemption credit" : "Enter a valid recipient"}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={handleCancel}
            loading={cancelTx.isPending || cancelTx.isConfirming}
          >
            Retire claim without reserve
          </Button>
        </div>
      )}

      <TxStatus {...approveTx} pendingLabel="Confirm HLC approval in your wallet…" successLabel="HLC approval confirmed." />
      <TxStatus {...transferTx} pendingLabel="Confirm transfer in your wallet…" successLabel="HLC and redemption credit transferred." />
      <TxStatus
        {...cancelTx}
        pendingLabel="Confirm claim retirement in your wallet…"
        successLabel="HLC burned and redemption claim retired."
      />
    </div>
  );
}
