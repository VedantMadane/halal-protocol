import { decodeFunctionData, type Abi, type Address, type Hex } from "viem";
import {
  halalPsmAbi,
  halalVestingAbi,
  halalTokenAbi,
  halalDaoAbi,
  halalTimelockAbi,
  cpiReportAdapterAbi,
  erc20Abi,
} from "@/abis";

const ALL_ABIS: Abi[] = [
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
 * Best-effort decode of a proposal's calldata. Callers that know the deployment should pass the
 * ABI for the action's target; otherwise this tries every known ABI as a backwards-compatible
 * generic helper. Falls back to `undefined` for calldata that doesn't match anything we know
 * about — callers should show the raw hex in that case.
 */
export function decodeProposalAction(data: Hex, abis: readonly Abi[] = ALL_ABIS): DecodedAction | undefined {
  if (!data || data === "0x") return undefined;
  for (const abi of abis) {
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
  knownAbis?: ReadonlyMap<string, Abi>,
): ProposalTargetSummary[] {
  return targets.map((target, i) => ({
    target,
    value: values[i] ?? 0n,
    calldata: calldatas[i] ?? "0x",
    decoded: decodeProposalAction(
      calldatas[i] ?? "0x",
      knownAbis ? (knownAbis.get(target.toLowerCase()) ? [knownAbis.get(target.toLowerCase()) as Abi] : []) : ALL_ABIS,
    ),
  }));
}
