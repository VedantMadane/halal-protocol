"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, halalPsmAbi, halalTokenAbi } from "@/abis";
import { useDeployment } from "@/hooks/useDeployment";
import { usePsmUserState } from "@/hooks/usePsmUser";
import { useTxState } from "@/hooks/useTxState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/Button";
import { TxStatus } from "@/components/TxStatus";
import { formatCPIRate, formatToken, formatTokenGrouped } from "@/lib/format";

type Mode = "deposit" | "withdraw";

function safeParseUnits(value: string, decimals: number): bigint | undefined {
  if (!value || Number.isNaN(Number(value)) || Number(value) < 0) return undefined;
  try {
    return parseUnits(value as `${number}`, decimals);
  } catch {
    return undefined;
  }
}

export function SwapForm({ cpiRate }: { cpiRate: bigint | undefined }) {
  const { deployment } = useDeployment();
  const { address, isConnected } = useAccount();
  const user = usePsmUserState();

  const [mode, setMode] = useState<Mode>("deposit");
  const [amountInput, setAmountInput] = useState("");
  const debouncedInput = useDebouncedValue(amountInput, 300);

  if (!deployment) return null;

  return (
    <SwapFormInner
      deploymentPsm={deployment.psm}
      deploymentToken={deployment.token}
      deploymentReserve={deployment.reserveToken}
      reserveSymbolFallback={deployment.reserveTokenSymbol}
      cpiRate={cpiRate}
      address={address}
      isConnected={isConnected}
      user={user}
      mode={mode}
      setMode={setMode}
      amountInput={amountInput}
      setAmountInput={setAmountInput}
      debouncedInput={debouncedInput}
    />
  );
}

