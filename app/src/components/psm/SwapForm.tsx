"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseSignature, parseUnits, toFunctionSelector } from "viem";
import { useAccount, useBlock, useBytecode, useChainId, useReadContract, useSignTypedData, useSimulateContract } from "wagmi";
import { erc20Abi, halalPsmAbi, halalTokenAbi } from "@/abis";
import { useDeployment } from "@/hooks/useDeployment";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { usePsmUserState } from "@/hooks/usePsmUser";
import { useTxState } from "@/hooks/useTxState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TxStatus } from "@/components/TxStatus";
import { formatCPIRate, formatToken, formatTokenGrouped } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

type Mode = "deposit" | "withdraw";

const DEADLINE_WINDOW = 15n * 60n;
const DEPOSIT_DEADLINE_SELECTOR = toFunctionSelector(
  "function depositWithMinHlcOutAndDeadline(uint256,uint256,uint256)",
);
const WITHDRAW_DEADLINE_SELECTOR = toFunctionSelector(
  "function withdrawWithMinReserveOutAndDeadline(uint256,uint256,uint256)",
);
const WITHDRAW_PERMIT_SELECTOR = toFunctionSelector(
  "function withdrawWithPermit(uint256,uint256,uint256,uint8,bytes32,bytes32)",
);

function safeParseUnits(value: string, decimals: number): bigint | undefined {
  if (!value || !/^\d*\.?\d*$/.test(value)) return undefined;
  try {
    return parseUnits(value as `${number}`, decimals);
  } catch {
    return undefined;
  }
}

export function SwapForm({ cpiRate, depositBlockedReason }: { cpiRate: bigint | undefined; depositBlockedReason?: string }) {
  const { deployment } = useDeployment();
  const deploymentIntegrity = useDeploymentIntegrity();
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
      depositBlockedReason={depositBlockedReason}
      address={address}
      isConnected={isConnected}
      user={user}
      mode={mode}
      setMode={setMode}
      amountInput={amountInput}
      setAmountInput={setAmountInput}
      debouncedInput={debouncedInput}
      deploymentVerified={deploymentIntegrity.isVerified}
      verificationChecking={deploymentIntegrity.isChecking}
    />
  );
}

