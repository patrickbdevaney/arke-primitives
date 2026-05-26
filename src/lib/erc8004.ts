// ===========================================================================
// src/lib/erc8004.ts — ERC-8004 agent identity + reputation on Arc
// ===========================================================================
//
// ERC-8004 ("Trustless Agents") is the emerging standard for giving an AI agent
// a portable, onchain identity (an ERC-721 token) plus a reputation trail that
// anyone can read. Two registries matter here:
//
//   1. Identity Registry  — register(agentURI) mints your agent an ERC-721
//      identity and returns an agentId. The agentURI points at an off-chain
//      JSON document describing the agent (its "agent card").
//   2. Reputation Registry — giveFeedback(...) writes a signed score about an
//      agent. Track records become reconstructable from chain state alone.
//
// THE DISCOVERABILITY GOTCHA (teach this so the reader doesn't lose an hour):
// The Identity Registry lives at a recognizable "vanity" address that starts
// with 0x8004 on most testnets, so it is easy to find. The Reputation Registry
// is NOT documented next to it in an obvious place — we found its Arc address
// via the erc-8004 contracts repo, not the main tutorial. We hardcode both
// below with comments so you don't have to go spelunking.
//
// Reference: Arc docs "Register your first AI agent" tutorial. Always re-verify
// these addresses against the live network before relying on them — testnet
// deployments move, and ERC-8004 is still evolving.

import type { Address } from "viem";

// --- Verified registry addresses on Arc testnet ----------------------------
// The 0x8004... prefix on the identity registry is the ERC-8004 vanity address
// convention used across testnets. The reputation registry address was sourced
// from the erc-8004 contracts repo (the discoverability gotcha noted above).
export const IDENTITY_REGISTRY: Address =
  "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const REPUTATION_REGISTRY: Address =
  "0x8004B663056A597Dffe9eCcC1965A193B7388713";

// --- Identity Registry ABI --------------------------------------------------
// Minimal surface: register an agent, then read it back. `register` mints the
// ERC-721 and returns the new agentId. The standard ERC-721 views (ownerOf,
// tokenURI) let anyone resolve an agentId to its controller + metadata.
//
// NOTE: ERC-8004 implementations vary slightly between networks. If a call
// reverts with no reason, the most likely cause is an ABI mismatch — re-check
// the function signature against the deployed contract on Arcscan.
export const IDENTITY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    // agentURI: a URL (often ipfs:// or https://) to the agent's metadata JSON
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "uri", type: "string" }],
  },
  {
    // Resolves an agentId to the wallet that controls/acts for the agent.
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "wallet", type: "address" }],
  },
] as const;

// --- Reputation Registry ABI ------------------------------------------------
// This is the EXACT giveFeedback signature from the Arc docs tutorial:
//   giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)
// Getting the signature exactly right matters — a single mismatched type
// changes the function selector and the call reverts.
//
//   value    : the score, a SIGNED fixed-point integer (int128) so feedback can
//              be negative. Pair it with `decimals` to express fractions.
//   decimals : how many decimal places `value` carries (e.g. value=950,
//              decimals=2 -> a score of 9.50).
//   tag1..4  : free-form labels to categorize the feedback (e.g. "accuracy").
//   feedbackHash : bytes32 commitment to off-chain evidence (or 0x0 if none).
export const REPUTATION_ABI = [
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "decimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "tag3", type: "string" },
      { name: "tag4", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

// A zero bytes32, handy as the default feedbackHash when you have no off-chain
// evidence to commit to.
export const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
