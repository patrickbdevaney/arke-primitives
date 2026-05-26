// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AttestationOracle} from "../src/AttestationOracle.sol";

/// @title Deploy
/// @notice Deploys AttestationOracle to Arc testnet.
///
/// Usage:
///   export PRIVATE_KEY=0x...            # a THROWAWAY testnet key
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url arc_testnet \
///     --broadcast
///
/// ARC NOTE: if the broadcast fails with an out-of-gas / underpriced error,
/// gas estimation likely came in low — re-run with an explicit
/// `--gas-limit 2000000`. Gas is paid in USDC (6 decimals) on Arc.
contract Deploy is Script {
    function run() external returns (AttestationOracle oracle) {
        // vm.envUint reads PRIVATE_KEY from the environment at run time. It is
        // only needed for `forge script`, not for `forge build`/`forge test`.
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        oracle = new AttestationOracle();
        vm.stopBroadcast();

        console2.log("AttestationOracle deployed at:", address(oracle));
        console2.log("Set NEXT_PUBLIC_ORACLE_ADDRESS to that address in .env.local");
    }
}
