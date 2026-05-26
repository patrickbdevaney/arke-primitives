# 01 · Arc setup — RPC, faucet, chain config, and the USDC-gas gotcha

Everything in this kit runs against **Arc testnet**. This page gets you a
funded wallet and the right chain config in ~5 minutes.

## Chain parameters

| Field | Value |
|---|---|
| Chain ID | `5042002` |
| Name | Arc Testnet |
| Native currency | **USDC** (symbol `USDC`, **6 decimals**) |
| RPC URL | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |

The chain is defined once, in [`src/lib/arc.ts`](../src/lib/arc.ts), with
viem's `defineChain`. wagmi and viem both consume that single object.

## Add Arc to your wallet

The app's Connect button uses the `injected` connector (MetaMask, Rabby,
Brave, etc.). To add the network manually:

1. Open your wallet → Networks → Add network manually.
2. Enter the parameters from the table above.
3. Set the currency symbol to `USDC`.

When the wallet is on a different chain, the header shows **"wrong network"** —
typed-data signing still works, but transactions must target Arc.

## Get testnet USDC from the faucet

You need a little USDC to pay for gas (yes, gas is USDC here — see below).
Use the Arc testnet faucet linked from the Arc docs, paste your address, and
request funds. A fraction of a USDC is enough for the demos.

## ⚠️ The big gotcha: USDC is the gas token, and it has 6 decimals

Almost every EVM tool assumes the native token is 18-decimal ETH. **On Arc it
is 6-decimal USDC.** Consequences:

- A balance of "1.0" is `1_000_000` base units, **not** `1e18`.
- `formatEther` / `parseEther` are **wrong** on Arc. Use `formatUnits(x, 6)` /
  `parseUnits(x, 6)`, or read `arcTestnet.nativeCurrency.decimals`.
- Gas is denominated in USDC. You are literally paying for compute in dollars.

This kit sets `nativeCurrency.decimals = 6` in the chain definition so wagmi's
balance hooks format correctly. If a balance looks off by a factor of ~10¹², a
hardcoded 18 is the culprit.

## ⚠️ Gas estimation can underestimate complex calls

On Arc, automatic gas estimation has come in **low** for more involved calls.
If a transaction or deploy fails to land, set a manual gas limit:

- Foundry: `forge script ... --gas-limit 2000000`
- viem/wagmi: pass an explicit `gas` to the write call.

## Deploy the attestation oracle (optional, for demo 5)

```bash
cd contracts
export PRIVATE_KEY=0x...   # a THROWAWAY testnet key, never one with real funds
forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast
```

Copy the printed address into `.env.local`:

```
NEXT_PUBLIC_ORACLE_ADDRESS=0xYourDeployedOracle
```

The oracle demo page will then read it live.

## Circle developer-controlled wallets vs raw keys

For local hacking, a raw private key in MetaMask (or `PRIVATE_KEY` for Foundry)
is fine. For anything user-facing or production, prefer **Circle
developer-controlled wallets**: keys are custodied and policy-gated rather than
sitting in your app. Rule of thumb — raw keys for throwaway testnet scripts,
Circle (or another MPC/custody provider) the moment real value or real users
are involved.
