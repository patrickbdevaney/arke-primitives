// ===========================================================================
// src/lib/sessionKeys.ts — ephemeral session keys for low-friction agent UX
// ===========================================================================
//
// THE PROBLEM: an autonomous agent that signs every action with the user's main
// wallet triggers a wallet popup every single time. That kills the UX and makes
// "autonomous" impossible.
//
// THE PATTERN: generate a throwaway ("session") keypair, have the MAIN wallet
// authorize it ONCE with a single signature that says "this key may do X until
// time T", then sign all subsequent in-scope actions with the session key —
// no popups. This is the same idea behind account-abstraction session keys and
// "delegations": you trade a little security for a lot of UX, so you MUST scope
// the key tightly and expire it quickly.
//
// THE SECURITY MODEL (be honest with the reader):
//   * A session key is a bearer credential. Whoever holds it can do anything in
//     its scope until it expires. Treat it like a short-lived API token.
//   * Keep it in MEMORY ONLY (React state / a module variable). Do NOT put it in
//     localStorage or sessionStorage — those are readable by any XSS payload on
//     your origin, which would hand an attacker a signing key. In-memory keys
//     die on refresh, which is exactly the blast-radius limit you want for a demo.
//   * Scope + expiry are the safety rails. Narrow scope, short expiry.
//   * On a real contract account you'd also enforce the scope ONCHAIN (the
//     account checks the session key's permissions). The off-chain authorization
//     message here is the front-end half of that story.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

// An in-memory session key. The privateKey never leaves the tab and is never
// persisted. See the XSS note above.
export interface SessionKey {
  privateKey: Hex;
  address: Address;
}

// What the session key is allowed to do, and until when.
export interface SessionScope {
  scope: string; // e.g. "trade:read-only" or "feed:fetch"
  expiry: number; // unix seconds; after this the key must be discarded
}

// Generate a fresh session keypair using viem. `generatePrivateKey` uses the
// platform CSPRNG; `privateKeyToAccount` derives the address.
export function createSessionKey(): SessionKey {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

// The human-readable authorization the MAIN wallet signs exactly once. Keeping
// it human-readable matters: the user should be able to read, in their wallet,
// precisely what they are delegating and for how long. (For production, an
// EIP-712 typed message is preferable so a contract can verify it onchain; we
// use a plain string here to keep the demo legible.)
export function buildAuthorizationMessage(
  sessionKeyAddress: Address,
  scope: SessionScope,
): string {
  return [
    "Arc session key authorization",
    "",
    `I authorize the session key below to act on my behalf,`,
    `within the stated scope, until it expires.`,
    "",
    `Session key: ${sessionKeyAddress}`,
    `Scope:       ${scope.scope}`,
    `Expires:     ${new Date(scope.expiry * 1000).toISOString()}`,
  ].join("\n");
}

// True if the scope hasn't expired yet. Always check before using a key.
export function isScopeValid(scope: SessionScope): boolean {
  return Math.floor(Date.now() / 1000) < scope.expiry;
}

// Sign an action with the SESSION key — no wallet popup. This is the payoff:
// after the one-time authorization, the agent signs in-scope actions locally.
export async function signWithSessionKey(
  sessionKey: SessionKey,
  message: string,
): Promise<Hex> {
  const account = privateKeyToAccount(sessionKey.privateKey);
  return account.signMessage({ message });
}

// Convenience: build a scope that expires `minutes` from now.
export function scopeExpiringInMinutes(scope: string, minutes: number): SessionScope {
  return { scope, expiry: Math.floor(Date.now() / 1000) + minutes * 60 };
}
