"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import type { VestingSchedule } from "@/hooks/useVesting";
import { VestingScheduleCard } from "./VestingScheduleCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface Instance {
  label: string;
  address: Address | undefined;
  schedule: VestingSchedule | undefined;
  isLoading: boolean;
}

export function VestingLookup({ instances }: { instances: Instance[] }) {
  const [input, setInput] = useState("");

  const query = input.trim();
  const valid = query === "" || isAddress(query);
  const matches = valid && query !== "" ? instances.filter((i) => i.schedule?.beneficiary.toLowerCase() === query.toLowerCase()) : [];

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="vesting-lookup" className="mb-1.5 block text-xs font-medium text-muted">
          Look up a vesting schedule by beneficiary address
        </label>
        <input
          id="vesting-lookup"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          className="w-full rounded-xl border border-card-border bg-background-subtle px-4 py-2.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {!valid && <p className="mt-1.5 text-xs text-danger">Not a valid address.</p>}
      </div>

      {query !== "" && valid && (
        matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((m) => (
              <VestingScheduleCard
                key={m.label}
                label={m.label}
                vestingAddress={m.address}
                schedule={m.schedule}
                isLoading={m.isLoading}
                canRelease={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No vesting schedule found"
            description="That address isn't the beneficiary of the team or treasury vesting contract."
          />
        )
      )}
    </div>
  );
}
