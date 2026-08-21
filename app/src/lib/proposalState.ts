/** Governor.ProposalState enum, mirrored from OpenZeppelin's Governor.sol. */
export const PROPOSAL_STATE_LABELS = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
] as const;

export type ProposalStateLabel = (typeof PROPOSAL_STATE_LABELS)[number];

export function proposalStateLabel(state: number | undefined): ProposalStateLabel | "Unknown" {
  if (state === undefined || state < 0 || state >= PROPOSAL_STATE_LABELS.length) return "Unknown";
  return PROPOSAL_STATE_LABELS[state];
}

/** Tailwind color classes per state, tuned for both light and dark mode. */
export function proposalStateBadgeClasses(state: number | undefined): string {
  switch (state) {
    case 0: // Pending
      return "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300";
    case 1: // Active
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
    case 2: // Canceled
      return "bg-slate-200 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400 line-through";
    case 3: // Defeated
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    case 4: // Succeeded
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case 5: // Queued
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case 6: // Expired
      return "bg-slate-200 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400";
    case 7: // Executed
      return "bg-emerald-600 text-white dark:bg-emerald-500/80 dark:text-emerald-50";
    default:
      return "bg-slate-200 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400";
  }
}
