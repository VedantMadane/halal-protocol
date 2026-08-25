import { Alert } from "@/components/ui/Alert";
import type { PsmSafetyState } from "@/hooks/usePsmSafety";

export function PsmSafetyAlert({ safety }: { safety: PsmSafetyState }) {
  if (safety.depositBlockedReason) {
    return (
      <Alert tone="danger" title="New PSM deposits are paused">
        {safety.depositBlockedReason} Existing users can still attempt withdrawals of their own redeemable credit.
      </Alert>
    );
  }

  if (safety.updateOverdue) {
    return (
      <Alert tone="warning" title="CPI update overdue">
        The normal updater cadence has elapsed. The current rate remains usable, but operators should verify the CPI
        feed and updater before relying on new protocol activity.
      </Alert>
    );
  }

  return null;
}
