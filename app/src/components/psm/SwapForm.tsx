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
import { Alert } from "@/components/ui/Alert";
import { TxStatus } from "@/components/TxStatus";
import { formatCPIRate, formatToken, formatTokenGrouped } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

type Mode = "deposit" | "withdraw";

function safeParseUnits(value: string, decimals: number): bigint | undefined {
  if (!value || !/^\d*\.?\d*$/.test(value)) return undefined;
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
  const [slippageBps, setSlippageBps] = useState(50);
  const { data: reserveDecimals, isError: reserveDecimalsError, error: reserveMetadataError } = useReadContract({
    address: deploymentReserve,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const { data: reserveSymbol } = useReadContract({
    address: deploymentReserve,
    abi: erc20Abi,
    functionName: "symbol",
  });

  const reserveMetadataReady = reserveDecimals !== undefined;
  // Reserve amounts use the reserve token's native precision; HLC is always 18 decimals.
  const inputDecimals = mode === "deposit" ? (reserveDecimals ?? 18) : 18;
  const outputDecimals = mode === "deposit" ? 18 : (reserveDecimals ?? 18);
  const symbol = reserveSymbol ?? reserveSymbolFallback;

  const readError = user.isError || reserveDecimalsError;
  const readErrorMessage = getFriendlyErrorMessage(user.error ?? reserveMetadataError);

  const parsedAmount = reserveMetadataReady ? safeParseUnits(debouncedInput, inputDecimals) : undefined;

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
      : (user.redeemableBalance !== undefined && parsedAmount > user.redeemableBalance) ||
        (user.hlcBalance !== undefined && parsedAmount > user.hlcBalance));
  const insufficientHlcBalance =
    mode === "withdraw" && user.hlcBalance !== undefined && parsedAmount !== undefined && parsedAmount > user.hlcBalance;

  const zeroOutput = parsedAmount !== undefined && parsedAmount > 0n && previewOut === 0n;
  const minOutput =
    previewOut !== undefined && previewOut > 0n
      ? (() => {
          const adjusted = (previewOut * BigInt(10_000 - slippageBps)) / 10_000n;
          return adjusted > 0n ? adjusted : 1n;
        })()
      : undefined;

  function handleMax() {
    if (maxAmount === undefined || !reserveMetadataReady) return;
    setAmountInput(formatUnits(maxAmount, inputDecimals));
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
    if (parsedAmount === undefined || minOutput === undefined) return;
    actionTx.writeContract({
      address: deploymentPsm,
      abi: halalPsmAbi,
      functionName: mode === "deposit" ? "depositWithMinHlcOut" : "withdrawWithMinReserveOut",
      args: [parsedAmount, minOutput],
    });
  }

  const fromSymbol = mode === "deposit" ? symbol : "HLC";
  const toSymbol = mode === "deposit" ? "HLC" : symbol;

  return (
    <div className="space-y-4">
      {readError && (
        <Alert tone="danger" title="Wallet or reserve data could not be loaded">
          {readErrorMessage} Refresh the page or check your network before submitting a transaction.
        </Alert>
      )}
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
          Rate: <span className="tabular font-medium text-foreground">{formatCPIRate(cpiRate)}</span> {symbol}/HLC
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <label htmlFor="slippage-tolerance">Slippage tolerance</label>
        <select
          id="slippage-tolerance"
          value={slippageBps}
          onChange={(event) => setSlippageBps(Number(event.target.value))}
          className="rounded-lg border border-card-border bg-background-subtle px-2 py-1 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value={10}>0.1%</option>
          <option value={50}>0.5%</option>
          <option value={100}>1.0%</option>
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>You send</span>
          {isConnected && (
            <button
              type="button"
              onClick={handleMax}
              disabled={!reserveMetadataReady || maxAmount === undefined}
              className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Max: {formatToken(mode === "deposit" ? user.reserveBalance : maxAmount, inputDecimals)} {fromSymbol}
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
            {previewOut !== undefined ? formatToken(previewOut as bigint, outputDecimals) : "0.0"}
          </span>
          <span className="shrink-0 text-sm font-medium text-muted">{toSymbol}</span>
        </div>
        {minOutput !== undefined && (
          <p className="text-right text-xs text-muted">
            Minimum received ({(slippageBps / 100).toFixed(1)}% tolerance): {formatToken(minOutput, outputDecimals)} {toSymbol}
          </p>
        )}
      </div>

      {!reserveMetadataReady && (
        <p className="text-xs text-muted" role="status">
          {reserveDecimalsError ? `Unable to read ${reserveSymbolFallback} token metadata.` : `Reading ${reserveSymbolFallback} token decimals…`}
        </p>
      )}

      {mode === "withdraw" && isConnected && (
        <p className="text-xs text-muted-foreground">
          You can redeem up to{" "}
          <span className="tabular font-medium text-foreground">{formatTokenGrouped(user.redeemableBalance, 18)} HLC</span>{" "}
          here — only HLC you personally minted via deposit and haven&apos;t yet redeemed. HLC received by transfer or
          held from vesting can&apos;t be withdrawn through the PSM.
        </p>
      )}

      {zeroOutput && (
        <p className="text-xs text-accent" role="alert">
          This amount is too small to produce any {mode === "deposit" ? "HLC" : symbol}. Increase the amount.
        </p>
      )}

      {!isConnected ? (
        <Button className="w-full" disabled>
          Connect wallet to continue
        </Button>
      ) : readError ? (
        <Button className="w-full" disabled>
          Waiting for wallet data
        </Button>
      ) : insufficientBalance ? (
        <Button className="w-full" disabled>
          Insufficient {mode === "withdraw" ? (insufficientHlcBalance ? "HLC balance" : "redeemable balance") : `${fromSymbol} balance`}
        </Button>
      ) : zeroOutput ? (
        <Button className="w-full" disabled>
          Amount too small
        </Button>
      ) : needsApproval ? (
        <Button className="w-full" onClick={handleApprove} loading={approveTx.isPending || approveTx.isConfirming}>
          Approve {fromSymbol}
        </Button>
      ) : (
          <Button
            className="w-full"
            onClick={handleAction}
          disabled={!reserveMetadataReady || parsedAmount === undefined || parsedAmount === 0n || minOutput === undefined || zeroOutput}
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
