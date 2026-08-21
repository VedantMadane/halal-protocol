import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VoteBar } from "./VoteBar";
import type { ProposalListItem } from "@/hooks/useProposals";
import { proposalStateBadgeClasses, proposalStateLabel } from "@/lib/proposalState";
import { shortAddress, shortProposalId } from "@/lib/format";

function descriptionTitle(description: string): string {
  const firstLine = description.split("\n")[0].trim();
  return firstLine.length > 0 ? firstLine : "(no description)";
}

export function ProposalCard({ proposal }: { proposal: ProposalListItem }) {
  return (
    <Link href={`/governance/${proposal.proposalId.toString()}`}>
      <Card className="transition-colors hover:border-primary/40">
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{descriptionTitle(proposal.description)}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {shortProposalId(proposal.proposalId)} · proposed by {shortAddress(proposal.proposer)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${proposalStateBadgeClasses(proposal.state)}`}
            >
              {proposalStateLabel(proposal.state)}
            </span>
          </div>
          <VoteBar against={proposal.votes?.against} forVotes={proposal.votes?.for} abstain={proposal.votes?.abstain} compact />
          <div className="flex items-center justify-between text-xs text-muted">
            <Badge tone="neutral">{proposal.targets.length} action{proposal.targets.length === 1 ? "" : "s"}</Badge>
            <span>Voting ends at block {proposal.voteEnd.toString()}</span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
