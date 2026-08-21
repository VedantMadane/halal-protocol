"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, useSyncExternalStore } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/config/wagmi";
import { ThemeProvider, useTheme } from "./ThemeProvider";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemDarkPreference(onChange: () => void) {
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSystemDarkPreference() {
  return window.matchMedia(DARK_QUERY).matches;
}

function getServerSystemDarkPreference() {
  return false;
}

function RainbowKitThemedProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  // RainbowKit's own theme prop doesn't respond to `prefers-color-scheme` automatically the way
  // our CSS variables do, so mirror it explicitly when the user has picked "system". Subscribing
  // via useSyncExternalStore (rather than useEffect+useState) is the correct pattern for tracking
  // an external browser API that can change outside of React.
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemDarkPreference,
    getSystemDarkPreference,
    getServerSystemDarkPreference,
  );

  const resolvedDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  return (
    <RainbowKitProvider
      theme={
        resolvedDark
          ? darkTheme({ accentColor: "#22c58a", accentColorForeground: "#04140d", borderRadius: "medium" })
          : lightTheme({ accentColor: "#0f9d68", accentColorForeground: "#ffffff", borderRadius: "medium" })
      }
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RainbowKitThemedProvider>{children}</RainbowKitThemedProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
