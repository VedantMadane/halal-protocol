"use client";

import { Alert } from "@/components/ui/Alert";
import { useDeployment } from "@/hooks/useDeployment";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { getFriendlyErrorMessage } from "@/lib/errors";

/** Visible warning for a configured deployment that cannot be proven to be correctly wired. */
export function DeploymentIntegrityBanner() {
  const { deployment } = useDeployment();
  const integrity = useDeploymentIntegrity();

  if (!deployment || integrity.isVerified) return null;
  if (integrity.isChecking) {
    return <Alert tone="info">Verifying the configured Halal contracts on this network…</Alert>;
  }

  return (
    <Alert tone="danger" title="Deployment configuration could not be verified">
      {integrity.isError
        ? `${getFriendlyErrorMessage(integrity.error)} Do not sign protocol transactions until the network and contract addresses are corrected.`
        : "The configured addresses do not match the expected Halal contract wiring. Do not sign protocol transactions until they are corrected."}
      <button type="button" onClick={() => void integrity.refetch()} className="ml-1 font-medium underline">
        Retry
      </button>
    </Alert>
  );
}
