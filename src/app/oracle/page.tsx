// Demo 5 — attestation oracle (read-only).
import { OracleTable } from "@/components/OracleTable";

export default function OraclePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Attestation oracle</h1>
        <p className="mt-2 text-gray-600">
          A minimal onchain ledger: an agent logs a claim <em>before</em> an outcome is known,
          resolves it <em>after</em>, and anyone can reconstruct the track record from chain
          state alone. This page reads a deployed <code>AttestationOracle</code> with viem — no
          wallet required.
        </p>
      </header>

      <OracleTable />

      <p className="text-sm text-gray-400">
        Code: <code>contracts/src/AttestationOracle.sol</code>,{" "}
        <code>src/components/OracleTable.tsx</code> · Docs: <code>docs/01-arc-setup.md</code>
      </p>
    </div>
  );
}
