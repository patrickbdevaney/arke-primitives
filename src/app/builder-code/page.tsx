// Demo 3 — builder-code order attribution.
import { BuilderTradeForm } from "@/components/BuilderTradeForm";

export default function BuilderCodePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Builder-code order attribution</h1>
        <p className="mt-2 text-gray-600">
          Sign an EIP-712 order whose <code>builder</code> field (a <code>bytes32</code>) is
          baked <em>inside the signed struct</em>. The relay verifies your order carries the
          correct, server-owned builder code before forwarding it.
        </p>
        <p className="mt-2 text-sm text-amber-700">
          The one thing to remember: attribution lives in the signature, not in a{" "}
          <code>?ref=</code> URL param. A ref param earns nothing on V2-style exchanges.
        </p>
      </header>

      <BuilderTradeForm />

      <p className="text-sm text-gray-400">
        Code: <code>src/lib/builderCode.ts</code>, <code>src/components/BuilderTradeForm.tsx</code>,{" "}
        <code>src/app/api/relay-order/route.ts</code> · Docs: <code>docs/04-builder-code.md</code>
      </p>
    </div>
  );
}
