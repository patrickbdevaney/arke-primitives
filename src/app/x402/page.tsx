// Demo 2 — x402 client-side payment.
import { X402Fetch } from "@/components/X402Fetch";

export default function X402Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">x402 client-side payment</h1>
        <p className="mt-2 text-gray-600">
          The HTTP 402 handshake, made visible. Click fetch: the server replies{" "}
          <code>402</code> with a challenge, your wallet signs an EIP-3009 payment
          authorization, the request retries with an <code>X-PAYMENT</code> header, and the
          gated payload unlocks.
        </p>
        <p className="mt-2 text-sm text-amber-700">
          Demo note: the server verifies your payment <em>signature</em> offline (it recovers
          the signer from the EIP-3009 typed data). It does not settle onchain — in production
          a facilitator submits the authorization. The handshake shape is real either way.
        </p>
      </header>

      <X402Fetch />

      <p className="text-sm text-gray-400">
        Code: <code>src/lib/x402.ts</code>, <code>src/components/X402Fetch.tsx</code>,{" "}
        <code>src/app/api/x402-demo/route.ts</code> · Docs: <code>docs/03-x402.md</code>
      </p>
    </div>
  );
}
