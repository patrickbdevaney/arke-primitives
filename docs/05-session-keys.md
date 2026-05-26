# 05 · Session keys — low-friction, gasless-feeling agent UX

**Goal:** stop prompting the wallet on every action. Authorize once, then sign
in-scope actions locally.

**Files:** [`src/lib/sessionKeys.ts`](../src/lib/sessionKeys.ts),
[`src/components/SessionKeyDemo.tsx`](../src/components/SessionKeyDemo.tsx)

## The problem

An agent that signs every action with the user's main wallet triggers a wallet
popup every single time. That makes "autonomous" impossible and the UX
miserable.

## The pattern

1. **Generate** an ephemeral keypair (the "session key") — viem's
   `generatePrivateKey` + `privateKeyToAccount`.
2. **Authorize** it once: the main wallet signs a single message binding the
   session key's address + a scope + an expiry.
3. **Act**: sign all subsequent in-scope actions with the session key. No
   popups.

This is the same idea behind account-abstraction session keys and
"delegations." You trade a little security for a lot of UX, so the safety rails
are **narrow scope** and **short expiry**.

## The security model (told honestly)

- A session key is a **bearer credential**. Whoever holds it can do anything in
  its scope until it expires. Treat it like a short-lived API token.
- **Keep it in memory only** — React state or a module variable. Do **not** put
  it in `localStorage`/`sessionStorage`: any XSS payload on your origin can read
  those, which would hand an attacker a signing key. In-memory keys die on
  refresh, which is exactly the blast-radius limit you want.
- **Scope + expiry are the rails.** The demo uses a 30-minute expiry and a
  named scope (`feed:fetch`). Keep both tight.
- For real funds, also enforce the scope **onchain**: a smart-contract account
  checks the session key's permissions before executing. The off-chain
  authorization message in this demo is the front-end half of that story.

## What the demo shows

`SessionKeyDemo` walks the three steps with visible state: generate (shows the
session address + scope + expiry), authorize (one `useSignMessage` popup from
the main wallet), then "Sign action" repeatedly — each produces a signature
from the session key with **no wallet interaction**.

## Fork just this

`src/lib/sessionKeys.ts` is dependency-light (viem only). Drop it into any
wagmi app, wire the main-wallet authorization through `useSignMessage`, and gate
your actions behind `isScopeValid`. For production, pair it with a contract
account that enforces the scope onchain.
