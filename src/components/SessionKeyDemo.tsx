"use client";
// ===========================================================================
// SessionKeyDemo — authorize once, then sign actions with no wallet popups
// ===========================================================================
//
// Walks through the session-key lifecycle:
//   1. Generate an ephemeral keypair (in memory only).
//   2. The MAIN wallet signs ONE authorization binding that key + scope + expiry.
//   3. Subsequent actions are signed by the SESSION key — zero popups.
//
// The session key lives in React state (memory). Refreshing the page destroys
// it, which is the point: short blast radius. We never write it to localStorage
// (an XSS payload could read it). See src/lib/sessionKeys.ts for the why.

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { Hex } from "viem";
import {
  buildAuthorizationMessage,
  createSessionKey,
  isScopeValid,
  scopeExpiringInMinutes,
  signWithSessionKey,
  type SessionKey,
  type SessionScope,
} from "@/lib/sessionKeys";

export function SessionKeyDemo() {
  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // In-memory only — intentionally not persisted.
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [scope, setScope] = useState<SessionScope | null>(null);
  const [authSig, setAuthSig] = useState<Hex | null>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // STEP 1 — mint an ephemeral key + a 30-minute, narrowly-scoped grant.
  function generate() {
    setError(null);
    setSessionKey(createSessionKey());
    setScope(scopeExpiringInMinutes("feed:fetch", 30));
    setAuthSig(null);
    setActionLog([]);
  }

  // STEP 2 — the ONE wallet popup: the main wallet authorizes the session key.
  async function authorize() {
    if (!sessionKey || !scope) return;
    setError(null);
    try {
      const message = buildAuthorizationMessage(sessionKey.address, scope);
      const sig = await signMessageAsync({ message });
      setAuthSig(sig);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // STEP 3 — sign an action with the SESSION key. No wallet, no popup.
  async function signAction() {
    if (!sessionKey || !scope) return;
    setError(null);
    if (!isScopeValid(scope)) {
      setError("Session expired — generate a new key.");
      return;
    }
    const payload = `feed:fetch @ ${new Date().toISOString()}`;
    const sig = await signWithSessionKey(sessionKey, payload);
    setActionLog((log) => [`${payload}  →  ${sig.slice(0, 18)}…`, ...log]);
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        <li className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-sm font-semibold">1. Generate an ephemeral session key</p>
          <button
            onClick={generate}
            className="rounded bg-arc px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Generate session key
          </button>
          {sessionKey && scope && (
            <p className="mt-2 break-all text-sm">
              <span className="text-gray-500">session address:</span>{" "}
              <code>{sessionKey.address}</code>
              <br />
              <span className="text-gray-500">scope:</span> <code>{scope.scope}</code> &middot;{" "}
              <span className="text-gray-500">expires:</span>{" "}
              <code>{new Date(scope.expiry * 1000).toLocaleTimeString()}</code>
            </p>
          )}
        </li>

        <li className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-sm font-semibold">
            2. Authorize it once (single wallet signature)
          </p>
          <button
            onClick={authorize}
            disabled={!isConnected || !sessionKey}
            className="rounded bg-arc px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {!isConnected ? "Connect a wallet first" : "Authorize session key"}
          </button>
          {authSig && (
            <p className="mt-2 break-all text-sm text-green-600">
              ✓ Authorized by main wallet: <code>{authSig.slice(0, 24)}…</code>
            </p>
          )}
        </li>

        <li className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-sm font-semibold">
            3. Sign actions with the session key — no popups
          </p>
          <button
            onClick={signAction}
            disabled={!authSig}
            className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Sign action (session key)
          </button>
          {actionLog.length > 0 && (
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {actionLog.map((line, i) => (
                <li key={i} className="text-gray-700">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </li>
      </ol>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Security model:</strong> the session key is a bearer credential held in
        memory only (lost on refresh). It is scoped and short-lived on purpose. In
        production you would also enforce the scope onchain on a contract account, and
        keep expiries tight.
      </p>
    </div>
  );
}
