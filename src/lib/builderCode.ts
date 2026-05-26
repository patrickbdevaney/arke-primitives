// ===========================================================================
// src/lib/builderCode.ts — builder-code order attribution (EIP-712 signed order)
// ===========================================================================
//
// "Builder codes" are how a front-end (the "builder") earns attribution/fees on
// the orders it sends to a shared order book like the Polymarket CTF Exchange.
//
// THE SINGLE MOST IMPORTANT TEACHING POINT OF THIS PRIMITIVE:
//   The builder code is a `bytes32` field INSIDE the signed order struct.
//   It is NOT a `?ref=` URL parameter. A URL ref earns you nothing on V2-style
//   exchanges — attribution is cryptographically bound into the order the user
//   signs, so it can't be stripped or spoofed in transit. If your "attribution"
//   isn't covered by the signature, it isn't attribution.
//
// THE CONSEQUENCE (and a subtlety worth internalizing):
//   Because the builder code is part of what gets signed, you CANNOT "inject" it
//   after the fact — changing any signed byte invalidates the signature. So the
//   real division of labor is:
//     * The builder code is owned by the SERVER (env var, never NEXT_PUBLIC), so
//       it isn't baked into the static client bundle and can be rotated freely.
//     * The server hands the current code to the client at request time; the
//       client signs an order that INCLUDES it; the server then VERIFIES the
//       signed order carries the correct code before forwarding it on.
//   See src/app/api/relay-order/route.ts for the server half, and
//   docs/04-builder-code.md for the "why you can't inject after signing" story.
//
// The Order struct below mirrors the Polymarket CTF Exchange V2 order, with the
// `builder` bytes32 added as the attribution field.

import { keccak256, toHex, type Address, type Hex } from "viem";

// EIP-712 type definition for the order. `as const` is required so viem/wagmi
// can infer the exact message shape from these literals.
export const ORDER_TYPES = {
  Order: [
    { name: "salt", type: "uint256" }, // randomness so identical orders differ
    { name: "maker", type: "address" }, // who owns the funds
    { name: "signer", type: "address" }, // who signed (usually == maker)
    { name: "taker", type: "address" }, // 0x0 = open to anyone
    { name: "tokenId", type: "uint256" }, // the outcome token being traded
    { name: "makerAmount", type: "uint256" }, // amount maker gives
    { name: "takerAmount", type: "uint256" }, // amount maker wants
    { name: "expiration", type: "uint256" }, // unix seconds; 0 = no expiry
    { name: "nonce", type: "uint256" }, // maker nonce for cancellation
    { name: "feeRateBps", type: "uint256" }, // fee in basis points
    { name: "side", type: "uint8" }, // 0 = BUY, 1 = SELL
    { name: "signatureType", type: "uint8" }, // 0 = EOA (EIP-712)
    { name: "builder", type: "bytes32" }, // <-- ATTRIBUTION, inside the signature
  ],
} as const;

// Order side enum, named for readability.
export const Side = { BUY: 0, SELL: 1 } as const;

// A demo exchange address used as the EIP-712 `verifyingContract`. Swap this for
// the real venue's exchange address. It lives in code (not .env.example) so the
// demo runs out of the box; client and server use the same constant, so the
// signature they produce/verify always agrees.
export const DEMO_EXCHANGE_ADDRESS: Address =
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// Build the EIP-712 domain for the exchange. Kept here so both the client (sign)
// and the server (verify) construct an identical domain.
export function buildOrderDomain(chainId: number, verifyingContract: Address) {
  return {
    name: "Arc Builder Exchange",
    version: "1",
    chainId,
    verifyingContract,
  } as const;
}

// The fully-typed Order message. Numeric fields are bigint (uint256/uint8),
// addresses are Address, builder is a bytes32 Hex.
export interface OrderMessage {
  salt: bigint;
  maker: Address;
  signer: Address;
  taker: Address;
  tokenId: bigint;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  side: number;
  signatureType: number;
  builder: Hex;
}

