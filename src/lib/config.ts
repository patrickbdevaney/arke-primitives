/**
 * config.ts — the single place to see every env var this app reads.
 *
 * RULES:
 *   - NEXT_PUBLIC_ vars are safe for the browser bundle. Never put a secret behind one.
 *   - Server-only vars (POLY_BUILDER_CODE, ORDER_RELAY_URL, X402_PAY_TO, X402_ASSET,
 *     PRIVATE_KEY) must NOT have a NEXT_PUBLIC_ prefix. The relay-order and x402-demo
 *     API routes read them on the server; they never reach the client.
 *   - All values have sensible defaults so the app runs with zero config.
 *     Override only what you actually need.
 *
 * FORKERS: copy .env.example → .env.local and fill only the vars you need.
 * The app runs and all five demos are interactive with zero env vars set.
 */

// ── Arc chain ──────────────────────────────────────────────────────────────
// Override to point at your own node. Public Arc testnet RPC is the default.
export const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ||
  "https://rpc.testnet.arc.network";

export const ARC_EXPLORER = "https://testnet.arcscan.app";

// ── Attestation oracle ─────────────────────────────────────────────────────
// Set to the address of your deployed AttestationOracle. When unset, the oracle
// page shows deploy instructions instead of an empty table.
export const ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_ORACLE_ADDRESS ?? "").trim();

export const ORACLE_DEPLOYED = ORACLE_ADDRESS.startsWith("0x");

// ── ERC-8004 ───────────────────────────────────────────────────────────────
// Your agent's ID in the ERC-8004 Identity Registry. Optional — the demos work
// without it (they register a new agent on demand).
export const ERC8004_AGENT_ID = process.env.NEXT_PUBLIC_ERC8004_AGENT_ID
  ? Number(process.env.NEXT_PUBLIC_ERC8004_AGENT_ID)
  : null;

// ── x402 server-side (API routes only — never NEXT_PUBLIC_) ───────────────
// X402_PAY_TO   : the wallet address that receives the micropayment.
// X402_ASSET    : the USDC contract address used in the EIP-3009 domain.
// Both have code-level fallbacks so the x402 demo runs in signature-only mode
// when unset. See api/x402-demo/route.ts.
export const X402_PAY_TO = process.env.X402_PAY_TO ?? "";
export const X402_ASSET  = process.env.X402_ASSET  ?? "";

// ── Builder code (API route only — never NEXT_PUBLIC_) ────────────────────
// Your bytes32 builder code from your exchange (e.g. Polymarket builders page).
// When unset, the relay uses a deterministic demo code so the demo works out
// of the box. See api/relay-order/route.ts.
export const POLY_BUILDER_CODE = process.env.POLY_BUILDER_CODE ?? "";

// ── Downstream relay (API route only) ─────────────────────────────────────
// The URL the relay-order route forwards verified, attributed orders to.
// When unset, the relay runs in demo echo mode (no external call is made).
export const ORDER_RELAY_URL = process.env.ORDER_RELAY_URL ?? "";
