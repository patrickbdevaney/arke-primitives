"use client";
// ===========================================================================
// ReputationWriter — write a reputation score with giveFeedback(...)
// ===========================================================================
//
// Demonstrates the ERC-8004 reputation write. The signature is exact (see
// erc8004.ts): giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32).
//
// This is the SELF-ATTESTATION pattern: an agent (or anyone) writes a score
// about an agent, tagged for context, with an optional bytes32 commitment to
// off-chain evidence. Anyone can later read the chain to reconstruct the trail.
// `value` is signed (int128) and paired with `decimals`, so e.g. value=950,
// decimals=2 means a score of 9.50, and negative scores are allowed.

import { useState } from "react";
import { keccak256, toHex } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { REPUTATION_ABI, REPUTATION_REGISTRY, ZERO_HASH } from "@/lib/erc8004";
import { arcscanTx } from "@/lib/arc";

export function ReputationWriter() {
  const { isConnected } = useAccount();
  const [agentId, setAgentId] = useState("20360");
  const [score, setScore] = useState("950"); // raw int128 value
  const [decimals, setDecimals] = useState("2"); // -> 950 / 10^2 = 9.50
  const [tag, setTag] = useState("accuracy");
  const [note, setNote] = useState("resolved 14/15 predictions correctly");

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function submit() {
    // Commit the human note to a bytes32 hash (or send ZERO_HASH if you have no
    // evidence to anchor). Storing the hash, not the text, keeps gas low while
    // still letting you prove later what the feedback referred to.
    const feedbackHash = note.trim() ? keccak256(toHex(note)) : ZERO_HASH;

    writeContract({
      address: REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "giveFeedback",
      args: [
        BigInt(agentId), // agentId          (uint256)
        BigInt(score), // value            (int128, signed)
        Number(decimals), // decimals         (uint8)
        tag, // tag1             (string)
        "", // tag2             (string)
        "", // tag3             (string)
        "", // tag4             (string)
        feedbackHash, // feedbackHash     (bytes32)
      ],
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-2 font-semibold">Write a reputation score</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="agentId" value={agentId} onChange={setAgentId} />
        <Field label="value (int128)" value={score} onChange={setScore} />
        <Field label="decimals" value={decimals} onChange={setDecimals} />
        <Field label="tag1" value={tag} onChange={setTag} />
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-gray-500">note (hashed into feedbackHash)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <p className="mt-2 text-sm text-gray-600">
        Effective score: <strong>{effective(score, decimals)}</strong> &middot; tagged{" "}
        <code>{tag || "—"}</code>
      </p>
      <button
        onClick={submit}
        disabled={!isConnected || isPending || isConfirming}
        className="mt-3 rounded bg-arc px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {!isConnected
          ? "Connect a wallet first"
          : isPending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Writing…"
              : "giveFeedback(...)"}
      </button>

      {hash && (
        <p className="mt-3 break-all text-sm">
          tx:{" "}
          <a className="text-arc underline" href={arcscanTx(hash)} target="_blank" rel="noreferrer">
            {hash}
          </a>
        </p>
      )}
      {isSuccess && <p className="mt-1 text-sm text-green-600">✓ Feedback written onchain.</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-2 font-mono text-sm"
      />
    </label>
  );
}

function effective(value: string, decimals: string): string {
  try {
    const v = Number(value);
    const d = Number(decimals);
    if (!Number.isFinite(v) || !Number.isFinite(d)) return "—";
    return (v / 10 ** d).toString();
  } catch {
    return "—";
  }
}
