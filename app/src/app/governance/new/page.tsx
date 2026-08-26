"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { encodeFunctionData, isAddress, parseUnits, zeroAddress, type Address, type Hex } from "viem";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TxStatus } from "@/components/TxStatus";
import { NotDeployedState } from "@/components/NotDeployedState";
import { useDeployment } from "@/hooks/useDeployment";
import { useDeploymentIntegrity } from "@/hooks/useDeploymentIntegrity";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useTxState } from "@/hooks/useTxState";
import { halalDaoAbi, halalPsmAbi } from "@/abis";
import { formatTokenGrouped } from "@/lib/format";

type Template = "cpi" | "advanced";

interface AdvancedRow {
  target: string;
  value: string;
  calldata: string;
}

interface ProposalPayload {
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
  description: string;
  buildError: string | undefined;
}

const EMPTY_PAYLOAD = (description: string, buildError?: string): ProposalPayload => ({
  targets: [],
  values: [],
  calldatas: [],
  description,
  buildError,
});

/** Pure builder kept outside the component so the memoizing useMemo body stays trivial. */
function buildProposalPayload(
  deployment: { psm: Address } | undefined,
  template: Template,
  cpiRateInput: string,
  cpiDescription: string,
  rows: AdvancedRow[],
  advancedDescription: string,
): ProposalPayload {
  if (!deployment) return EMPTY_PAYLOAD("");

  if (template === "cpi") {
    const trimmedRate = cpiRateInput.trim();
    if (!trimmedRate) {
      return EMPTY_PAYLOAD(cpiDescription, "Enter a valid rate.");
    }
    if (!/^\d+(?:\.\d{1,6})?$/.test(trimmedRate)) {
      return EMPTY_PAYLOAD(cpiDescription, "Enter a valid rate with at most 6 decimal places.");
    }

    let scaled: bigint;
    try {
      // CPI_PRECISION is 1e6, so parse the user input directly as a six-decimal fixed-point value.
      scaled = parseUnits(trimmedRate, 6);
    } catch {
      return EMPTY_PAYLOAD(cpiDescription, "Enter a valid rate with at most 6 decimal places.");
    }

    const MIN_CPI = 100_000n;
    const MAX_CPI = 2_000_000n;
    if (scaled < MIN_CPI || scaled > MAX_CPI) {
      return EMPTY_PAYLOAD(cpiDescription, "Rate must be between 0.1 and 2.0.");
    }
    if (!cpiDescription.trim()) {
      return EMPTY_PAYLOAD(cpiDescription, "Description is required.");
    }
    const calldata = encodeFunctionData({ abi: halalPsmAbi, functionName: "mockCPI", args: [scaled] });
    return {
      targets: [deployment.psm],
      values: [0n],
      calldatas: [calldata],
      description: cpiDescription,
      buildError: undefined,
    };
  }

  // Advanced
  const parsedTargets: Address[] = [];
  const parsedValues: bigint[] = [];
  const parsedCalldatas: Hex[] = [];
  for (const row of rows) {
    if (!row.target && !row.value && (!row.calldata || row.calldata === "0x")) continue; // skip fully-empty rows
    if (!isAddress(row.target) || row.target.toLowerCase() === zeroAddress) {
      return EMPTY_PAYLOAD(advancedDescription, `Invalid target address: "${row.target}"`);
    }
    let value: bigint;
    try {
      if (row.value && !/^\d*\.?\d*$/.test(row.value)) throw new Error("invalid value");
      value = row.value ? parseUnits(row.value as `${number}`, 18) : 0n;
    } catch {
      return EMPTY_PAYLOAD(advancedDescription, `Invalid ETH value: "${row.value}"`);
    }
    const calldata = (row.calldata || "0x").trim();
    if (!/^0x([0-9a-fA-F]{2})*$/.test(calldata)) {
      return EMPTY_PAYLOAD(advancedDescription, `Invalid calldata hex for target ${row.target}`);
    }
    parsedTargets.push(row.target as Address);
    parsedValues.push(value);
    parsedCalldatas.push(calldata as Hex);
  }
  if (parsedTargets.length === 0) {
    return EMPTY_PAYLOAD(advancedDescription, "Add at least one action.");
  }
  if (!advancedDescription.trim()) {
    return EMPTY_PAYLOAD(advancedDescription, "Description is required.");
  }
  return {
    targets: parsedTargets,
    values: parsedValues,
    calldatas: parsedCalldatas,
    description: advancedDescription,
    buildError: undefined,
  };
}

