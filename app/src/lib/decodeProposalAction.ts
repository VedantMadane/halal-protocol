import { decodeFunctionData, type Address, type Hex } from "viem";
import {
  halalPsmAbi,
  halalVestingAbi,
  halalTokenAbi,
  halalDaoAbi,
  halalTimelockAbi,
  cpiReportAdapterAbi,
  erc20Abi,
} from "@/abis";

const ALL_ABIS = [
  halalPsmAbi,
  halalVestingAbi,
  halalTokenAbi,
  halalDaoAbi,
  halalTimelockAbi,
  cpiReportAdapterAbi,
  erc20Abi,
];

export interface DecodedAction {
  functionName: string;
  args: readonly unknown[];
}

/**
 * Best-effort decode of a proposal's calldata against every known Halal contract ABI (there's no
 * on-chain registry mapping target address -> ABI, so this just tries each until one matches the
 * selector). Falls back to `undefined` for calldata that doesn't match anything we know about —
 * callers should show the raw hex in that case.
 */
export function decodeProposalAction(data: Hex): DecodedAction | undefined {
  if (!data || data === "0x") return undefined;
  for (const abi of ALL_ABIS) {
    try {
      const decoded = decodeFunctionData({ abi, data });
      return { functionName: decoded.functionName, args: (decoded.args ?? []) as readonly unknown[] };
    } catch {
      continue;
    }
  }
  return undefined;
}

export interface ProposalTargetSummary {
  target: Address;
  value: bigint;
  calldata: Hex;
  decoded: DecodedAction | undefined;
}

export function summarizeProposalActions(
  targets: readonly Address[],
  values: readonly bigint[],
  calldatas: readonly Hex[],
): ProposalTargetSummary[] {
  return targets.map((target, i) => ({
    target,
    value: values[i] ?? 0n,
    calldata: calldatas[i] ?? "0x",
    decoded: decodeProposalAction(calldatas[i] ?? "0x"),
  }));
}
