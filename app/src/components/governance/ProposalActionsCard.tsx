"use client";

import { useEffect } from "react";
import type { Address, Hex } from "viem";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TxStatus } from "@/components/TxStatus";
import { Alert } from "@/components/ui/Alert";
import { useTxState } from "@/hooks/useTxState";
import { halalDaoAbi } from "@/abis";
import { descriptionHash } from "@/lib/format";

interface Props {
  dao: Address;
  proposalId: bigint;
  targets: readonly Address[];
  values: readonly bigint[];
  calldatas: readonly Hex[];
  description: string;
  state: number | undefined;
  hasVoted: boolean | undefined;
  isConnected: boolean;
  votingPower: bigint | undefined;
  onChanged: () => void;
}

const SUPPORT = { against: 0, for: 1, abstain: 2 } as const;

export function ProposalActionsCard({
  dao,
  proposalId,
  targets,
  values,
  calldatas,
  description,
  state,
  hasVoted,
  isConnected,
  votingPower,
  onChanged,
}: Props) {
  const voteTx = useTxState();
  const queueTx = useTxState();
  const executeTx = useTxState();

  const hash = descriptionHash(description);

  useEffect(() => {
    if (voteTx.isConfirmed || queueTx.isConfirmed || executeTx.isConfirmed) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteTx.isConfirmed, queueTx.isConfirmed, executeTx.isConfirmed]);

  function vote(support: number) {
    voteTx.writeContract({
      address: dao,
      abi: halalDaoAbi,
      functionName: "castVote",
      args: [proposalId, support],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {state === 1 && (
          <>
            {!isConnected ? (
              <Alert tone="info">Connect your wallet to vote.</Alert>
            ) : hasVoted ? (
              <Alert tone="success">You&apos;ve already voted on this proposal.</Alert>
            ) : votingPower === 0n ? (
              <Alert tone="warning">
                You have no voting power at this proposal&apos;s snapshot block — delegate before it was created to vote.
              </Alert>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="primary" onClick={() => vote(SUPPORT.for)} loading={voteTx.isPending || voteTx.isConfirming}>
                  For
                </Button>
                <Button variant="danger" onClick={() => vote(SUPPORT.against)} loading={voteTx.isPending || voteTx.isConfirming}>
                  Against
                </Button>
                <Button variant="secondary" onClick={() => vote(SUPPORT.abstain)} loading={voteTx.isPending || voteTx.isConfirming}>
                  Abstain
                </Button>
              </div>
            )}
            <TxStatus {...voteTx} pendingLabel="Confirm vote in your wallet…" successLabel="Vote cast." />
          </>
        )}

        {state === 4 && (
          <>
            <Button
              onClick={() =>
                queueTx.writeContract({
                  address: dao,
                  abi: halalDaoAbi,
                  functionName: "queue",
                  args: [targets, values, calldatas, hash],
                })
              }
              loading={queueTx.isPending || queueTx.isConfirming}
            >
              Queue in timelock
            </Button>
            <TxStatus {...queueTx} pendingLabel="Confirm in your wallet…" successLabel="Queued — executable after the timelock delay." />
          </>
        )}

        {state === 5 && (
          <>
            <Button
              onClick={() =>
                executeTx.writeContract({
                  address: dao,
                  abi: halalDaoAbi,
                  functionName: "execute",
                  args: [targets, values, calldatas, hash],
                })
              }
              loading={executeTx.isPending || executeTx.isConfirming}
            >
              Execute
            </Button>
            <TxStatus {...executeTx} pendingLabel="Confirm in your wallet…" successLabel="Proposal executed." />
          </>
        )}

        {state !== undefined && [0, 2, 3, 6, 7].includes(state) && (
          <p className="text-sm text-muted">
            {state === 0 && "Voting hasn't started yet."}
            {state === 2 && "This proposal was canceled."}
            {state === 3 && "This proposal was defeated — for-votes didn't exceed against-votes, or quorum wasn't met."}
            {state === 6 && "This proposal expired before being executed."}
            {state === 7 && "This proposal has been executed."}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
