// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {RoninReactive} from "../src/RoninReactive.sol";

/// Step 3 (Lasna, once per chain): register a chain's contracts with the Reactive contract.
/// Env: DEPLOYER_PK, RSC, CHAIN_ID (84532 or 1301), VAULT, REQUESTER, REGISTRY, POOL_B
///   MOCK mode: also POOL_A.
///   AAVE mode: AAVE_ADAPTER, AAVE_POOL, AAVE_ASSET (POOL_A is not used; the adapter takes its place).
contract WireReactive is Script {
    function run() external {
        uint256 chainId = vm.envUint("CHAIN_ID");
        address adapter = vm.envOr("AAVE_ADAPTER", address(0));
        RoninReactive rsc = RoninReactive(payable(vm.envAddress("RSC")));

        address[] memory pools;
        if (adapter != address(0)) {
            pools = new address[](1);
            pools[0] = vm.envAddress("POOL_B"); // mock stress pool emits RateUpdated; the adapter is fed by Aave
        } else {
            pools = new address[](2);
            pools[0] = vm.envAddress("POOL_A");
            pools[1] = vm.envAddress("POOL_B");
        }

        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));
        rsc.configureChain(chainId, vm.envAddress("VAULT"), vm.envAddress("REQUESTER"), vm.envAddress("REGISTRY"), pools);
        if (adapter != address(0)) {
            rsc.configureAave(chainId, vm.envAddress("AAVE_POOL"), vm.envAddress("AAVE_ASSET"), adapter);
        }
        vm.stopBroadcast();
        console.log("chain %s wired", chainId);
    }
}
