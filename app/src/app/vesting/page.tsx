"use client";

import { useAccount } from "wagmi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotDeployedState } from "@/components/NotDeployedState";
import { VestingScheduleCard } from "@/components/vesting/VestingScheduleCard";
import { VestingLookup } from "@/components/vesting/VestingLookup";
import { useDeployment } from "@/hooks/useDeployment";
import { useVestingSchedule } from "@/hooks/useVesting";

export default function VestingPage() {
  const { deployment, isDeployed } = useDeployment();
  const { address, isConnected } = useAccount();

  const team = useVestingSchedule(deployment?.teamVesting);
  const treasury = useVestingSchedule(deployment?.treasuryVesting);

  const isTeamBeneficiary =
    isConnected && !!address && !!team.schedule && team.schedule.beneficiary.toLowerCase() === address.toLowerCase();
  const isTreasuryBeneficiary =
    isConnected &&
    !!address &&
    !!treasury.schedule &&
    treasury.schedule.beneficiary.toLowerCase() === address.toLowerCase();
  const isAnyBeneficiary = isTeamBeneficiary || isTreasuryBeneficiary;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Vesting"
        description="Team and treasury allocations vest linearly on-chain. Beneficiaries can release vested tokens at any time; anyone can look up a schedule."
      />

      {!isDeployed ? (
        <NotDeployedState />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">Your vesting</h2>
            {!isConnected ? (
              <EmptyState title="Connect your wallet" description="Connect a wallet to check whether it's a vesting beneficiary." />
            ) : isAnyBeneficiary ? (
              <div className="space-y-4">
                {isTeamBeneficiary && (
                  <VestingScheduleCard
                    label="Team"
                    vestingAddress={deployment?.teamVesting}
                    schedule={team.schedule}
                    isLoading={team.isLoading}
                    canRelease
                    onReleased={team.refetch}
                  />
                )}
                {isTreasuryBeneficiary && (
                  <VestingScheduleCard
                    label="Treasury"
                    vestingAddress={deployment?.treasuryVesting}
                    schedule={treasury.schedule}
                    isLoading={treasury.isLoading}
                    canRelease
                    onReleased={treasury.refetch}
                  />
                )}
              </div>
            ) : (
              <EmptyState
                title="Not a vesting beneficiary"
                description="The connected wallet isn't the beneficiary of the team or treasury vesting contract. Look up any address below instead."
              />
            )}
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Look up a schedule</CardTitle>
              </CardHeader>
              <CardBody>
                <VestingLookup
                  instances={[
                    { label: "Team", address: deployment?.teamVesting, schedule: team.schedule, isLoading: team.isLoading },
                    {
                      label: "Treasury",
                      address: deployment?.treasuryVesting,
                      schedule: treasury.schedule,
                      isLoading: treasury.isLoading,
                    },
                  ]}
                />
              </CardBody>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
