import { arbitrum, arbitrumSepolia, foundry } from "viem/chains";
import type { Chain } from "viem";

/**
 * Local Anvil/Foundry devnet (chain id 31337). Hardhat's default local network also uses
 * 31337, so this same entry works for either. Renamed from viem's "Foundry" label purely for
 * clarity in the UI.
 */
export const anvil: Chain = {
  ...foundry,
  name: "Anvil (Local)",
};

/** The three networks this frontend is built to run against, in priority order. */
export const supportedChains = [anvil, arbitrumSepolia, arbitrum] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

export function isSupportedChainId(chainId: number | undefined): chainId is SupportedChainId {
  return supportedChains.some((chain) => chain.id === chainId);
}

export function getChainName(chainId: number | undefined): string {
  return supportedChains.find((chain) => chain.id === chainId)?.name ?? "Unknown network";
}

/** Block explorer URL for a transaction hash on a supported chain, or undefined (e.g. local Anvil). */
export function getExplorerTxUrl(chainId: number | undefined, hash: string | undefined): string | undefined {
  if (!hash) return undefined;
  const chain = supportedChains.find((c) => c.id === chainId);
  const base = chain?.blockExplorers?.default?.url;
  return base ? `${base}/tx/${hash}` : undefined;
}
