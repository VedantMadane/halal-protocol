import { isAddress, zeroAddress, type Address } from "viem";
import deploymentRegistry from "./deployment-registry.json";

/**
 * ============================================================================================
 *  HALAL PROTOCOL — PER-CHAIN CONTRACT ADDRESSES
 * ============================================================================================
 *
 *  This is the single place that defines the deployment shape. Public addresses belong in the
 *  checked-in deployment registry; NEXT_PUBLIC_HLC_*_<chainId> variables override individual
 *  fields for local experiments.
 *
 *  After running the deploy script from the contracts/ package, e.g.:
 *
 *    cd contracts
 *    forge script script/Deploy.s.sol:DeployHalalSystem \
 *      --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 *
 *  copy the six logged addresses (HalalTimelock, HalalToken, Team Vesting, Treasury Vesting,
 *  HalalDAO, HalalPSM) plus the reserve token address you deployed against into the matching
 *  environment variables for that chain's id. Also set `deploymentBlock` to the block number the deployment
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
  /** Optional signed CPI adapter. When present, `cpiSourceId` must also be configured. */
  cpiAdapter?: Address;
  /** Immutable source identity expected from the optional CPI adapter. */
  cpiSourceId?: `0x${string}`;
}

interface DeploymentSource {
  deploymentTx?: string;
  explorerUrl?: string;
  sourceVerificationUrl?: string;
  journalUrl?: string;
  token?: string;
  teamVesting?: string;
  treasuryVesting?: string;
  psm?: string;
  dao?: string;
  timelock?: string;
  reserveToken?: string;
  reserveTokenSymbol?: string;
  deploymentBlock?: string;
  cpiAdapter?: string;
  cpiSourceId?: string;
}

interface DeploymentEnvironment {
  token: string | undefined;
  teamVesting: string | undefined;
  treasuryVesting: string | undefined;
  psm: string | undefined;
  dao: string | undefined;
  timelock: string | undefined;
  reserveToken: string | undefined;
  reserveTokenSymbol: string | undefined;
  deploymentBlock: string | undefined;
  cpiAdapter: string | undefined;
  cpiSourceId: string | undefined;
}

/** Returns a complete deployment only when every address and the deployment block validate. */
function deploymentFromSource(source: DeploymentSource): HalalDeployment | undefined {
  const env: DeploymentEnvironment = {
    token: source.token,
    teamVesting: source.teamVesting,
    treasuryVesting: source.treasuryVesting,
    psm: source.psm,
    dao: source.dao,
    timelock: source.timelock,
    reserveToken: source.reserveToken,
    reserveTokenSymbol: source.reserveTokenSymbol,
    deploymentBlock: source.deploymentBlock === undefined ? undefined : String(source.deploymentBlock),
    cpiAdapter: source.cpiAdapter,
    cpiSourceId: source.cpiSourceId,
  };
  const addresses = [
    env.token,
    env.teamVesting,
    env.treasuryVesting,
    env.psm,
    env.dao,
    env.timelock,
    env.reserveToken,
  ];
  if (addresses.some((address) => !address || !isAddress(address) || address === zeroAddress)) return undefined;
  if (!env.reserveTokenSymbol || !env.deploymentBlock || !/^\d+$/.test(env.deploymentBlock)) return undefined;
  const deploymentBlock = BigInt(env.deploymentBlock);
  if (deploymentBlock === 0n) return undefined;
  const hasAdapter = env.cpiAdapter !== undefined || env.cpiSourceId !== undefined;
  if (hasAdapter) {
    if (!env.cpiAdapter || !isAddress(env.cpiAdapter) || env.cpiAdapter === zeroAddress) return undefined;
    if (!env.cpiSourceId || !/^0x[0-9a-fA-F]{64}$/.test(env.cpiSourceId) || /^0x0{64}$/i.test(env.cpiSourceId)) {
      return undefined;
    }
  }

  return {
    token: env.token as Address,
    teamVesting: env.teamVesting as Address,
    treasuryVesting: env.treasuryVesting as Address,
    psm: env.psm as Address,
    dao: env.dao as Address,
    timelock: env.timelock as Address,
    reserveToken: env.reserveToken as Address,
    reserveTokenSymbol: env.reserveTokenSymbol,
    deploymentBlock,
    ...(hasAdapter
      ? { cpiAdapter: env.cpiAdapter as Address, cpiSourceId: env.cpiSourceId as `0x${string}` }
      : {}),
  };
}

type DeploymentRegistry = Partial<Record<string, DeploymentSource>>;

const registry = deploymentRegistry as DeploymentRegistry;

