// ===========================================================================
// /api/x402-demo — a minimal 402-gated endpoint (the SERVER half of x402)
// ===========================================================================
//
// Behaviour:
//   * No / invalid X-PAYMENT header  → 402 with a human-readable challenge body.
//   * Valid X-PAYMENT header         → 200 with the unlocked payload.
//
// "Valid" here means: we decode the base64 X-PAYMENT header, rebuild the EXACT
// EIP-3009 typed data the client signed, and verify the signature recovers to
// the claimed payer (viem's verifyTypedData). We also check the payment is to
// the right recipient for at least the quoted amount.
//
// WHAT THIS DEMO DOES NOT DO (and a real server must): submit/settle the
// authorization onchain via an x402 "facilitator". Offline signature
// verification proves the payment is well-formed and authorized; settlement is
// a separate, swappable step. We keep it offline so the kit runs with no
// external services. See docs/03-x402.md.

import { NextResponse, type NextRequest } from "next/server";
import { verifyTypedData, type Address, type Hex } from "viem";
import { arcTestnet } from "@/lib/arc";
import {
  buildTransferAuthorization,
  decodePaymentHeader,
  type X402Challenge,
} from "@/lib/x402";

// Public defaults live in code (not .env.example, which stays empty so it never
// trips a secret scanner). Override via env when you wire up a real recipient.
const PAY_TO = (process.env.X402_PAY_TO ||
  "0x000000000000000000000000000000000000dEaD") as Address;
const ASSET = (process.env.X402_ASSET ||
  "0x000000000000000000000000000000000000dEaD") as Address;
const PRICE = "10000"; // 0.01 USDC, in base units (USDC has 6 decimals on Arc)
const TIMEOUT_SECONDS = 120;

// The 402 challenge body. This is the contract the client codes against.
function challenge(error = "payment required"): X402Challenge {
  return {
    x402Version: 1,
    error,
    accepts: [
      {
        scheme: "exact", // pay exactly this amount
        network: "arc-testnet",
        maxAmountRequired: PRICE,
        resource: "/api/x402-demo",
        description: "Unlock the premium agent feed (demo)",
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: TIMEOUT_SECONDS,
        asset: ASSET,
        // EIP-712 domain name/version for the USDC token being authorized.
        extra: { name: "USDC", version: "2" },
      },
    ],
  };
}

export async function GET(req: NextRequest) {
  const header = req.headers.get("x-payment");

  // Step 2 of the handshake: no payment yet → reply 402 with the challenge.
  if (!header) {
    return NextResponse.json(challenge(), { status: 402 });
  }

  // Step 4: a payment was presented. Decode, rebuild, verify.
  try {
    const payment = decodePaymentHeader(header);
    const auth = payment.payload.authorization;
    const signature = payment.payload.signature as Hex;

    // Rebuild the IDENTICAL typed data the client signed. Any divergence here
    // (chainId, asset, field order) makes verification fail — that's the point.
    const typedData = buildTransferAuthorization({
      from: auth.from,
      to: auth.to,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce,
      asset: ASSET,
      chainId: arcTestnet.id,
      name: "USDC",
      version: "2",
    });

    const signatureValid = await verifyTypedData({
      address: auth.from,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: "TransferWithAuthorization",
      message: typedData.message,
      signature,
    });

    if (!signatureValid) {
      return NextResponse.json(challenge("invalid payment signature"), { status: 402 });
    }

    // Business checks: paid to us, for at least the price, not expired.
    const now = Math.floor(Date.now() / 1000);
    if (auth.to.toLowerCase() !== PAY_TO.toLowerCase()) {
      return NextResponse.json(challenge("wrong payment recipient"), { status: 402 });
    }
    if (BigInt(auth.value) < BigInt(PRICE)) {
      return NextResponse.json(challenge("insufficient payment amount"), { status: 402 });
    }
    if (now > Number(auth.validBefore)) {
      return NextResponse.json(challenge("payment authorization expired"), { status: 402 });
    }

    // Success: return the gated payload. In production you'd settle the
    // authorization via a facilitator before returning. X-PAYMENT-RESPONSE
    // carries settlement info back to the client (here: a demo marker).
    const settlementInfo = {
      settled: false,
      note: "demo: signature verified offline; not settled onchain",
      payer: auth.from,
    };

    return NextResponse.json(
      {
        unlocked: true,
        paidBy: auth.from,
        feed: [
          { t: now, signal: "ARC/USDC momentum: long", confidence: 0.71 },
          { t: now, signal: "rebalance LP band ±0.4%", confidence: 0.63 },
        ],
      },
      {
        status: 200,
        headers: {
          "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify(settlementInfo)).toString("base64"),
        },
      },
    );
  } catch (err) {
    // Malformed header etc. — treat as "still needs valid payment".
    const reason = err instanceof Error ? err.message : "malformed payment header";
    return NextResponse.json(challenge(reason), { status: 402 });
  }
}
