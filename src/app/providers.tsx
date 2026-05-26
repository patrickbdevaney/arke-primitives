"use client";
// ===========================================================================
// providers.tsx — wagmi + React Query + Arc chain config (the app's root wiring)
// ===========================================================================
//
// wagmi 2.x needs two providers above any component that uses its hooks:
//   * WagmiProvider       — holds the config (chains, connectors, transports).
//   * QueryClientProvider — wagmi uses @tanstack/react-query under the hood for
//                            caching/deduping reads. It is a required peer.
//
// This file is a Client Component ("use client") because providers and hooks
// run in the browser. layout.tsx (a Server Component) renders <Providers> around
// the whole app.

import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { arcTestnet } from "@/lib/arc";

// One wagmi config for the app:
//   * chains:     just Arc testnet here. Add more if you go multichain.
//   * connectors: `injected` covers MetaMask/Rabby/Brave and most browser
//                 wallets. No WalletConnect projectId needed to get started.
//   * transports: how viem talks to each chain (HTTP RPC, from arc.ts).
//   * ssr:        true so wagmi hydrates cleanly under Next's server rendering.
export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
  },
  ssr: true,
});

// wagmi's recommended typing hook so useReadContract etc. know about our config.
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  // Create the QueryClient once per browser session (useState initializer),
  // never on every render and never shared across server requests.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