export interface BuildOrderParams {
  maker: Address;
  builder: Hex; // the bytes32 builder code (fetched from the server at runtime)
  tokenId: bigint;
  makerAmount: bigint;
  takerAmount: bigint;
  side: number;
  chainId: number;
  // Optional overrides; sensible defaults below keep the demo simple.
  signer?: Address;
  taker?: Address;
  expiration?: bigint;
  nonce?: bigint;
  feeRateBps?: bigint;
  signatureType?: number;
  salt?: bigint;
  verifyingContract?: Address;
}

// Produce the typed data ready to hand to `signTypedData` (client) or
// `verifyTypedData` (server). Returns { domain, types, primaryType, message }.
export function buildOrder(params: BuildOrderParams) {
  const verifyingContract = params.verifyingContract ?? DEMO_EXCHANGE_ADDRESS;
  const message: OrderMessage = {
    salt: params.salt ?? randomSalt(),
    maker: params.maker,
    signer: params.signer ?? params.maker, // default: maker signs for themselves
    taker:
      params.taker ?? "0x0000000000000000000000000000000000000000", // open order
    tokenId: params.tokenId,
    makerAmount: params.makerAmount,
    takerAmount: params.takerAmount,
    expiration: params.expiration ?? 0n, // no expiry by default
    nonce: params.nonce ?? 0n,
    feeRateBps: params.feeRateBps ?? 0n,
    side: params.side,
    signatureType: params.signatureType ?? 0, // EOA EIP-712 signature
    builder: params.builder,
  };

  return {
    domain: buildOrderDomain(params.chainId, verifyingContract),
    types: ORDER_TYPES,
    primaryType: "Order" as const,
    message,
  };
}

// A pseudo-random uint256 salt. Uniqueness, not unpredictability, is what
// matters for salt, so a timestamp-seeded keccak is plenty for the demo.
function randomSalt(): bigint {
  const seed = `${Date.now()}-${Math.random()}`;
  return BigInt(keccak256(toHex(seed)));
}

// Helper to turn a human label into a bytes32 builder code (keccak of the
// label). Real venues assign you a code; this is just for demos/tests.
export function builderCodeFromLabel(label: string): Hex {
  return keccak256(toHex(label));
}

// --- JSON serialization -----------------------------------------------------
// uint256 fields are bigint, and JSON.stringify cannot serialize bigint. So we
// convert bigints to decimal strings when POSTing the signed order to the relay,
// and the server converts them back before verifying the signature. The
// stringified shape below is the on-the-wire contract between client and server.
export interface SerializedOrder {
  salt: string;
  maker: Address;
  signer: Address;
  taker: Address;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  builder: Hex;
}

export function serializeOrder(m: OrderMessage): SerializedOrder {
  return {
    salt: m.salt.toString(),
    maker: m.maker,
    signer: m.signer,
    taker: m.taker,
    tokenId: m.tokenId.toString(),
    makerAmount: m.makerAmount.toString(),
    takerAmount: m.takerAmount.toString(),
    expiration: m.expiration.toString(),
    nonce: m.nonce.toString(),
    feeRateBps: m.feeRateBps.toString(),
    side: m.side,
    signatureType: m.signatureType,
    builder: m.builder,
  };
}

export function deserializeOrder(o: SerializedOrder): OrderMessage {
  return {
    salt: BigInt(o.salt),
    maker: o.maker,
    signer: o.signer,
    taker: o.taker,
    tokenId: BigInt(o.tokenId),
    makerAmount: BigInt(o.makerAmount),
    takerAmount: BigInt(o.takerAmount),
    expiration: BigInt(o.expiration),
    nonce: BigInt(o.nonce),
    feeRateBps: BigInt(o.feeRateBps),
    side: o.side,
    signatureType: o.signatureType,
    builder: o.builder,
  };
}
