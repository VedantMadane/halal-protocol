import type { Address } from "viem";

/**
 * ============================================================================================
 *  HALAL PROTOCOL — PER-CHAIN CONTRACT ADDRESSES
 * ============================================================================================
 *
 *  This is the single place to fill in real addresses after a real deployment.
 *
 *  After running the deploy script from the contracts/ package, e.g.:
 *
 *    cd contracts
 *    forge script script/Deploy.s.sol:DeployHalalSystem \
 *      --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 *
 *  copy the six logged addresses (HalalTimelock, HalalToken, Team Vesting, Treasury Vesting,
 *  HalalDAO, HalalPSM) plus the reserve token address you deployed against into the entry
 *  below for that chain's id. Also set `deploymentBlock` to the block number the deployment
 *  transaction landed in (used to bound the on-chain scan for governance proposal history —
 *  see src/hooks/useProposals.ts) — the block explorer page for the HalalDAO deployment tx
 *  will show this.
 *
 *  Any chain id that is absent from DEPLOYMENTS, or whose value is `undefined`, is treated by
 *  the whole app as "Halal is not deployed on this network yet" — every page checks this and
 *  renders an explicit empty state instead of attempting a contract call (which would either
 *  throw or silently read from address(0)).
 * ============================================================================================
 */

export interface HalalDeployment {
  /** HalalToken (HLC) — ERC20Votes + ERC20Permit + AccessControl. */
  token: Address;
  /** HalalVesting instance for the team allocation (6M HLC, 4yr, 1yr cliff, revocable). */
  teamVesting: Address;
  /** HalalVesting instance for the treasury allocation (4M HLC, 3yr, no cliff, not revocable). */
  treasuryVesting: Address;
  /** HalalPSM — peg stability module. */
  psm: Address;
  /** HalalDAO — the Governor contract users propose/vote/queue/execute through. */
  dao: Address;
  /** HalalTimelock — the Governor's execution arm. */
  timelock: Address;
  /** The ERC20 reserve asset the PSM accepts (e.g. DAI, USDC) on this chain. */
  reserveToken: Address;
  /** Symbol to display for the reserve token, since it's a plain ERC20 read but nice to have as a fallback. */
  reserveTokenSymbol: string;
  /** Block number of the deployment (HalalDAO creation). Bounds the ProposalCreated log scan. */
  deploymentBlock: bigint;
}

export const DEPLOYMENTS: Partial<Record<number, HalalDeployment>> = {
  // ── Anvil / local Foundry devnet (chain id 31337) ────────────────────────────────────────
  // Fill this in when running against a local `anvil` instance, e.g. by exporting the
  // addresses `forge script script/Deploy.s.sol --broadcast` prints, or by wiring up
  // NEXT_PUBLIC_* env vars and reading them here during development.
  31337: undefined,

  // ── Arbitrum Sepolia (testnet) — documented target network ─────────────────────────────
  421614: undefined,

  // ── Arbitrum One (mainnet) — documented target network ─────────────────────────────────
  42161: undefined,
};

export function getDeployment(chainId: number | undefined): HalalDeployment | undefined {
  if (chainId === undefined) return undefined;
  return DEPLOYMENTS[chainId];
}

export function isDeployed(chainId: number | undefined): boolean {
  return getDeployment(chainId) !== undefined;
}
