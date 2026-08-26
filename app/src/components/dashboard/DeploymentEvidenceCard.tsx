import type { ReactNode } from "react";
import { getChainName } from "@/config/chains";
import type { HalalDeployment } from "@/config/contracts";
import { shortAddress } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

function EvidenceLink({ href, children }: { href: string | undefined; children: ReactNode }) {
  if (!href) return null;
  return (
    <a className="text-sm text-primary underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function DeploymentEvidenceCard({ deployment, chainId }: { deployment: HalalDeployment; chainId: number }) {
  const hasEvidence = Boolean(deployment.explorerUrl || deployment.sourceVerificationUrl || deployment.journalUrl || deployment.cpiPolicyUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment evidence</CardTitle>
        <Badge tone={hasEvidence ? "primary" : "neutral"}>{hasEvidence ? "Registry-backed" : "Local configuration"}</Badge>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-muted">
          {getChainName(chainId)} · deployment block {deployment.deploymentBlock.toString()}
        </p>
        {deployment.deploymentTx && (
          <p className="text-xs text-muted">
            Deployment transaction: <code title={deployment.deploymentTx}>{shortAddress(deployment.deploymentTx, 6)}</code>
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <EvidenceLink href={deployment.explorerUrl}>View deployment transaction</EvidenceLink>
          <EvidenceLink href={deployment.sourceVerificationUrl}>View verified source</EvidenceLink>
          <EvidenceLink href={deployment.journalUrl}>Read deployment journal</EvidenceLink>
          <EvidenceLink href={deployment.cpiPolicyUrl}>Read CPI source policy</EvidenceLink>
        </div>
        {!hasEvidence && (
          <p className="text-xs text-muted">
            This deployment came from local environment configuration. Public deployments should include
            explorer, source-verification, journal, and (when applicable) CPI policy links in the checked-in registry.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
