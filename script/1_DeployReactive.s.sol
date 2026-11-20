// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {RoninReactive} from "../src/RoninReactive.sol";

/// Step 1 (Lasna): the single Reactive contract that orchestrates every chain.
/// Needs env: DEPLOYER_PK. Optional: RSC_FUND_WEI (default 2 lREACT), STALE_AFTER (default 900s),
/// RSC_RESCORE_TICKS (default 0 = no scheduled re-score, the cheapest state).
contract DeployReactive is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);
        RoninReactive rsc = new RoninReactive{value: vm.envOr("RSC_FUND_WEI", uint256(2 ether))}(
            50, // minGapBps: 0.50% yield gap worth acting on
            9500, // breakerUtilBps: 95% utilisation trips the breaker
            150, // spikeBps: a 1.50% jump vs the EMA wakes the AI
            vm.envOr("STALE_AFTER", uint256(900)), // seconds of silence before a chain is paused
            15, // requestCooldown seconds per chain
            // 0 = no scheduled re-score: with no plans, no unacked action and the watchdog off, the RSC
            // never subscribes to Cron100 and burns nothing. Turn it on for a demo with setParams().
            vm.envOr("RSC_RESCORE_TICKS", uint256(0))
        );
        vm.stopBroadcast();
        console.log("RSC=%s", address(rsc));
    }
}
