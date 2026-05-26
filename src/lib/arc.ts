// ===========================================================================
// src/lib/arc.ts — the Arc testnet chain definition for viem + wagmi
// ===========================================================================
//
// Every primitive in this kit talks to Arc through this one chain object.
// viem's `defineChain` produces a typed Chain that both viem (low-level RPC)
// and wagmi (React hooks) understand.
//
// THE ONE THING TO REMEMBER ABOUT ARC:
// Arc uses USDC as its NATIVE GAS TOKEN, and USDC has 6 decimals — not 18.
// Almost every EVM tool assumes the native token is 18-decimal ETH. That
// assumption is the #1 source of bugs on Arc:
//   - A "1.0" balance is 1_000_000 base units here, not 1e18.
//   - viem's formatEther / parseEther are WRONG on Arc; use formatUnits(x, 6)
//     and parseUnits(x, 6), or the nativeCurrency.decimals below.
//   - Gas is denominated in USDC. You pay for compute in dollars, literally.
//
// We surface decimals: 6 in nativeCurrency so wagmi's balance hooks format
// correctly. Read docs/01-arc-setup.md for the faucet + RPC walkthrough.

import { defineChain } from "viem";

// Allow operators to point at their own node via env, but default to the
// public testnet RPC so the app works with zero configuration.
const RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  // 6 decimals — see the warning above. This is the field that prevents the
  // classic "my balance is off by 10^12" bug.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// --- Small explorer helpers used across the demos --------------------------
// Clickable links to Arcscan make every onchain action verifiable, which is
// the whole point of a teaching repo: see the tx, trust the tx.
export const arcscanTx = (hash: string) =>
  `${arcTestnet.blockExplorers.default.url}/tx/${hash}`;

export const arcscanAddress = (address: string) =>
  `${arcTestnet.blockExplorers.default.url}/address/${address}`;
