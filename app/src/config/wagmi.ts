import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";
import { anvil, supportedChains } from "./chains";
import { arbitrum, arbitrumSepolia } from "viem/chains";

// RainbowKit requires a WalletConnect Cloud project id for the WalletConnect connector to
// work. Get a free one at https://cloud.reown.com and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
// in your .env.local. Injected wallets (MetaMask, Rabby, browser extensions, etc.) still work
// fine without it.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000";

// Explicit wallet list rather than RainbowKit's default: the default set includes the "Base
// Account" smart-wallet connector, which pulls in @coinbase/cdp-sdk and, through it, an optional
// Solana/x402 payment dependency (@x402/svm/exact/client) that isn't installed and isn't
// resolvable by Next.js's bundler -- we don't need Solana or x402 payments for an EVM governance
// dApp, so we opt out of that connector entirely rather than fight the bundler over it.
// `safeWallet` is included deliberately: DAO treasuries and multisig beneficiaries are a core
// use case here.
export const wagmiConfig = getDefaultConfig({
  appName: "Halal DAO",
  projectId: walletConnectProjectId,
  chains: supportedChains,
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet, safeWallet, injectedWallet],
    },
  ],
  transports: {
    [anvil.id]: http(process.env.NEXT_PUBLIC_RPC_URL_31337 ?? "http://127.0.0.1:8545"),
    [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL_421614),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_URL_42161),
  },
  ssr: true,
});