function configuredDeployment(chainId: number): HalalDeployment | undefined {
  if (chainId !== 31337 && chainId !== 421614 && chainId !== 42161) return undefined;
  const suffix = String(chainId) as "31337" | "421614" | "42161";
  const registered = registry[suffix] ?? {};
  // Keep these references static: Next.js only exposes NEXT_PUBLIC_* variables to client code
  // when the property name is statically analyzable at build time.
  const environment: Record<typeof suffix, DeploymentSource> = {
    "31337": {
      token: process.env.NEXT_PUBLIC_HLC_TOKEN_31337,
      teamVesting: process.env.NEXT_PUBLIC_HLC_TEAM_VESTING_31337,
      treasuryVesting: process.env.NEXT_PUBLIC_HLC_TREASURY_VESTING_31337,
      psm: process.env.NEXT_PUBLIC_HLC_PSM_31337,
      dao: process.env.NEXT_PUBLIC_HLC_DAO_31337,
      timelock: process.env.NEXT_PUBLIC_HLC_TIMELOCK_31337,
      reserveToken: process.env.NEXT_PUBLIC_HLC_RESERVE_TOKEN_31337,
      reserveTokenSymbol: process.env.NEXT_PUBLIC_HLC_RESERVE_SYMBOL_31337,
      deploymentBlock: process.env.NEXT_PUBLIC_HLC_DEPLOYMENT_BLOCK_31337,
      cpiAdapter: process.env.NEXT_PUBLIC_HLC_CPI_ADAPTER_31337,
      cpiSourceId: process.env.NEXT_PUBLIC_HLC_CPI_SOURCE_ID_31337,
    },
    "421614": {
      token: process.env.NEXT_PUBLIC_HLC_TOKEN_421614,
      teamVesting: process.env.NEXT_PUBLIC_HLC_TEAM_VESTING_421614,
      treasuryVesting: process.env.NEXT_PUBLIC_HLC_TREASURY_VESTING_421614,
      psm: process.env.NEXT_PUBLIC_HLC_PSM_421614,
      dao: process.env.NEXT_PUBLIC_HLC_DAO_421614,
      timelock: process.env.NEXT_PUBLIC_HLC_TIMELOCK_421614,
      reserveToken: process.env.NEXT_PUBLIC_HLC_RESERVE_TOKEN_421614,
      reserveTokenSymbol: process.env.NEXT_PUBLIC_HLC_RESERVE_SYMBOL_421614,
      deploymentBlock: process.env.NEXT_PUBLIC_HLC_DEPLOYMENT_BLOCK_421614,
      cpiAdapter: process.env.NEXT_PUBLIC_HLC_CPI_ADAPTER_421614,
      cpiSourceId: process.env.NEXT_PUBLIC_HLC_CPI_SOURCE_ID_421614,
    },
    "42161": {
      token: process.env.NEXT_PUBLIC_HLC_TOKEN_42161,
      teamVesting: process.env.NEXT_PUBLIC_HLC_TEAM_VESTING_42161,
      treasuryVesting: process.env.NEXT_PUBLIC_HLC_TREASURY_VESTING_42161,
      psm: process.env.NEXT_PUBLIC_HLC_PSM_42161,
      dao: process.env.NEXT_PUBLIC_HLC_DAO_42161,
      timelock: process.env.NEXT_PUBLIC_HLC_TIMELOCK_42161,
      reserveToken: process.env.NEXT_PUBLIC_HLC_RESERVE_TOKEN_42161,
      reserveTokenSymbol: process.env.NEXT_PUBLIC_HLC_RESERVE_SYMBOL_42161,
      deploymentBlock: process.env.NEXT_PUBLIC_HLC_DEPLOYMENT_BLOCK_42161,
      cpiAdapter: process.env.NEXT_PUBLIC_HLC_CPI_ADAPTER_42161,
      cpiSourceId: process.env.NEXT_PUBLIC_HLC_CPI_SOURCE_ID_42161,
    },
  };
  const fromEnvironment = environment[suffix];
  return deploymentFromSource({
    ...registered,
    ...Object.fromEntries(Object.entries(fromEnvironment).filter(([, value]) => value !== undefined)),
  });
}

export const DEPLOYMENTS: Partial<Record<number, HalalDeployment>> = {
  // ── Anvil / local Foundry devnet (chain id 31337) ────────────────────────────────────────
  // Configure via the registry or NEXT_PUBLIC_HLC_*_31337 overrides; incomplete configuration stays disabled.
  31337: configuredDeployment(31337),

  // ── Arbitrum Sepolia (testnet) — documented target network ─────────────────────────────
  421614: configuredDeployment(421614),

  // ── Arbitrum One (mainnet) — documented target network ─────────────────────────────────
  42161: configuredDeployment(42161),
};

export function getDeployment(chainId: number | undefined): HalalDeployment | undefined {
  if (chainId === undefined) return undefined;
  return DEPLOYMENTS[chainId];
}

/**
 * Selects the chain used for public reads before a wallet connects. An explicit environment
 * value wins; otherwise the app uses the first configured deployment, then local Anvil as the
 * safe development fallback.
 */
export function getReadOnlyChainId(): number {
  const configuredChainId = process.env.NEXT_PUBLIC_READ_CHAIN_ID;
  if (configuredChainId && /^\d+$/.test(configuredChainId)) return Number(configuredChainId);

  const configuredDeployment = Object.entries(DEPLOYMENTS).find(([, deployment]) => deployment !== undefined);
  return configuredDeployment ? Number(configuredDeployment[0]) : 31_337;
}

export function isDeployed(chainId: number | undefined): boolean {
  return getDeployment(chainId) !== undefined;
}
