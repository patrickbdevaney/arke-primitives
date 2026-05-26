"use client";
// ===========================================================================
// IdentityCard — register an ERC-8004 agent identity, then read it back
// ===========================================================================
//
// Two halves:
//   1. WRITE: `register(agentURI)` mints the agent's ERC-721 identity. We use
//      wagmi's `useWriteContract` to send the tx and `useWaitForTransactionReceipt`
//      to watch it confirm.
//   2. READ: given an agentId, `useReadContract` calls the ERC-721 views
//      (ownerOf, tokenURI) so you can verify what got minted.
//
// TEACHING NOTE on the returned agentId: a state-changing call doesn't hand you
// its return value in the front-end — you read it from the receipt's logs (the
// ERC-721 Transfer event) or by querying the registry afterwards. For the demo
// we link the tx to Arcscan, where the minted tokenId is visible in the logs.

import { useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { IDENTITY_ABI, IDENTITY_REGISTRY } from "@/lib/erc8004";
import { arcscanTx } from "@/lib/arc";

export function IdentityCard() {
  const { isConnected } = useAccount();

  // --- WRITE: register a new agent ----------------------------------------
  const [agentURI, setAgentURI] = useState("ipfs://your-agent-card.json");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function register() {
    writeContract({
      address: IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "register",
      args: [agentURI],
    });
  }

  // --- READ: resolve an agentId to owner + metadata URI -------------------
  const [agentIdInput, setAgentIdInput] = useState("20360"); // Arke's proven agent #
  const agentId = safeBigInt(agentIdInput);
  const owner = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: "ownerOf",
    args: agentId !== null ? [agentId] : undefined,
    query: { enabled: agentId !== null },
  });
  const uri = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: "tokenURI",
    args: agentId !== null ? [agentId] : undefined,
    query: { enabled: agentId !== null },
  });

  return (
    <div className="space-y-6">
      {/* WRITE */}
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-2 font-semibold">1. Register an agent</h3>
        <p className="mb-3 text-sm text-gray-600">
          Mints an ERC-721 identity for your agent. <code>agentURI</code> points at the
          agent&apos;s off-chain metadata (its &quot;agent card&quot;).
        </p>
        <input
          value={agentURI}
          onChange={(e) => setAgentURI(e.target.value)}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder="ipfs://… or https://…"
        />
        <button
          onClick={register}
          disabled={!isConnected || isPending || isConfirming}
          className="rounded bg-arc px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {!isConnected
            ? "Connect a wallet first"
            : isPending
              ? "Confirm in wallet…"
              : isConfirming
                ? "Minting…"
                : "register(agentURI)"}
        </button>

        {hash && (
          <p className="mt-3 break-all text-sm">
            tx:{" "}
            <a className="text-arc underline" href={arcscanTx(hash)} target="_blank" rel="noreferrer">
              {hash}
            </a>
          </p>
        )}
        {isSuccess && (
          <p className="mt-1 text-sm text-green-600">
            ✓ Confirmed. The minted agentId is in the Transfer event on Arcscan.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
      </section>

      {/* READ */}
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-2 font-semibold">2. Read an agent identity</h3>
        <p className="mb-3 text-sm text-gray-600">
          Resolve any agentId to its controlling wallet and metadata URI.
        </p>
        <input
          value={agentIdInput}
          onChange={(e) => setAgentIdInput(e.target.value)}
          className="mb-3 w-40 rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder="agentId"
        />
        <dl className="space-y-1 text-sm">
          <Row label="ownerOf">{render(owner.data, owner.isLoading, owner.error)}</Row>
          <Row label="tokenURI">{render(uri.data, uri.isLoading, uri.error)}</Row>
        </dl>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-mono text-gray-500">{label}</dt>
      <dd className="break-all font-mono">{children}</dd>
    </div>
  );
}

function render(data: unknown, loading: boolean, error: unknown) {
  if (loading) return <span className="text-gray-400">loading…</span>;
  if (error)
    return <span className="text-amber-600">not found (does this agentId exist on Arc?)</span>;
  return <span>{data ? String(data) : "—"}</span>;
}

function safeBigInt(v: string): bigint | null {
  try {
    return v.trim() === "" ? null : BigInt(v);
  } catch {
    return null;
  }
}
