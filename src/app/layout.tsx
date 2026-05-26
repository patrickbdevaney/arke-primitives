// ===========================================================================
// layout.tsx — the root layout (Server Component) wrapping every page
// ===========================================================================
//
// Wraps the whole app in <Providers> (wagmi + React Query) and renders a shared
// header with nav links and the wallet ConnectButton. Server Components can
// render Client Components (Providers, ConnectButton) — Next handles the
// boundary. The "use client" directive lives in those files, not here.

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/ConnectButton";

export const metadata: Metadata = {
  title: "arc-agent-starter",
  description:
    "A forkable Next.js + wagmi/viem starter kit for building autonomous agents on Arc.",
};

const NAV = [
  { href: "/identity", label: "Identity" },
  { href: "/x402", label: "x402" },
  { href: "/builder-code", label: "Builder code" },
  { href: "/session-keys", label: "Session keys" },
  { href: "/oracle", label: "Oracle" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="border-b border-gray-200">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="font-mono text-sm font-bold">
                arc-agent-starter
              </Link>
              <nav className="flex flex-wrap gap-3 text-sm text-gray-600">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-arc">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <ConnectButton />
            </div>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-4xl px-4 py-8 text-xs text-gray-400">
            MIT licensed · built for Arc OSS · Agora Agents Hackathon · Canteen × Circle × Arc
          </footer>
        </Providers>
      </body>
    </html>
  );
}
