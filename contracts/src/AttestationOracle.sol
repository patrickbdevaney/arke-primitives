// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AttestationOracle
/// @notice Log a claim BEFORE an outcome is known, resolve it AFTER, and let
///         anyone reconstruct the track record from chain state alone. This is
///         the reusable core of an onchain self-scoring agent ledger — the
///         generalized version of a prediction-market oracle.
///
/// @dev WHY THIS SHAPE MATTERS (the teaching point):
///      Logging the claim and its probability estimate *before* the outcome is
///      known, with `block.timestamp` baked in, makes the record tamper-evident.
///      You cannot retroactively claim you "called it" — the chain has your
///      estimate, timestamped, from before resolution. Resolution then writes
///      the actual outcome and a scoring delta. Anyone can replay the whole
///      ledger to compute an honest, un-gameable track record.
///
///      ARC NOTE: gas is paid in USDC (6 decimals) on Arc. Writes are cheap, but
///      gas estimation can UNDERESTIMATE complex calls — set a manual gas limit
///      on the client if a tx mysteriously fails to land.
contract AttestationOracle {
    /// @notice One logged-then-resolved claim.
    struct Attestation {
        bytes32 subjectId; // what is being predicted (e.g. a market id / topic hash)
        string claim; // human-readable claim ("ETH > $4k by Friday")
        uint16 estimateBps; // the agent's probability estimate, in basis points (0..10000)
        uint64 timestamp; // when the claim was logged (predates the outcome)
        bool resolved; // has the outcome been written?
        bool outcome; // the actual result, set at resolution
        int256 scoreDelta; // scoring delta written at resolution (signed: rewards/penalties)
    }

    /// @notice Append-only ledger of attestations. Public getter gives index access.
    Attestation[] public attestations;

    /// @notice The agent (deployer) authorized to log and resolve.
    address public immutable agent;

    /// @dev Emitted when a claim is logged (before the outcome is known).
    event Logged(
        uint256 indexed id,
        bytes32 indexed subjectId,
        uint16 estimateBps,
        uint64 timestamp
    );

    /// @dev Emitted when a claim is resolved (the outcome becomes known).
    event Resolved(uint256 indexed id, bool outcome, int256 scoreDelta);

    /// @dev Only the agent that deployed this oracle may write to it.
    modifier onlyAgent() {
        require(msg.sender == agent, "not agent");
        _;
    }

    constructor() {
        agent = msg.sender;
    }

    /// @notice Log a claim before its outcome is known.
    /// @param subjectId   identifier for what's being predicted
    /// @param claim        human-readable description of the claim
    /// @param estimateBps  probability estimate in basis points (0..10000)
    /// @return id          the index of the new attestation
    function log(bytes32 subjectId, string calldata claim, uint16 estimateBps)
        external
        onlyAgent
        returns (uint256 id)
    {
        require(estimateBps <= 10000, "bps > 100%");
        id = attestations.length;
        attestations.push(
            Attestation(subjectId, claim, estimateBps, uint64(block.timestamp), false, false, 0)
        );
        emit Logged(id, subjectId, estimateBps, uint64(block.timestamp));
    }

    /// @notice Resolve a previously-logged claim. Can only happen once.
    /// @param id          the attestation index returned by log()
    /// @param outcome      the actual result
    /// @param scoreDelta   the scoring delta to record (signed)
    function resolve(uint256 id, bool outcome, int256 scoreDelta) external onlyAgent {
        Attestation storage a = attestations[id];
        require(!a.resolved, "already resolved");
        a.resolved = true;
        a.outcome = outcome;
        a.scoreDelta = scoreDelta;
        emit Resolved(id, outcome, scoreDelta);
    }

    /// @notice Total number of attestations logged.
    function count() external view returns (uint256) {
        return attestations.length;
    }

    /// @notice Number of attestations that have been resolved.
    function resolvedCount() external view returns (uint256 n) {
        uint256 len = attestations.length;
        for (uint256 i; i < len; i++) {
            if (attestations[i].resolved) n++;
        }
    }
}
