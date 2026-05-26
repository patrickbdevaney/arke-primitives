// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AttestationOracle} from "../src/AttestationOracle.sol";

/// @notice Tests for AttestationOracle. The test contract deploys the oracle in
///         setUp(), so `address(this)` is the authorized agent. We prank a
///         different address to exercise the access-control paths.
contract AttestationOracleTest is Test {
    AttestationOracle internal oracle;

    bytes32 internal constant SUBJECT = keccak256("ETH>4k-by-friday");
    address internal constant STRANGER = address(0xBEEF);

    // Re-declared here so we can use them with vm.expectEmit.
    event Logged(uint256 indexed id, bytes32 indexed subjectId, uint16 estimateBps, uint64 timestamp);
    event Resolved(uint256 indexed id, bool outcome, int256 scoreDelta);

    function setUp() public {
        oracle = new AttestationOracle();
    }

    function test_AgentIsDeployer() public view {
        assertEq(oracle.agent(), address(this));
    }

    function test_LogStoresAttestationAndEmits() public {
        vm.warp(1_700_000_000); // pin block.timestamp so we can assert on it

        vm.expectEmit(true, true, false, true);
        emit Logged(0, SUBJECT, 7100, uint64(block.timestamp));

        uint256 id = oracle.log(SUBJECT, "ETH > $4k by Friday", 7100);
        assertEq(id, 0);
        assertEq(oracle.count(), 1);

        (
            bytes32 subjectId,
            string memory claim,
            uint16 estimateBps,
            uint64 timestamp,
            bool resolved,
            bool outcome,
            int256 scoreDelta
        ) = oracle.attestations(0);

        assertEq(subjectId, SUBJECT);
        assertEq(claim, "ETH > $4k by Friday");
        assertEq(estimateBps, 7100);
        assertEq(timestamp, uint64(block.timestamp));
        assertEq(resolved, false);
        assertEq(outcome, false);
        assertEq(scoreDelta, 0);
    }

    function test_LogRevertsOnBpsOverHundredPercent() public {
        vm.expectRevert(bytes("bps > 100%"));
        oracle.log(SUBJECT, "impossible", 10001);
    }

    function test_OnlyAgentCanLog() public {
        vm.prank(STRANGER);
        vm.expectRevert(bytes("not agent"));
        oracle.log(SUBJECT, "nope", 5000);
    }

    function test_ResolveSetsOutcomeAndEmits() public {
        uint256 id = oracle.log(SUBJECT, "ETH > $4k by Friday", 7100);

        vm.expectEmit(true, false, false, true);
        emit Resolved(id, true, 290);

        oracle.resolve(id, true, 290);

        (, , , , bool resolved, bool outcome, int256 scoreDelta) = oracle.attestations(id);
        assertEq(resolved, true);
        assertEq(outcome, true);
        assertEq(scoreDelta, 290);
        assertEq(oracle.resolvedCount(), 1);
    }

    function test_ResolveSupportsNegativeScoreDelta() public {
        uint256 id = oracle.log(SUBJECT, "wrong call", 8000);
        oracle.resolve(id, false, -150);

        (, , , , , , int256 scoreDelta) = oracle.attestations(id);
        assertEq(scoreDelta, -150);
    }

    function test_CannotResolveTwice() public {
        uint256 id = oracle.log(SUBJECT, "once only", 6000);
        oracle.resolve(id, true, 100);

        vm.expectRevert(bytes("already resolved"));
        oracle.resolve(id, false, -100);
    }

    function test_OnlyAgentCanResolve() public {
        uint256 id = oracle.log(SUBJECT, "guarded", 5000);

        vm.prank(STRANGER);
        vm.expectRevert(bytes("not agent"));
        oracle.resolve(id, true, 1);
    }

    function test_CountAndResolvedCountTrackState() public {
        oracle.log(SUBJECT, "a", 5000);
        oracle.log(SUBJECT, "b", 5100);
        uint256 idC = oracle.log(SUBJECT, "c", 5200);

        assertEq(oracle.count(), 3);
        assertEq(oracle.resolvedCount(), 0);

        oracle.resolve(idC, true, 10);
        assertEq(oracle.resolvedCount(), 1);
    }

    /// @dev Fuzz: any valid bps logs cleanly and round-trips through storage.
    function testFuzz_LogAcceptsValidBps(uint16 bps) public {
        bps = uint16(bound(bps, 0, 10000));
        uint256 id = oracle.log(SUBJECT, "fuzz", bps);
        (, , uint16 stored, , , , ) = oracle.attestations(id);
        assertEq(stored, bps);
    }
}
