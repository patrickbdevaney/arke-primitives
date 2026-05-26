# Deploying arc-agent-starter

Three paths, pick your depth. Each is independent — do Tier 1 alone or stack
all three.

---

## Tier 1 — Vercel only (3 minutes, zero backend)

All five primitive demos run with no backend. The only thing that won't work
without additional setup: the oracle table (needs a deployed contract) and
real x402 settlement (needs a facilitator).

**Click:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/patrickbdevaney/arke-primitives)

Or manually:
1. Fork the repo on GitHub.
2. Import into Vercel. No build configuration needed — it detects Next.js.
3. Add env vars you want to override (all optional):

| Var | What it enables | How to get it |
|---|---|---|
| `NEXT_PUBLIC_ARC_RPC_URL` | Custom RPC node | Your node URL, or leave blank for the public one |
| `NEXT_PUBLIC_ORACLE_ADDRESS` | Oracle table | Deploy the contract (Tier 3), then paste the address |
| `NEXT_PUBLIC_ERC8004_AGENT_ID` | Pre-filled agent ID in the identity demo | Your agent's ID from the registry |
| `X402_PAY_TO` | Real x402 payment destination | Your wallet address (server-only, never NEXT_PUBLIC_) |
| `X402_ASSET` | USDC contract for EIP-3009 domain | `0x3600000000000000000000000000000000000000` on Arc testnet |
| `POLY_BUILDER_CODE` | Real builder-code attribution | Your bytes32 code from your exchange's builder program |
| `ORDER_RELAY_URL` | Forward signed orders to a real venue | Your exchange's order endpoint |

4. Deploy. Done.

---

## Tier 2 — Local dev (5 minutes)

```bash
git clone https://github.com/patrickbdevaney/arke-primitives
cd arke-primitives
npm install
cp .env.example .env.local    # edit only what you need — everything has a default
npm run dev
# → http://localhost:3000
```

Get testnet USDC for the x402 and identity demos:
- Go to https://faucet.circle.com
- Select Arc Testnet + USDC
- Paste your wallet address

Connect MetaMask/Rabby to Arc testnet:
- Network name: Arc Testnet
- RPC URL: https://rpc.testnet.arc.network
- Chain ID: 5042002
- Currency: USDC
- Explorer: https://testnet.arcscan.app

---

## Tier 3 — Deploy the Attestation Oracle (10 minutes)

Unlocks the oracle demo page. Requires Foundry.

**Install Foundry** (if needed):
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

**Generate a throwaway testnet key** (never reuse a mainnet key):
```bash
cast wallet new
# prints address + private key
```

**Fund it** from https://faucet.circle.com (Arc Testnet + USDC).

**Deploy:**
```bash
cd contracts
export PRIVATE_KEY=0x<your key>
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast \
  --legacy
```

The script prints `Oracle deployed at: 0x...`. Copy that address.

**Wire the dashboard:**
- Local: add `NEXT_PUBLIC_ORACLE_ADDRESS=0x<address>` to `.env.local`
- Vercel: add `NEXT_PUBLIC_ORACLE_ADDRESS=0x<address>` in project settings

Restart the dev server (or redeploy on Vercel) and the oracle table populates.

**Verify the deploy:**
```bash
cast call <address> "count()(uint256)" --rpc-url https://rpc.testnet.arc.network
# → 0 (no attestations yet — that's expected)
```

---

## Arc gotchas (the things that cost an hour if nobody warns you)

**USDC is the gas token, with 6 decimals.** `parseEther` and `formatEther` are
wrong on Arc. Use `parseUnits(x, 6)` and `formatUnits(x, 6)`. A balance off by
10^12 means a hardcoded 18.

**Gas estimation can underestimate complex calls.** Add `--gas-limit 500000` to
forge scripts if a transaction silently fails.

**The `--legacy` flag.** Arc testnet doesn't support EIP-1559 yet; always add
`--legacy` to forge scripts.

**ERC-8004 Reputation Registry.** The address isn't in the official Arc docs —
it's sourced from the erc-8004 contracts repo. It's hardcoded in
`src/lib/erc8004.ts` so you don't have to find it.

**x402 demo is signature-only.** The demo verifies the EIP-3009 signature
offline. In production a facilitator (like Circle Gateway) submits the
authorization onchain in batches. The handshake shape is real either way.
