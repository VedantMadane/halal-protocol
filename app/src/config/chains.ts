import { defineChain, type Chain } from "viem";

/**
 * Local Anvil/Foundry devnet (chain id 31337). Hardhat's default local network also uses
 * 31337, so this same entry works for either. Renamed from viem's "Foundry" label purely for
 * clarity in the UI.
 */
export const anvil: Chain = defineChain({
  id: 31_337,
  name: "Anvil (Local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
      webSocket: ["ws://127.0.0.1:8545"],
    },
  },
});

export const arbitrumSepolia: Chain = defineChain({
  id: 421_614,
  name: "Arbitrum Sepolia",
  blockTime: 250,
  nativeCurrency: { name: "Arbitrum Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] } },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://sepolia.arbiscan.io",
      apiUrl: "https://api-sepolia.arbiscan.io/api",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 81930,
    },
  },
  testnet: true,
});

export const arbitrum: Chain = defineChain({
  id: 42_161,
  name: "Arbitrum One",
  blockTime: 250,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://arb1.arbitrum.io/rpc"] } },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://arbiscan.io",
      apiUrl: "https://api.arbiscan.io/api",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 7654707,
    },
  },
});

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
