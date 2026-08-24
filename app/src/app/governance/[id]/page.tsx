"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotDeployedState } from "@/components/NotDeployedState";
import { VoteBar } from "@/components/governance/VoteBar";
import { ActionsList } from "@/components/governance/ActionsList";
import { ProposalActionsCard } from "@/components/governance/ProposalActionsCard";
import { useDeployment } from "@/hooks/useDeployment";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { useProposalEvent } from "@/hooks/useProposals";
import { useProposalDetail } from "@/hooks/useProposalDetail";
import { proposalStateBadgeClasses, proposalStateLabel } from "@/lib/proposalState";
import { formatTokenGrouped, shortAddress, shortProposalId } from "@/lib/format";

function parseProposalId(raw: string | string[] | undefined): bigint | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalId = parseProposalId(params?.id);

  const { deployment, isDeployed } = useDeployment();
  const deploymentIntegrity = useDeploymentIntegrity();
  const { isConnected } = useAccount();

  const { event, isLoading: isEventLoading } = useProposalEvent(proposalId);
  const detail = useProposalDetail(proposalId);

  if (!isDeployed || !deployment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Proposal" />
        <NotDeployedState />
      </div>
    );
  }

  if (proposalId === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Proposal" />
        <EmptyState title="Invalid proposal id" description="That doesn't look like a valid proposal id." />
      </div>
    );
  }

  const isLoading = isEventLoading || detail.isLoading;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/governance" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← All proposals
      </Link>

      {isLoading && !event ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !event ? (
        <EmptyState
          title="Proposal not found"
          description="No ProposalCreated event matches this id in the range scanned. It may not exist on this network."
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{shortProposalId(event.proposalId)}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.description.split("\n")[0]}</h1>
              <p className="mt-1 text-sm text-muted">Proposed by {shortAddress(event.proposer)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${proposalStateBadgeClasses(detail.state)}`}>
              {proposalStateLabel(detail.state)}
            </span>
          </div>

          {detail.isError && (
            <Alert tone="danger" title="Couldn't load live proposal state">
              Showing cached data from the proposal creation event only.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{event.description}</p>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions ({event.targets.length})</CardTitle>
                </CardHeader>
                <CardBody>
                  <ActionsList targets={event.targets} values={event.values} calldatas={event.calldatas} />
                </CardBody>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Votes</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  <VoteBar against={detail.votes?.against} forVotes={detail.votes?.for} abstain={detail.votes?.abstain} />
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted">Quorum required</dt>
                      <dd className="tabular font-medium">{formatTokenGrouped(detail.quorumNeeded, 18, 0)} HLC</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Snapshot block</dt>
                      <dd className="tabular font-medium">{detail.snapshot?.toString() ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Deadline block</dt>
                      <dd className="tabular font-medium">{detail.deadline?.toString() ?? "—"}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>

              <ProposalActionsCard
                dao={deployment.dao}
                proposalId={event.proposalId}
                targets={event.targets}
                values={event.values}
                calldatas={event.calldatas}
                description={event.description}
                state={detail.state}
                hasVoted={detail.hasVoted}
                isConnected={isConnected}
                votingPower={detail.votingPowerAtSnapshot}
                readError={detail.isError}
                deploymentVerified={deploymentIntegrity.isVerified}
                verificationChecking={deploymentIntegrity.isChecking}
                onChanged={detail.refetch}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
