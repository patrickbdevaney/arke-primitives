// ===========================================================================
// src/lib/x402.ts — the x402 payment helpers, explained line by line
// ===========================================================================
//
// x402 revives the long-dormant HTTP 402 ("Payment Required") status code as a
// real protocol: a server can gate any resource behind a micropayment, and a
// client (here, an agent's browser/wallet) can pay programmatically and retry.
//
// THE HANDSHAKE (this is the whole protocol — memorize these 4 steps):
//
//   1. Client requests the resource with no payment.
//   2. Server responds 402 with a JSON "challenge": what to pay, to whom, on
//      which chain, in which asset.
//   3. Client signs a payment authorization (here an EIP-3009
//      `TransferWithAuthorization` over USDC — a gasless transfer the recipient
//      or a facilitator can later submit) and base64-encodes it into an
//      `X-PAYMENT` header.
//   4. Client retries the SAME request with that header. Server verifies the
//      signature, (in production) settles it via a facilitator, and returns the
//      unlocked payload.
//
// WHAT MOST BUILDERS GET WRONG:
//   * They treat 402 as an error to surface to the user instead of a normal,
//     expected step in a retry loop. The 402 body is data, not a failure.
//   * They sign the wrong typed-data domain (wrong chainId or token address),
//     so the recovered signer never matches and verification silently fails.
//   * They forget the authorization is gasless: the SIGNER doesn't pay gas; a
//     facilitator submits the EIP-3009 transfer. That's what makes x402 usable
//     by agents that hold USDC but no separate gas token.
//
// THIS FILE IS DELIBERATELY PURE (no React, no wagmi). That matters: the SAME
// `buildTransferAuthorization` is used by the client (to sign) AND by the server
// API route (to verify) — colocating it here is what keeps the two sides from
// drifting. The React hook that drives the UI (`useX402Fetch`) lives in the
// client component src/components/X402Fetch.tsx and imports from here.

import { toHex, type Address, type Hex } from "viem";

// --- Wire types -------------------------------------------------------------
// Shape of one accepted payment option inside a 402 challenge. Mirrors the
// x402 "accepts" entry so this kit interoperates with real x402 servers.
export interface X402Accept {
  scheme: string; // payment scheme, e.g. "exact" (pay an exact amount)
  network: string; // human network id, e.g. "arc-testnet"
  maxAmountRequired: string; // price in base units, as a string (uint256-safe)
  resource: string; // the path being paid for
  description: string; // human-readable description of what you're buying
  mimeType: string; // expected content type of the unlocked payload
  payTo: Address; // who receives the payment
  maxTimeoutSeconds: number; // how long the signed authorization stays valid
  asset: Address; // the ERC-20 used to pay (USDC). Becomes EIP-712 verifyingContract
  extra: { name: string; version: string }; // EIP-712 domain name/version for the asset
}

// The full 402 body. `accepts` lists every payment option the server will take;
// a client picks one (we pick the first).
export interface X402Challenge {
  x402Version: number;
  error: string;
  accepts: X402Accept[];
}

// The EIP-3009 authorization the client signs. All numeric fields are strings
// on the wire so they survive JSON without precision loss.
export interface PaymentAuthorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex; // bytes32, unique per authorization to prevent replay
}

// The payload carried (base64-encoded) in the X-PAYMENT header.
export interface X402Payment {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: Hex;
    authorization: PaymentAuthorization;
  };
}

// --- EIP-3009 typed data ----------------------------------------------------
// `TransferWithAuthorization` is the EIP-3009 struct USDC implements. Signing it
// authorizes a transfer that ANYONE can submit on your behalf (gasless for the
// signer). x402's "exact" scheme is built directly on top of it.
//
// This function is PURE and shared by both sides of the handshake: the client
// builds + signs it, and the server rebuilds the identical structure to verify
// the signature. If the two sides disagree on a single field, verification
// fails — so colocating the builder here is what keeps them in lockstep.
export function buildTransferAuthorization(params: {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
  asset: Address; // EIP-712 verifyingContract (the USDC token)
  chainId: number;
  name: string; // EIP-712 domain name (USDC's token name)
  version: string; // EIP-712 domain version
}) {
  return {
    domain: {
      name: params.name,
      version: params.version,
      chainId: params.chainId,
      verifyingContract: params.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce,
    },
  } as const;
}

// --- base64 helpers that work in BOTH the browser and Node -----------------
// The browser has btoa/atob; Node has Buffer. We detect Buffer (present on the
// server, absent in the client bundle) and fall back to btoa/atob. The typeof
// guard keeps the bundler from trying to polyfill Buffer into the client.
export function toBase64(s: string): string {
  return typeof Buffer !== "undefined"
    ? Buffer.from(s, "utf8").toString("base64")
    : btoa(s);
}
export function fromBase64(s: string): string {
  return typeof Buffer !== "undefined"
    ? Buffer.from(s, "base64").toString("utf8")
    : atob(s);
}

// Encode/decode the X-PAYMENT header value (base64 of the JSON payment object).
export function encodePaymentHeader(payment: X402Payment): string {
  return toBase64(JSON.stringify(payment));
}
export function decodePaymentHeader(header: string): X402Payment {
  return JSON.parse(fromBase64(header)) as X402Payment;
}

// A cryptographically random 32-byte nonce. Each authorization MUST use a fresh
// nonce so a captured payment can't be replayed. Web Crypto is available in
// browsers and modern Node, so this is safe on both sides.
export function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}
