"use client";
// ===========================================================================
// X402Fetch — the useX402Fetch hook + a UI that SHOWS the handshake
// ===========================================================================
//
// The protocol helpers (challenge types, the EIP-3009 typed-data builder, the
// base64 header codec) are pure and live in src/lib/x402.ts so the server route
// can share them. The React hook lives HERE because it needs wagmi (wallet +
// signing), which is client-only.
//
// The teaching value is making each of the four x402 steps visible:
//   idle → challenged (got the 402) → signing (wallet popup) → paying (retry
//   with X-PAYMENT) → done (unlocked payload). The raw 402 challenge body is
//   rendered so you can read exactly what the server asked for.

import { useCallback, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { arcTestnet } from "@/lib/arc";
import {
  buildTransferAuthorization,
  encodePaymentHeader,
  randomNonce,
  type X402Challenge,
  type X402Payment,
} from "@/lib/x402";

type Phase = "idle" | "challenged" | "signing" | "paying" | "done" | "error";

interface X402State {
  phase: Phase;
  challenge: X402Challenge | null;
  data: unknown; // the unlocked payload (server returns arbitrary JSON on success)
  error: string | null;
}

// The hook performs the entire 4-step handshake and exposes the state at each
// step so the UI can render the progression. All protocol logic flows through
// the shared helpers in lib/x402.ts.
function useX402Fetch(url: string) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [state, setState] = useState<X402State>({
    phase: "idle",
    challenge: null,
    data: null,
    error: null,
  });

  const run = useCallback(async () => {
    if (!isConnected || !address) {
      setState((s) => ({ ...s, phase: "error", error: "Connect a wallet first." }));
      return;
    }
    try {
      // STEP 1 — request with no payment. We EXPECT a 402 back.
      const res1 = await fetch(url, { cache: "no-store" });
      if (res1.status !== 402) {
        // If the server didn't gate us, just show whatever it returned.
        const data = await res1.json().catch(() => null);
        setState({ phase: "done", challenge: null, data, error: null });
        return;
      }

      // STEP 2 — parse the challenge. This is DATA, not an error.
      const challenge = (await res1.json()) as X402Challenge;
      const accept = challenge.accepts[0];
      setState({ phase: "challenged", challenge, data: null, error: null });

      // STEP 3 — build + sign the EIP-3009 authorization for the quoted price.
      const value = BigInt(accept.maxAmountRequired);
      const validAfter = 0n; // valid immediately
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + accept.maxTimeoutSeconds);
      const nonce = randomNonce();

      const typedData = buildTransferAuthorization({
        from: address,
        to: accept.payTo,
        value,
        validAfter,
        validBefore,
        nonce,
        asset: accept.asset,
        chainId: arcTestnet.id,
        name: accept.extra.name,
        version: accept.extra.version,
      });

      setState((s) => ({ ...s, phase: "signing" }));
      // Pops the wallet to sign. No gas, no transaction — just a signature over
      // the typed data. That signature IS the payment authorization.
      const signature = await signTypedDataAsync(typedData);

      // STEP 4 — retry with the X-PAYMENT header and render the unlocked body.
      const payment: X402Payment = {
        x402Version: challenge.x402Version,
        scheme: accept.scheme,
        network: accept.network,
        payload: {
          signature,
          authorization: {
            from: address,
            to: accept.payTo,
            value: value.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      };

      setState((s) => ({ ...s, phase: "paying" }));
      const res2 = await fetch(url, {
        cache: "no-store",
        headers: { "X-PAYMENT": encodePaymentHeader(payment) },
      });
      const data = await res2.json().catch(() => null);

      if (!res2.ok) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: `Payment rejected (HTTP ${res2.status}).`,
          data,
        }));
        return;
      }
      setState((s) => ({ ...s, phase: "done", data, error: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [url, address, isConnected, signTypedDataAsync]);

  return { ...state, run };
}

const STEPS = ["idle", "challenged", "signing", "paying", "done"] as const;

export function X402Fetch() {
  const { isConnected } = useAccount();
  const { phase, challenge, data, error, run } = useX402Fetch("/api/x402-demo");

  return (
    <div className="space-y-4">
      <button
        onClick={run}
        disabled={!isConnected || phase === "signing" || phase === "paying"}
        className="rounded bg-arc px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {!isConnected ? "Connect a wallet first" : "Fetch the 402-gated feed"}
      </button>

      {/* Step indicator — makes the handshake legible. */}
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s) => {
          const active = s === phase;
          const passed = STEPS.indexOf(s) < STEPS.indexOf(phase as (typeof STEPS)[number]);
          return (
            <li
              key={s}
              className={[
                "rounded px-2 py-1 font-mono",
                active
                  ? "bg-arc text-white"
                  : passed
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500",
              ].join(" ")}
            >
              {s}
            </li>
          );
        })}
      </ol>

      {/* The raw 402 challenge: this is DATA, not an error. */}
      {challenge && (
        <div>
          <p className="mb-1 text-sm font-semibold">402 challenge (what the server asked for):</p>
          <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
            {JSON.stringify(challenge, null, 2)}
          </pre>
        </div>
      )}

      {/* The unlocked payload, returned after a verified payment. */}
      {phase === "done" && (
        <div>
          <p className="mb-1 text-sm font-semibold text-green-600">✓ Unlocked payload:</p>
          <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
