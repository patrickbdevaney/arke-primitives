"use client";
// ===========================================================================
// ConnectButton — the wagmi way to connect a wallet (NOT raw window.ethereum)
// ===========================================================================
//
// The whole kit uses wagmi/viem rather than poking at window.ethereum directly.
// Why: wagmi gives you reactive connection state, multi-connector support,
// chain awareness, and SSR-safe hydration for free. Reaching for
// window.ethereum re-implements all of that, badly.
//
// `useConnect` exposes the configured connectors (we set up `injected` in
// providers.tsx, which covers MetaMask/Rabbit/Brave and most browser wallets).
// `useAccount` is the reactive source of truth for "are we connected, as whom,
// on what chain". `useDisconnect` tears it down.

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { arcTestnet } from "@/lib/arc";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const onArc = chainId === arcTestnet.id;
    return (
      <div className="flex items-center gap-3 text-sm">
        {/* Warn (don't block) if the wallet is on the wrong chain. Signing
            typed data still works, but transactions must target Arc. */}
        <span
          className={onArc ? "text-green-600" : "text-amber-600"}
          title={onArc ? "Connected to Arc Testnet" : "Switch your wallet to Arc Testnet"}
        >
          {onArc ? "● Arc Testnet" : "● wrong network"}
        </span>
        <code className="rounded bg-gray-100 px-2 py-1 font-mono">{short(address)}</code>
        <button
          onClick={() => disconnect()}
          className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // The first injected connector is the browser wallet. We render a button per
  // connector so this scales if you add WalletConnect/Coinbase later.
  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="rounded bg-arc px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Connecting…" : `Connect ${connector.name}`}
        </button>
      ))}
    </div>
  );
}
