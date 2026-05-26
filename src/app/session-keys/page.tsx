// Demo 4 — session keys.
import { SessionKeyDemo } from "@/components/SessionKeyDemo";

export default function SessionKeysPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Session keys</h1>
        <p className="mt-2 text-gray-600">
          Authorize an ephemeral key once with a single wallet signature, then sign
          subsequent in-scope actions with that key — no wallet popup per action. This is the
          low-friction UX layer that makes an agent feel autonomous.
        </p>
      </header>

      <SessionKeyDemo />

      <p className="text-sm text-gray-400">
        Code: <code>src/lib/sessionKeys.ts</code>, <code>src/components/SessionKeyDemo.tsx</code>{" "}
        · Docs: <code>docs/05-session-keys.md</code>
      </p>
    </div>
  );
}