function SwapFormInner({
  deploymentPsm,
  deploymentToken,
  deploymentReserve,
  reserveSymbolFallback,
  cpiRate,
  isConnected,
  user,
  mode,
  setMode,
  amountInput,
  setAmountInput,
  debouncedInput,
}: {
  deploymentPsm: `0x${string}`;
  deploymentToken: `0x${string}`;
  deploymentReserve: `0x${string}`;
  reserveSymbolFallback: string;
  cpiRate: bigint | undefined;
  address: `0x${string}` | undefined;
  isConnected: boolean;
  user: ReturnType<typeof usePsmUserState>;
  mode: Mode;
  setMode: (m: Mode) => void;
  amountInput: string;
  setAmountInput: (v: string) => void;
  debouncedInput: string;
}) {
  const { data: reserveDecimals } = useReadContract({
    address: deploymentReserve,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const { data: reserveSymbol } = useReadContract({
    address: deploymentReserve,
    abi: erc20Abi,
    functionName: "symbol",
  });

  const decimals = mode === "deposit" ? (reserveDecimals ?? 18) : 18;
  const symbol = reserveSymbol ?? reserveSymbolFallback;

  const parsedAmount = safeParseUnits(debouncedInput, decimals);

  const { data: previewOut } = useReadContract({
    address: deploymentPsm,
    abi: halalPsmAbi,
    functionName: mode === "deposit" ? "previewDeposit" : "previewWithdraw",
    args: parsedAmount !== undefined && parsedAmount > 0n ? [parsedAmount] : undefined,
    query: { enabled: parsedAmount !== undefined && parsedAmount > 0n },
  });

  const approveTx = useTxState();
  const actionTx = useTxState();

  // Reset the amount + tx state whenever the mode changes.
  useEffect(() => {
    setAmountInput("");
    approveTx.reset();
    actionTx.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (actionTx.isConfirmed) user.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionTx.isConfirmed]);

  useEffect(() => {
    if (approveTx.isConfirmed) user.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveTx.isConfirmed]);

  const maxAmount =
    mode === "deposit"
      ? user.reserveBalance
      : user.redeemableBalance !== undefined && user.hlcBalance !== undefined
        ? user.redeemableBalance < user.hlcBalance
          ? user.redeemableBalance
          : user.hlcBalance
        : undefined;

  const currentAllowance = mode === "deposit" ? user.reserveAllowance : user.hlcAllowance;
  const needsApproval =
    parsedAmount !== undefined && parsedAmount > 0n && currentAllowance !== undefined && currentAllowance < parsedAmount;

  const insufficientBalance =
    parsedAmount !== undefined &&
    parsedAmount > 0n &&
    (mode === "deposit"
      ? user.reserveBalance !== undefined && parsedAmount > user.reserveBalance
      : user.redeemableBalance !== undefined && parsedAmount > user.redeemableBalance);

  function handleMax() {
    if (maxAmount === undefined) return;
    setAmountInput(formatUnits(maxAmount, decimals));
  }

  function handleApprove() {
    if (parsedAmount === undefined) return;
    if (mode === "deposit") {
      approveTx.writeContract({
        address: deploymentReserve,
        abi: erc20Abi,
        functionName: "approve",
        args: [deploymentPsm, parsedAmount],
      });
    } else {
      approveTx.writeContract({
        address: deploymentToken,
        abi: halalTokenAbi,
        functionName: "approve",
        args: [deploymentPsm, parsedAmount],
      });
    }
  }

  function handleAction() {
    if (parsedAmount === undefined) return;
    actionTx.writeContract({
      address: deploymentPsm,
      abi: halalPsmAbi,
      functionName: mode === "deposit" ? "deposit" : "withdraw",
      args: [parsedAmount],
    });
  }

  const fromSymbol = mode === "deposit" ? symbol : "HLC";
  const toSymbol = mode === "deposit" ? "HLC" : symbol;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl bg-background-subtle p-1">
          <button
            type="button"
            onClick={() => setMode("deposit")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "deposit" ? "bg-card text-foreground shadow-sm" : "text-muted"
            }`}
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setMode("withdraw")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "withdraw" ? "bg-card text-foreground shadow-sm" : "text-muted"
            }`}
          >
            Withdraw
          </button>
        </div>
        <span className="text-xs text-muted">
          Rate: <span className="tabular font-medium text-foreground">{formatCPIRate(cpiRate)}</span> HLC/{symbol}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>You send</span>
          {isConnected && (
            <button type="button" onClick={handleMax} className="font-medium text-primary hover:underline">
              Max: {formatToken(mode === "deposit" ? user.reserveBalance : maxAmount, decimals)} {fromSymbol}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-card-border bg-background-subtle px-4 py-3">
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={amountInput}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountInput(v);
            }}
            className="w-full bg-transparent text-lg font-medium outline-none tabular"
          />
          <span className="shrink-0 text-sm font-medium text-muted">{fromSymbol}</span>
        </div>

        <div className="flex justify-center text-muted">↓</div>

        <div className="flex items-center gap-3 rounded-xl border border-card-border px-4 py-3">
          <span className="tabular w-full text-lg font-medium">
            {previewOut !== undefined ? formatToken(previewOut as bigint, mode === "deposit" ? 18 : decimals) : "0.0"}
          </span>
          <span className="shrink-0 text-sm font-medium text-muted">{toSymbol}</span>
        </div>
      </div>

      {mode === "withdraw" && isConnected && (
        <p className="text-xs text-muted-foreground">
          You can redeem up to{" "}
          <span className="tabular font-medium text-foreground">{formatTokenGrouped(user.redeemableBalance, 18)} HLC</span>{" "}
          here — only HLC you personally minted via deposit and haven&apos;t yet redeemed. HLC received by transfer or
          held from vesting can&apos;t be withdrawn through the PSM.
        </p>
      )}

      {!isConnected ? (
        <Button className="w-full" disabled>
          Connect wallet to continue
        </Button>
      ) : insufficientBalance ? (
        <Button className="w-full" disabled>
          Insufficient {mode === "withdraw" ? "redeemable balance" : `${fromSymbol} balance`}
        </Button>
      ) : needsApproval ? (
        <Button className="w-full" onClick={handleApprove} loading={approveTx.isPending || approveTx.isConfirming}>
          Approve {fromSymbol}
        </Button>
      ) : (
        <Button
          className="w-full"
          onClick={handleAction}
          disabled={parsedAmount === undefined || parsedAmount === 0n}
          loading={actionTx.isPending || actionTx.isConfirming}
        >
          {mode === "deposit" ? "Deposit" : "Withdraw"}
        </Button>
      )}

      <TxStatus {...approveTx} pendingLabel="Confirm approval in your wallet…" successLabel="Approval confirmed." />
      <TxStatus
        {...actionTx}
        pendingLabel={`Confirm ${mode} in your wallet…`}
        successLabel={mode === "deposit" ? "Deposit confirmed — HLC minted to your wallet." : "Withdrawal confirmed."}
      />
    </div>
  );
}
