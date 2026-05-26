// ===========================================================================
// page.tsx — landing page. Links to the five primitive demos.
// ===========================================================================
// A Server Component (no hooks, just static content + links). Each card points
// at a self-contained demo. Each primitive is independently forkable — take the
// one you need and leave the rest.

import Link from "next/link";

const PRIMITIVES = [
  {
    href: "/identity",
    n: "1",
    title: "ERC-8004 identity + reputation",
    blurb:
      "Register an agent (ERC-721 identity) and write a reputation score. Proven by Arke with agent #20360.",
    file: "src/components/IdentityCard.tsx",
  },
  {
    href: "/x402",
    n: "2",
    title: "x402 client-side payment",
    blurb:
      "Hit a 402-gated endpoint, sign the EIP-3009 payment authorization, retry, unlock the payload.",
    file: "src/lib/x402.ts",
  },
  {
    href: "/builder-code",
    n: "3",
    title: "Builder-code order attribution",
    blurb:
      "Sign an EIP-712 order with a bytes32 builder code INSIDE the struct — not a ?ref= URL param.",
    file: "src/lib/builderCode.ts",
  },
  {
    href: "/session-keys",
    n: "4",
    title: "Session keys",
    blurb:
      "Authorize an ephemeral key once, then sign actions with no wallet popups. Gasless, low-friction UX.",
    file: "src/lib/sessionKeys.ts",
  },
  {
    href: "/oracle",
    n: "5",
    title: "Attestation oracle",
    blurb:
      "A minimal log→resolve→getter Solidity oracle. Reconstruct an agent's track record from chain alone.",
    file: "contracts/src/AttestationOracle.sol",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Build autonomous agents on Arc</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          A forkable Next.js + wagmi/viem starter kit. Five primitives —{" "}
          <strong>ERC-8004 identity</strong>, <strong>x402 payments</strong>,{" "}
          <strong>builder-code attribution</strong>, <strong>session keys</strong>, and an{" "}
          <strong>onchain attestation oracle</strong> — each runnable on Arc testnet, each
          documented for a developer new to Arc and x402.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Connect a wallet (top right), make sure it&apos;s on Arc testnet, and try each demo.
          New to Arc? Start with <code>docs/01-arc-setup.md</code>.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {PRIMITIVES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="block rounded-lg border border-gray-200 p-4 transition hover:border-arc hover:shadow-sm"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-gray-400">#{p.n}</span>
              <h2 className="font-semibold">{p.title}</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">{p.blurb}</p>
            <code className="mt-2 block text-xs text-gray-400">{p.file}</code>
          </Link>
        ))}
      </section>
    </div>
  );
}
