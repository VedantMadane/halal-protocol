import type { Address, Hex } from "viem";
import { summarizeProposalActions } from "@/lib/decodeProposalAction";
import { formatUnits } from "viem";
import { shortAddress } from "@/lib/format";

function formatArg(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(formatArg).join(", ")}]`;
  return String(value);
}

export function ActionsList({
  targets,
  values,
  calldatas,
}: {
  targets: readonly Address[];
  values: readonly bigint[];
  calldatas: readonly Hex[];
}) {
  const actions = summarizeProposalActions(targets, values, calldatas);

  return (
    <ol className="space-y-3">
      {actions.map((action, i) => (
        <li key={i} className="rounded-xl border border-card-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground" title={action.target}>
              {shortAddress(action.target)}
            </span>
            {action.value > 0n && (
              <span className="text-xs text-muted">{formatUnits(action.value, 18)} ETH value</span>
            )}
          </div>
          {action.decoded ? (
            <p className="mt-1.5 font-mono text-sm">
              <span className="font-semibold text-primary">{action.decoded.functionName}</span>(
              {action.decoded.args.map(formatArg).join(", ")})
            </p>
          ) : (
            <p className="mt-1.5 break-all font-mono text-xs text-muted-foreground">{action.calldata}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
