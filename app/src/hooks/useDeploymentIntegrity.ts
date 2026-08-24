"use client";

import { useReadContracts } from "wagmi";
import { keccak256, toBytes, zeroAddress, zeroHash, type Address } from "viem";
import { halalDaoAbi, halalPsmAbi, halalTimelockAbi, halalTokenAbi, halalVestingAbi } from "@/abis";
import { hasReadFailure, partialReadError } from "@/lib/readResults";
import { useDeployment } from "./useDeployment";

const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));
const PARAM_ROLE = keccak256(toBytes("PARAM_ROLE"));
const PROPOSER_ROLE = keccak256(toBytes("PROPOSER_ROLE"));
const EXECUTOR_ROLE = keccak256(toBytes("EXECUTOR_ROLE"));

/**
 * Verifies the configured addresses against the live contract graph before the dApp signs actions.
 * Environment variables are only a routing hint; they are not proof that the selected chain has
 * the intended Halal deployment. The role checks also ensure the configured graph is actually
 * governed as designed: the PSM can mint, the timelock administers protocol contracts, the DAO
 * can propose through the timelock, and anyone can execute a queued proposal.
 */
export function useDeploymentIntegrity() {
  const { deployment } = useDeployment();

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts: deployment
      ? ([
          { address: deployment.psm, abi: halalPsmAbi, functionName: "reserve" },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "hlc" },
          { address: deployment.dao, abi: halalDaoAbi, functionName: "token" },
          { address: deployment.dao, abi: halalDaoAbi, functionName: "timelock" },
          { address: deployment.teamVesting, abi: halalVestingAbi, functionName: "token" },
          { address: deployment.teamVesting, abi: halalVestingAbi, functionName: "dao" },
          { address: deployment.treasuryVesting, abi: halalVestingAbi, functionName: "token" },
          { address: deployment.treasuryVesting, abi: halalVestingAbi, functionName: "dao" },
          { address: deployment.timelock, abi: halalTimelockAbi, functionName: "getMinDelay" },
          { address: deployment.token, abi: halalTokenAbi, functionName: "hasRole", args: [MINTER_ROLE, deployment.psm] },
          { address: deployment.token, abi: halalTokenAbi, functionName: "hasRole", args: [zeroHash, deployment.timelock] },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "hasRole", args: [zeroHash, deployment.timelock] },
          { address: deployment.psm, abi: halalPsmAbi, functionName: "hasRole", args: [PARAM_ROLE, deployment.timelock] },
          { address: deployment.timelock, abi: halalTimelockAbi, functionName: "hasRole", args: [PROPOSER_ROLE, deployment.dao] },
          { address: deployment.timelock, abi: halalTimelockAbi, functionName: "hasRole", args: [EXECUTOR_ROLE, zeroAddress] },
        ] as const)
      : [],
    query: { enabled: deployment !== undefined, refetchInterval: 30_000 },
  });

  const get = <T>(index: number): T | undefined =>
    data?.[index]?.status === "success" ? (data[index].result as T) : undefined;

  const reserve = get<Address>(0);
  const psmToken = get<Address>(1);
  const daoToken = get<Address>(2);
  const daoTimelock = get<Address>(3);
  const teamToken = get<Address>(4);
  const teamDao = get<Address>(5);
  const treasuryToken = get<Address>(6);
  const treasuryDao = get<Address>(7);
  const timelockDelay = get<bigint>(8);
  const psmMinter = get<boolean>(9);
  const tokenAdmin = get<boolean>(10);
  const psmAdmin = get<boolean>(11);
  const psmParam = get<boolean>(12);
  const timelockProposer = get<boolean>(13);
  const timelockExecutor = get<boolean>(14);
  const expected = deployment;

  const readFailed = hasReadFailure(data);
  const isVerified =
    expected !== undefined &&
    reserve?.toLowerCase() === expected.reserveToken.toLowerCase() &&
    psmToken?.toLowerCase() === expected.token.toLowerCase() &&
    daoToken?.toLowerCase() === expected.token.toLowerCase() &&
    daoTimelock?.toLowerCase() === expected.timelock.toLowerCase() &&
    teamToken?.toLowerCase() === expected.token.toLowerCase() &&
    teamDao?.toLowerCase() === expected.timelock.toLowerCase() &&
    treasuryToken?.toLowerCase() === expected.token.toLowerCase() &&
    treasuryDao?.toLowerCase() === expected.timelock.toLowerCase() &&
    timelockDelay !== undefined &&
    timelockDelay > 0n &&
    psmMinter === true &&
    tokenAdmin === true &&
    psmAdmin === true &&
    psmParam === true &&
    timelockProposer === true &&
    timelockExecutor === true;

  return {
    isVerified,
    isChecking: deployment !== undefined && (isLoading || data === undefined),
    isError: isError || readFailed,
    error: error ?? (readFailed ? partialReadError() : undefined),
    refetch,
  };
}
