"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { NotDeployedState } from "@/components/NotDeployedState";
import { VotingPowerCard } from "@/components/governance/VotingPowerCard";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { useDeployment } from "@/hooks/useDeployment";
import { useProposals } from "@/hooks/useProposals";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { DeploymentIntegrityBanner } from "@/components/DeploymentIntegrityBanner";

export default function GovernancePage() {
  const { isDeployed } = useDeployment();
  const { proposals, isLoading, isError, error } = useProposals();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Governance"
        description="Propose, vote on, and execute changes to the Halal protocol. Every action flows through a 2-day timelock after passing."
        action={
          isDeployed && (
            <Link href="/governance/new">
              <Button>New proposal</Button>
            </Link>
          )
        }
      />

      {!isDeployed ? (
        <NotDeployedState />
      ) : (
        <div className="space-y-6">
          <DeploymentIntegrityBanner />
          <VotingPowerCard />

          {isError && <Alert tone="danger" title="Couldn't load proposals">{getFriendlyErrorMessage(error)}</Alert>}

          {isLoading && !isError && (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}

          {!isLoading && !isError && proposals.length === 0 && (
            <EmptyState
              title="No proposals yet"
              description="Once someone with enough delegated voting power creates a proposal, it'll show up here."
              action={
                <Link href="/governance/new">
                  <Button variant="secondary" size="sm">
                    Create the first proposal
                  </Button>
                </Link>
              }
            />
          )}

          <div className="space-y-3">
            {proposals.map((p) => (
              <ProposalCard key={p.proposalId.toString()} proposal={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