export default function NewProposalPage() {
  const router = useRouter();
  const { deployment, isDeployed } = useDeployment();
  const deploymentIntegrity = useDeploymentIntegrity();
  const { isConnected } = useAccount();
  const power = useVotingPower();
  const proposeTx = useTxState();

  const [template, setTemplate] = useState<Template>("cpi");

  // Update-CPI template state
  const [cpiRateInput, setCpiRateInput] = useState("1.00");
  const [cpiDescription, setCpiDescription] = useState(
    "Update the PSM CPI rate via mockCPI (governance-approved manual override).",
  );

  // Advanced template state
  const [rows, setRows] = useState<AdvancedRow[]>([{ target: "", value: "0", calldata: "0x" }]);
  const [advancedDescription, setAdvancedDescription] = useState("");

  const belowThreshold =
    power.votes !== undefined && power.proposalThreshold !== undefined && power.votes < power.proposalThreshold;
  const votingPowerUnavailable = power.isError || power.votes === undefined || power.proposalThreshold === undefined;

  const { targets, values, calldatas, description, buildError } = useMemo(
    () => buildProposalPayload(deployment, template, cpiRateInput, cpiDescription, rows, advancedDescription),
    [deployment, template, cpiRateInput, cpiDescription, rows, advancedDescription],
  );

  useEffect(() => {
    if (proposeTx.isConfirmed) {
      const timer = setTimeout(() => router.push("/governance"), 1500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposeTx.isConfirmed]);

  function handleSubmit() {
    if (!deployment || !deploymentIntegrity.isVerified || buildError || targets.length === 0) return;
    proposeTx.writeContract({
      address: deployment.dao,
      abi: halalDaoAbi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });
  }

  function updateRow(i: number, patch: Partial<AdvancedRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  if (!isDeployed || !deployment) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="New Proposal" />
        <NotDeployedState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/governance" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← All proposals
      </Link>
      <PageHeader title="New Proposal" description="Requires at least the proposal threshold in delegated voting power." />

      {!deploymentIntegrity.isVerified ? (
        <Alert tone="danger" title="Deployment configuration could not be verified">
          Refresh the page or correct the configured contract addresses before signing a governance transaction.
        </Alert>
      ) : !isConnected ? (
        <Alert tone="info">Connect your wallet to create a proposal.</Alert>
      ) : votingPowerUnavailable ? (
        <Alert tone="danger" title="Voting power could not be verified">
          Refresh the page before submitting. The proposal threshold and your delegated voting power must be read
          completely first.
        </Alert>
      ) : belowThreshold ? (
        <Alert tone="warning" title="Voting power below proposal threshold">
          You have {formatTokenGrouped(power.votes, 18)} HLC of voting power; {formatTokenGrouped(power.proposalThreshold, 18)}{" "}
          HLC is required to propose. You can still fill this out, but submitting will revert.
        </Alert>
      ) : null}

      <div className="mt-6 space-y-6">
        <div className="flex rounded-xl bg-background-subtle p-1">
          <button
            type="button"
            onClick={() => setTemplate("cpi")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              template === "cpi" ? "bg-card text-foreground shadow-sm" : "text-muted"
            }`}
          >
            Update CPI rate
          </button>
          <button
            type="button"
            onClick={() => setTemplate("advanced")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              template === "advanced" ? "bg-card text-foreground shadow-sm" : "text-muted"
            }`}
          >
            Advanced (raw calls)
          </button>
        </div>

        {template === "cpi" ? (
          <Card>
            <CardHeader>
              <CardTitle>Update CPI rate via mockCPI</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-muted">
                Calls <code className="rounded bg-background-subtle px-1 py-0.5">HalalPSM.mockCPI(uint256)</code> — the
                DAO-gated manual override, bounded to 0.1–2.0. Executes through the timelock like any other proposal.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">New CPI rate (e.g. 1.05)</label>
                <input
                  inputMode="decimal"
                  value={cpiRateInput}
                  onChange={(e) => setCpiRateInput(e.target.value)}
                  className="w-full rounded-xl border border-card-border bg-background-subtle px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
                <textarea
                  value={cpiDescription}
                  onChange={(e) => setCpiDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-card-border bg-background-subtle px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Raw actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-muted">
                For advanced users: specify one or more target/value/calldata triples directly. Encode calldata with
                viem&apos;s <code className="rounded bg-background-subtle px-1 py-0.5">encodeFunctionData</code> or any
                ABI tool before pasting it here.
              </p>
              {rows.map((row, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-card-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">Action {i + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    placeholder="Target address (0x…)"
                    value={row.target}
                    onChange={(e) => updateRow(i, { target: e.target.value })}
                    className="w-full rounded-lg border border-card-border bg-background-subtle px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    placeholder="ETH value (default 0)"
                    value={row.value}
                    onChange={(e) => updateRow(i, { value: e.target.value })}
                    className="w-full rounded-lg border border-card-border bg-background-subtle px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    placeholder="Calldata (0x…)"
                    value={row.calldata}
                    onChange={(e) => updateRow(i, { calldata: e.target.value })}
                    className="w-full rounded-lg border border-card-border bg-background-subtle px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRows((prev) => [...prev, { target: "", value: "0", calldata: "0x" }])}
              >
                + Add action
              </Button>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
                <textarea
                  value={advancedDescription}
                  onChange={(e) => setAdvancedDescription(e.target.value)}
                  rows={3}
                  placeholder="What does this proposal do, and why?"
                  className="w-full rounded-xl border border-card-border bg-background-subtle px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardBody>
          </Card>
        )}

        {buildError && <Alert tone="warning">{buildError}</Alert>}

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!isConnected || !deploymentIntegrity.isVerified || votingPowerUnavailable || belowThreshold || !!buildError || targets.length === 0}
          loading={proposeTx.isPending || proposeTx.isConfirming}
        >
          Submit proposal
        </Button>
        <TxStatus {...proposeTx} pendingLabel="Confirm in your wallet…" successLabel="Proposal created." />
      </div>
    </div>
  );
}
