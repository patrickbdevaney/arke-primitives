# 04 · Builder-code order attribution

**Goal:** earn attribution on the orders your front-end sends, in a way that
can't be stripped or spoofed.

**Files:** [`src/lib/builderCode.ts`](../src/lib/builderCode.ts),
[`src/components/BuilderTradeForm.tsx`](../src/components/BuilderTradeForm.tsx),
[`src/app/api/relay-order/route.ts`](../src/app/api/relay-order/route.ts)

## The one thing to remember

> The builder code is a `bytes32` field **inside the signed order struct**.
> It is **not** a `?ref=` URL parameter.

A URL ref earns you nothing on V2-style exchanges (e.g. the Polymarket CTF
Exchange). Attribution only counts when it's cryptographically bound into the
order the user signs — then it can't be removed in transit, and the exchange
can trust it. **If your attribution isn't covered by the signature, it isn't
attribution.**

The `Order` type in `builderCode.ts` mirrors the Polymarket CTF Exchange V2
struct, with `builder` (`bytes32`) added as the attribution field.

## ⚠️ Why you can't "inject" the code after signing

It's tempting to imagine the server stamping the builder code onto the order
after the user signs. **You can't** — the code is part of the EIP-712 struct
that was signed, and changing any signed byte invalidates the signature.

So the correct division of labor is:

1. **The server owns the code.** It lives in `POLY_BUILDER_CODE` (a server-only
   env var, **never** `NEXT_PUBLIC_…`), so it's not baked into the static client
   bundle and can be rotated freely.
2. **`GET /api/relay-order`** hands the current code to the client at request
   time.
3. **The client signs** an order that includes that code (`buildOrder({ ...,
   builder })` → `useSignTypedData`).
4. **`POST /api/relay-order`** verifies the signed order carries the correct
   code *and* a valid signature, then forwards it to the venue.

That's what "server-owned builder code" means in practice: publish, sign,
verify — not inject.

## The relay route

`POST /api/relay-order`:

- Rejects (`400`) if `order.builder` ≠ the server's code, with a hint.
- Rejects (`400`) if the EIP-712 signature doesn't recover to `order.signer`.
- Forwards verified orders to `ORDER_RELAY_URL` if set; otherwise runs in
  **demo echo mode** and returns the attributed order so you can see it work
  with no external venue.

`ORDER_RELAY_URL` is an env var precisely so this is a reusable pattern for any
builder-code venue, not hardwired to one CLOB.

## A serialization footgun

`uint256` fields are `bigint`, and `JSON.stringify` can't serialize `bigint`.
`serializeOrder` / `deserializeOrder` convert them to/from decimal strings so
the order survives the POST. The server deserializes before verifying — same
bytes in, same bytes out, signature still valid.

## Fork just this

Copy `src/lib/builderCode.ts`, the form, and the relay route. Set
`POLY_BUILDER_CODE` and `ORDER_RELAY_URL`, adjust the `Order` struct/domain to
your venue, and you have signed, attributable order flow.
