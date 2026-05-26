"use client";
// ===========================================================================
// BuilderTradeForm — sign an order with a builder code, relay it, see attribution
// ===========================================================================
//
// This is the wagmi/viem version of the builder-code flow (the upgrade over a
// raw window.ethereum widget). The flow, end to end:
//
//   1. GET /api/relay-order  → the server hands us the current builder code.
//      (It's server-owned and never baked into this bundle; see the route.)
//   2. buildOrder({ ..., builder: code })  → typed data including the code.
//   3. useSignTypedData  → the user signs the order (one wallet popup).
//   4. POST /api/relay-order { order, signature }  → the relay verifies the
//      signed order carries the right code, then forwards (or echoes in demo).
//
// Notice the builder code is part of what gets signed — it can't be a URL param
// and it can't be swapped in after signing without breaking the signature.

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import type { Hex } from "viem";
import { buildOrder, serializeOrder, Side } from "@/lib/builderCode";
import { arcTestnet } from "@/lib/arc";

interface RelayResult {
  ok: boolean;
  body: unknown;
}

export function BuilderTradeForm() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [makerAmount, setMakerAmount] = useState("1000000"); // 1.00 USDC (6 dp)
  const [takerAmount, setTakerAmount] = useState("2000000"); // wants 2 outcome tokens
  const [side, setSide] = useState<number>(Side.BUY);
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<Hex | null>(null);
  const [builderCode, setBuilderCode] = useState<string | null>(null);
  const [result, setResult] = useState<RelayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!address) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSignature(null);
    try {
      // 1. Fetch the server-owned builder code at runtime (not bundled).
      const codeRes = await fetch("/api/relay-order", { cache: "no-store" });
      const { builderCode: code } = (await codeRes.json()) as { builderCode: Hex };
      setBuilderCode(code);

      // 2. Build the EIP-712 order WITH the builder code inside it.
      const order = buildOrder({
        maker: address,
        builder: code,
        tokenId: 1n,
        makerAmount: BigInt(makerAmount),
        takerAmount: BigInt(takerAmount),
        side,
        chainId: arcTestnet.id,
      });

      // 3. Sign. One popup; the user is signing the full order, code included.
      const sig = await signTypedDataAsync(order);
      setSignature(sig);

      // 4. Relay the signed order. bigints are stringified for JSON transport.
      const relayRes = await fetch("/api/relay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: serializeOrder(order.message), signature: sig }),
      });
      const body = await relayRes.json().catch(() => null);
      setResult({ ok: relayRes.ok, body });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-gray-500">makerAmount (USDC, 6 dp)</span>
          <input
            value={makerAmount}
            onChange={(e) => setMakerAmount(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-500">takerAmount</span>
          <input
            value={takerAmount}
            onChange={(e) => setTakerAmount(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-2 font-mono text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setSide(Side.BUY)}
          className={`rounded px-3 py-1 ${side === Side.BUY ? "bg-arc text-white" : "bg-gray-100"}`}
        >
          BUY
        </button>
        <button
          onClick={() => setSide(Side.SELL)}
          className={`rounded px-3 py-1 ${side === Side.SELL ? "bg-arc text-white" : "bg-gray-100"}`}
        >
          SELL
        </button>
      </div>

      <button
        onClick={submit}
        disabled={!isConnected || busy}
        className="rounded bg-arc px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {!isConnected ? "Connect a wallet first" : busy ? "Signing & relaying…" : "Sign order & relay"}
      </button>

      {builderCode && (
        <p className="break-all text-sm">
          <span className="text-gray-500">builder code (bytes32, from server):</span>
          <br />
          <code className="text-arc">{builderCode}</code>
        </p>
      )}
      {signature && (
        <p className="break-all text-sm">
          <span className="text-gray-500">order signature:</span>
          <br />
          <code>{signature}</code>
        </p>
      )}
      {result && (
        <div>
          <p className={`mb-1 text-sm font-semibold ${result.ok ? "text-green-600" : "text-red-600"}`}>
            {result.ok ? "✓ Relay accepted (attribution confirmed)" : "Relay rejected"}
          </p>
          <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
