"use client";
// ===========================================================================
// OracleTable — read the AttestationOracle from chain with viem (no wallet)
// ===========================================================================
//
// Reading chain state needs no wallet — just a public client pointed at Arc.
// We create a viem `publicClient`, call count(), then read each attestation.
// This mirrors the contract in contracts/src/AttestationOracle.sol.
//
// Set NEXT_PUBLIC_ORACLE_ADDRESS in .env.local to your deployed oracle. Until
// then the component shows the deploy steps instead of erroring.

import { useEffect, useState } from "react";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { arcTestnet } from "@/lib/arc";

// The reads we need. The public array getter `attestations(uint256)` returns the
// struct fields as a tuple, in declaration order.
const ORACLE_ABI = [
  {
    type: "function",
    name: "count",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "attestations",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "subjectId", type: "bytes32" },
      { name: "claim", type: "string" },
      { name: "estimateBps", type: "uint16" },
      { name: "timestamp", type: "uint64" },
      { name: "resolved", type: "bool" },
      { name: "outcome", type: "bool" },
      { name: "scoreDelta", type: "int256" },
    ],
  },
] as const;

interface Row {
  id: number;
  claim: string;
  estimateBps: number;
  timestamp: number;
  resolved: boolean;
  outcome: boolean;
  scoreDelta: bigint;
}

export function OracleTable() {
  const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!oracleAddress || !isAddress(oracleAddress)) return;
    let cancelled = false;

    (async () => {
      setStatus("loading");
      setError(null);
      try {
        const client = createPublicClient({ chain: arcTestnet, transport: http() });
        const address = oracleAddress as Address;

        const total = await client.readContract({
          address,
          abi: ORACLE_ABI,
          functionName: "count",
        });

        const out: Row[] = [];
        for (let i = 0; i < Number(total); i++) {
          const a = await client.readContract({
            address,
            abi: ORACLE_ABI,
            functionName: "attestations",
            args: [BigInt(i)],
          });
          // a is the tuple [subjectId, claim, estimateBps, timestamp, resolved, outcome, scoreDelta]
          out.push({
            id: i,
            claim: a[1],
            estimateBps: a[2],
            timestamp: Number(a[3]),
            resolved: a[4],
            outcome: a[5],
            scoreDelta: a[6],
          });
        }
        if (!cancelled) {
          setRows(out);
          setStatus("done");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [oracleAddress]);

  // No address configured → show the deploy path instead of an error.
  if (!oracleAddress || !isAddress(oracleAddress)) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        <p className="mb-2 font-semibold">No oracle configured yet.</p>
        <p>Deploy the contract, then set its address so this page can read it:</p>
        <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
          {`cd contracts
forge create src/AttestationOracle.sol:AttestationOracle \\
  --rpc-url https://rpc.testnet.arc.network \\
  --private-key $PRIVATE_KEY --broadcast

# then in .env.local:
NEXT_PUBLIC_ORACLE_ADDRESS=0xYourDeployedOracle`}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Reading <code className="text-arc">{oracleAddress}</code> on Arc testnet.
      </p>
      {status === "loading" && <p className="text-sm text-gray-400">Loading attestations…</p>}
      {status === "error" && (
        <p className="text-sm text-red-600">Read failed: {error}</p>
      )}
      {status === "done" && rows.length === 0 && (
        <p className="text-sm text-gray-500">No attestations logged yet.</p>
      )}
      {rows.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 pr-3">#</th>
              <th className="py-1 pr-3">claim</th>
              <th className="py-1 pr-3">estimate</th>
              <th className="py-1 pr-3">status</th>
              <th className="py-1 pr-3">scoreΔ</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="py-1 pr-3">{r.id}</td>
                <td className="py-1 pr-3">{r.claim}</td>
                <td className="py-1 pr-3">{(r.estimateBps / 100).toFixed(2)}%</td>
                <td className="py-1 pr-3">
                  {r.resolved ? (r.outcome ? "✓ true" : "✗ false") : "pending"}
                </td>
                <td className="py-1 pr-3">{r.resolved ? r.scoreDelta.toString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
