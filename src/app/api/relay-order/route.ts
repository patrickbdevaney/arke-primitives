// ===========================================================================
// /api/relay-order — the SERVER half of builder-code attribution
// ===========================================================================
//
// Two endpoints:
//   GET  → hands the client the current builder code. It's server-owned (env,
//          never NEXT_PUBLIC) so it isn't baked into the static bundle and can
//          be rotated without a redeploy of the client.
//   POST → receives { order, signature }, VERIFIES the signed order carries the
//          correct builder code and a valid signature, then forwards it to the
//          downstream venue (ORDER_RELAY_URL) — or echoes it back in demo mode.
//
// WHY VERIFY INSTEAD OF "INJECT"?
// You might expect the server to stamp the builder code into the order here.
// It can't: the builder code is INSIDE the EIP-712 struct the user already
// signed, and mutating any signed byte invalidates the signature. So the only
// correct division of labor is: server publishes the code (GET), client signs
// it in, server verifies it (POST). That is what "server-owned builder code"
// actually means in practice. See docs/04-builder-code.md.

import { NextResponse, type NextRequest } from "next/server";
import { verifyTypedData, type Hex } from "viem";
import { arcTestnet } from "@/lib/arc";
import {
  buildOrderDomain,
  builderCodeFromLabel,
  deserializeOrder,
  DEMO_EXCHANGE_ADDRESS,
  ORDER_TYPES,
  type SerializedOrder,
} from "@/lib/builderCode";

// The canonical builder code. From env in production; a deterministic demo code
// otherwise, so the kit runs out of the box. NOTE: no NEXT_PUBLIC_ prefix — this
// value must never reach the browser bundle.
function builderCode(): Hex {
  const fromEnv = process.env.POLY_BUILDER_CODE;
  if (fromEnv && fromEnv.startsWith("0x")) return fromEnv as Hex;
  return builderCodeFromLabel("arc-agent-starter-demo");
}

// GET → the client fetches the code at runtime, just before signing.
export async function GET() {
  return NextResponse.json({ builderCode: builderCode() });
}

// POST → verify the signed order, then relay it.
export async function POST(req: NextRequest) {
  let body: { order: SerializedOrder; signature: Hex };
  try {
    body = (await req.json()) as { order: SerializedOrder; signature: Hex };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { order, signature } = body;
  if (!order || !signature) {
    return NextResponse.json({ error: "missing order or signature" }, { status: 400 });
  }

  const message = deserializeOrder(order);
  const canonical = builderCode();

  // 1. Attribution check: the signed order must carry OUR builder code.
  if (message.builder.toLowerCase() !== canonical.toLowerCase()) {
    return NextResponse.json(
      {
        error: "builder code mismatch",
        expected: canonical,
        got: message.builder,
        hint: "The client must fetch GET /api/relay-order and sign that exact code into the order.",
      },
      { status: 400 },
    );
  }

  // 2. Signature check: rebuild the identical typed data and verify the signer.
  const domain = buildOrderDomain(arcTestnet.id, DEMO_EXCHANGE_ADDRESS);
  const signatureValid = await verifyTypedData({
    address: message.signer,
    domain,
    types: ORDER_TYPES,
    primaryType: "Order",
    message,
    signature,
  });
  if (!signatureValid) {
    return NextResponse.json({ error: "invalid order signature" }, { status: 400 });
  }

  // 3. Forward to the downstream venue, or echo in demo mode.
  const relayUrl = process.env.ORDER_RELAY_URL;
  if (relayUrl) {
    try {
      const forwarded = await fetch(relayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, signature }),
      });
      const downstream = await forwarded.json().catch(() => null);
      return NextResponse.json(
        { status: "forwarded", attributedBuilder: canonical, downstream },
        { status: forwarded.ok ? 200 : 502 },
      );
    } catch (err) {
      return NextResponse.json(
        { error: "relay forward failed", detail: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
  }

  // Demo echo mode: no external venue configured.
  return NextResponse.json({
    status: "accepted (demo echo mode)",
    attributedBuilder: canonical,
    signer: message.signer,
    note: "Set ORDER_RELAY_URL to forward verified, attributed orders to a real venue.",
    order,
  });
}