function SwapFormInner({
  deploymentPsm,
  deploymentToken,
  deploymentReserve,
  reserveSymbolFallback,
  cpiRate,
  depositBlockedReason,
  address,
  isConnected,
  user,
  mode,
  setMode,
  amountInput,
  setAmountInput,
  debouncedInput,
  deploymentVerified,
  verificationChecking,
}: {
  deploymentPsm: `0x${string}`;
  deploymentToken: `0x${string}`;
  deploymentReserve: `0x${string}`;
  reserveSymbolFallback: string;
  cpiRate: bigint | undefined;
  depositBlockedReason?: string;
  address: `0x${string}` | undefined;
  isConnected: boolean;
  user: ReturnType<typeof usePsmUserState>;
  mode: Mode;
  setMode: (m: Mode) => void;
  amountInput: string;
  setAmountInput: (v: string) => void;
  debouncedInput: string;
  deploymentVerified: boolean;
  verificationChecking: boolean;
}) {
  const chainId = useChainId();
  const [slippageBps, setSlippageBps] = useState(50);
  const [permitError, setPermitError] = useState<string>();
  const { signTypedDataAsync, isPending: isSigningPermit } = useSignTypedData();
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
  const { data: psmBytecode } = useBytecode({
    address: deploymentPsm,
    query: { enabled: deploymentVerified },
  });
  const { data: latestBlock } = useBlock({ watch: true });

  // Existing deployments are immutable and predate the deadline entrypoints. Inspecting runtime
  // bytecode lets the UI adopt the safer API automatically without sending an unknown selector to
  // an older PSM. An absent or unreadable bytecode response deliberately falls back to compatibility.
  const runtimeBytecode = psmBytecode?.toLowerCase() ?? "";
  const supportsDeadlineActions =
    runtimeBytecode.includes(DEPOSIT_DEADLINE_SELECTOR.slice(2).toLowerCase()) &&
    runtimeBytecode.includes(WITHDRAW_DEADLINE_SELECTOR.slice(2).toLowerCase());
  const supportsWithdrawPermit = runtimeBytecode.includes(WITHDRAW_PERMIT_SELECTOR.slice(2).toLowerCase());
  const deadline = latestBlock?.timestamp !== undefined ? latestBlock.timestamp + DEADLINE_WINDOW : undefined;

  const { data: permitNonce } = useReadContract({
    address: deploymentToken,
    abi: halalTokenAbi,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && mode === "withdraw" },
  });

  const reserveMetadataReady = reserveDecimals !== undefined;
  // Reserve amounts use the reserve token's native precision; HLC is always 18 decimals.
  const inputDecimals = mode === "deposit" ? (reserveDecimals ?? 18) : 18;
  const outputDecimals = mode === "deposit" ? 18 : (reserveDecimals ?? 18);
  const symbol = reserveSymbol ?? reserveSymbolFallback;

  const readError = user.isError || reserveDecimalsError;
  const readErrorMessage = getFriendlyErrorMessage(user.error ?? reserveMetadataError);
  const walletDataReady =
    !user.isLoading &&
    !user.isError &&
    (mode === "deposit"
      ? user.reserveBalance !== undefined && user.reserveAllowance !== undefined
      : user.hlcBalance !== undefined && user.hlcAllowance !== undefined && user.redeemableBalance !== undefined);

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
    walletDataReady &&
    reserveMetadataReady &&
    parsedAmount !== undefined &&
    parsedAmount > 0n &&
    currentAllowance !== undefined &&
    currentAllowance < parsedAmount;

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

  // Preflight the exact bounded call before asking the wallet to sign. This catches stale quotes,
  // reserve shortfalls, and allowance/balance changes without spending gas or presenting a doomed
  // transaction to the user. The contract remains the final authority at execution time.
  const actionSimulation = useSimulateContract({
    address: deploymentPsm,
    abi: halalPsmAbi,
    functionName:
      mode === "deposit"
        ? supportsDeadlineActions
          ? "depositWithMinHlcOutAndDeadline"
          : "depositWithMinHlcOut"
        : supportsDeadlineActions
          ? "withdrawWithMinReserveOutAndDeadline"
          : "withdrawWithMinReserveOut",
    args:
      supportsDeadlineActions
        ? [parsedAmount ?? 0n, minOutput ?? 0n, deadline ?? 0n]
        : [parsedAmount ?? 0n, minOutput ?? 0n],
    query: {
      enabled:
        deploymentVerified &&
        walletDataReady &&
        reserveMetadataReady &&
        parsedAmount !== undefined &&
        parsedAmount > 0n &&
        minOutput !== undefined &&
        (!supportsDeadlineActions || deadline !== undefined) &&
        !needsApproval &&
        !insufficientBalance &&
        (mode === "withdraw" || depositBlockedReason === undefined),
    },
  });

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
    if (!actionSimulation.data?.request) return;
    actionTx.writeContract(actionSimulation.data.request);
  }

  async function handleWithdrawWithPermit() {
    if (
      mode !== "withdraw" ||
      !address ||
      parsedAmount === undefined ||
      parsedAmount === 0n ||
      minOutput === undefined ||
      deadline === undefined ||
      permitNonce === undefined
    ) {
      return;
    }

    setPermitError(undefined);
    try {
      const signature = await signTypedDataAsync({
        domain: {
          name: "Halal",
          version: "1",
          chainId,
          verifyingContract: deploymentToken,
        },
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit",
        message: {
          owner: address,
          spender: deploymentPsm,
          value: parsedAmount,
          nonce: permitNonce,
          deadline,
        },
      });
      const { v, r, s } = parseSignature(signature);
      if (v === undefined) throw new Error("Wallet returned an incomplete permit signature.");
      actionTx.writeContract({
        address: deploymentPsm,
        abi: halalPsmAbi,
        functionName: "withdrawWithPermit",
        args: [parsedAmount, minOutput, deadline, Number(v), r, s],
      });
    } catch (error) {
      setPermitError(getFriendlyErrorMessage(error));
    }
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
      {mode === "deposit" && depositBlockedReason && (
        <Alert tone="danger" title="Deposit paused by protocol safety checks">
          {depositBlockedReason}
        </Alert>
      )}
      {permitError && (
        <Alert tone="danger" title="Permit withdrawal was not signed">
          {permitError} You can approve HLC first and retry the withdrawal.
        </Alert>
      )}
      {actionSimulation.isError && (
        <Alert tone="danger" title="Transaction preflight failed">
          {getFriendlyErrorMessage(actionSimulation.error)} Refresh the quote or update your balance before signing.
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
      ) : !deploymentVerified ? (
        <Button className="w-full" disabled>
          {verificationChecking ? "Verifying deployment" : "Deployment not verified"}
        </Button>
      ) : mode === "deposit" && depositBlockedReason ? (
        <Button className="w-full" disabled>
          Deposits paused until the protocol is healthy
        </Button>
      ) : !walletDataReady || !reserveMetadataReady ? (
        <Button className="w-full" disabled>
          Reading wallet and reserve data
        </Button>
      ) : insufficientBalance ? (
        <Button className="w-full" disabled>
          Insufficient {mode === "withdraw" ? (insufficientHlcBalance ? "HLC balance" : "redeemable balance") : `${fromSymbol} balance`}
        </Button>
      ) : zeroOutput ? (
        <Button className="w-full" disabled>
          Amount too small
        </Button>
      ) : actionSimulation.isLoading ? (
        <Button className="w-full" disabled>
          Checking transaction
        </Button>
      ) : actionSimulation.isError ? (
        <Button className="w-full" disabled>
          Transaction would fail
        </Button>
      ) : needsApproval ? (
        mode === "withdraw" && supportsWithdrawPermit ? (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleWithdrawWithPermit}
              disabled={permitNonce === undefined || deadline === undefined || minOutput === undefined}
              loading={isSigningPermit || actionTx.isPending || actionTx.isConfirming}
            >
              Sign & withdraw in one transaction
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={handleApprove}
              loading={approveTx.isPending || approveTx.isConfirming}
            >
              Approve HLC first
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={handleApprove} loading={approveTx.isPending || approveTx.isConfirming}>
            Approve {fromSymbol}
          </Button>
        )
      ) : (
          <Button
            className="w-full"
            onClick={handleAction}
          disabled={
            !reserveMetadataReady ||
            parsedAmount === undefined ||
            parsedAmount === 0n ||
            minOutput === undefined ||
            zeroOutput ||
            !actionSimulation.data?.request
          }
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
