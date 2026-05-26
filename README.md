# arc-agent-starter

A forkable Next.js + wagmi/viem starter kit for building autonomous agents on
Arc — **ERC-8004 identity, x402 payments, builder-code attribution, session
keys, and an onchain attestation oracle**. Every primitive runs out of the box
on Arc testnet.

---

## Why this exists

These five primitives were proven end-to-end in the **Agora Agents Hackathon**
by [Arke](https://arke.live) (the reference implementation). This repo is the
**cleaned-up, standalone version** of each — extracted from the product, stripped
to the reusable core, and documented for a developer who is new to Arc and x402.

It is intentionally **teaching-first**: every file is commented to explain *why*,
not just *what*. Take the whole kit, or fork a single primitive — each one stands
on its own.

> Built with **wagmi 2.x + viem 2.x** throughout (not raw `window.ethereum`), so
> you get reactive connection state, SSR-safe hydration, and typed contract calls
> for free.

---

## Quickstart

```bash
git clone https://github.com/patrickbdevaney/arc-agent-starter
cd arc-agent-starter
npm install
cp .env.example .env.local        # works untouched; fill values only to override defaults
npm run dev                       # http://localhost:3000
```

Then get a little **testnet USDC** from the Arc faucet (you pay gas in USDC —
see the gotchas), connect a wallet on Arc testnet, and try each demo. New to
Arc? Read [`docs/01-arc-setup.md`](docs/01-arc-setup.md) first.

Contracts (separate toolchain):

```bash
cd contracts
forge build
forge test
```

---

## The primitives

Each is independently forkable. Pull the file(s) listed and the only shared
dependency is `src/lib/arc.ts` (the chain definition).

### 1 · ERC-8004 identity + reputation
Register an agent as an ERC-721 identity and write a reputation score that
anyone can read back.
- **Look at:** [`src/lib/erc8004.ts`](src/lib/erc8004.ts) ·
  [`IdentityCard.tsx`](src/components/IdentityCard.tsx) ·
  [`ReputationWriter.tsx`](src/components/ReputationWriter.tsx)
- **The gotcha:** the Reputation Registry address isn't documented next to the
  Identity Registry — find it in the erc-8004 contracts repo (both are hardcoded
  for you). Use the exact `giveFeedback` signature or the call reverts.
- **Fork just this:** copy `erc8004.ts` + the two components. Proven by Arke with
  agent **#20360**.

### 2 · x402 client-side payment
Hit a `402`-gated endpoint, sign the EIP-3009 payment authorization, retry with
an `X-PAYMENT` header, unlock the payload.
- **Look at:** [`src/lib/x402.ts`](src/lib/x402.ts) ·
  [`X402Fetch.tsx`](src/components/X402Fetch.tsx) ·
  [`api/x402-demo/route.ts`](src/app/api/x402-demo/route.ts)
- **The gotcha:** a `402` is *data*, not an error — it's a step in a retry loop.
  Sign the exact EIP-712 domain (chainId + token address) or verification fails
  silently.
- **Fork just this:** `x402.ts` works against any x402 server. Proven by Arke at
  `feed.arke.live:8402`.

### 3 · Builder-code order attribution
Sign an EIP-712 order whose `bytes32` builder code lives **inside the signed
struct**; a server relay verifies it and forwards.
- **Look at:** [`src/lib/builderCode.ts`](src/lib/builderCode.ts) ·
  [`BuilderTradeForm.tsx`](src/components/BuilderTradeForm.tsx) ·
  [`api/relay-order/route.ts`](src/app/api/relay-order/route.ts)
- **The gotcha:** attribution must be in the signature — a `?ref=` URL param
  earns nothing on V2-style exchanges. You can't inject the code after signing
  (it'd break the signature), so the server *publishes and verifies* it instead.
- **Fork just this:** set `POLY_BUILDER_CODE` + `ORDER_RELAY_URL` and adjust the
  `Order` struct to your venue.

### 4 · Session keys
Authorize an ephemeral key once with a single wallet signature, then sign
in-scope actions with no popups.
- **Look at:** [`src/lib/sessionKeys.ts`](src/lib/sessionKeys.ts) ·
  [`SessionKeyDemo.tsx`](src/components/SessionKeyDemo.tsx)
- **The gotcha:** a session key is a bearer credential — keep it in memory only
  (never `localStorage`, which is XSS-readable), and keep scope narrow + expiry
  short.
- **Fork just this:** `sessionKeys.ts` is viem-only; drop it into any wagmi app.

### 5 · Attestation oracle
A minimal Solidity oracle: log a claim **before** an outcome, resolve it
**after**, reconstruct the track record from chain alone.
- **Look at:** [`contracts/src/AttestationOracle.sol`](contracts/src/AttestationOracle.sol) ·
  [`OracleTable.tsx`](src/components/OracleTable.tsx)
- **The gotcha:** gas is USDC on Arc, and estimation can underestimate complex
  calls — set a manual gas limit if a tx won't land.
- **Fork just this:** it's ~70 lines of Solidity with a passing test suite.
  Generalized from Arke's `PredictionMarketOracle`.

### How they compose
A complete agent uses all five together: it has an **ERC-8004 identity**, earns
its keep by paying for data over **x402** and routing orders with a **builder
code**, runs smoothly behind **session keys**, and writes its calls to an
**attestation oracle** so its reputation is verifiable from chain state. Each
primitive is useful alone; the value compounds when you stack them.

---

## Arc-specific gotchas

High-value pedagogy — these are the things that cost hours if nobody warns you.

1. **USDC is the gas token, with 6 decimals (not 18).** Tooling that assumes
   18-decimal ETH breaks. Use `parseUnits(x, 6)` / `formatUnits(x, 6)`, not
   `parseEther` / `formatEther`. A balance off by ~10¹² means a hardcoded 18.
2. **ERC-8004 Reputation Registry discoverability.** The Identity Registry has a
   `0x8004…` vanity address; the Reputation Registry is harder to find — sourced
   from the erc-8004 contracts repo. Both are hardcoded in `erc8004.ts`. Use the
   exact `giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)`
   signature. (See [`docs/02-erc8004.md`](docs/02-erc8004.md).)
3. **Gas estimation can underestimate complex calls.** Set a manual gas limit —
   `--gas-limit` for Foundry, an explicit `gas` for viem/wagmi.
4. **Circle developer-controlled wallets vs raw keys.** Raw keys are fine for
   throwaway testnet scripts; switch to Circle (or another MPC/custody provider)
   the moment real value or real users are involved.

---

## Deploy your own

**Oracle (Foundry → Arc testnet):**

```bash
cd contracts
export PRIVATE_KEY=0x...   # throwaway testnet key only
forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast
# copy the printed address into .env.local as NEXT_PUBLIC_ORACLE_ADDRESS
```

**Frontend (Vercel):** import the repo, set the env vars from `.env.example`
that you actually use, and deploy. No build configuration needed.

---

## Project layout

```
arc-agent-starter/
├── src/lib/          # the five primitives as small, pure-ish modules
├── src/components/    # wagmi/viem UI for each primitive
├── src/app/           # Next.js App Router pages + API routes (x402, relay)
├── contracts/         # Foundry project: AttestationOracle + tests + deploy
└── docs/              # 01 setup · 02 erc8004 · 03 x402 · 04 builder-code · 05 session-keys
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build (also type-checks) |
| `npm run typecheck` | `tsc --noEmit` |
| `forge build` / `forge test` | Compile / test the contracts (run in `contracts/`) |

---

## License & credits

**MIT** — fork it, ship it. Built for **Arc OSS**, the **Agora Agents
Hackathon**, **Canteen × Circle × Arc**. Reference implementation:
[Arke](https://arke.live).
