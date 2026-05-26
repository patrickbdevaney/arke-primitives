// Demo 1 — ERC-8004 identity + reputation.
// Server Component shell: static teaching copy + the interactive client islands.
import { IdentityCard } from "@/components/IdentityCard";
import { ReputationWriter } from "@/components/ReputationWriter";
import { IDENTITY_REGISTRY, REPUTATION_REGISTRY } from "@/lib/erc8004";

export default function IdentityPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">ERC-8004 identity + reputation</h1>
        <p className="mt-2 text-gray-600">
          Give your agent a portable onchain identity (an ERC-721) and a readable
          reputation trail. Register, then write a score about any agentId.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-500">
          <li>
            Identity Registry: <code className="text-arc">{IDENTITY_REGISTRY}</code>
          </li>
          <li>
            Reputation Registry: <code className="text-arc">{REPUTATION_REGISTRY}</code>{" "}
            <span className="text-amber-600">(the discoverability gotcha — see docs/02)</span>
          </li>
        </ul>
      </header>

      <IdentityCard />
      <ReputationWriter />

      <p className="text-sm text-gray-400">
        Code: <code>src/lib/erc8004.ts</code>, <code>src/components/IdentityCard.tsx</code>,{" "}
        <code>src/components/ReputationWriter.tsx</code> · Docs: <code>docs/02-erc8004.md</code>
      </p>
    </div>
  );
}
