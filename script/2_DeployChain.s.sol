// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockLendingPool} from "../src/mocks/MockLendingPool.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {DecisionRequester} from "../src/DecisionRequester.sol";
import {AIVerdictRegistry} from "../src/AIVerdictRegistry.sol";
import {RoninVault} from "../src/RoninVault.sol";
import {IAIVerdictRegistry} from "../src/interfaces/IAIVerdictRegistry.sol";
import {IDecisionRequester} from "../src/interfaces/IDecisionRequester.sol";

interface IAaveReserves {
    function getReservesList() external view returns (address[] memory);
}

/// Step 2 (run once per chain).
/// Env: DEPLOYER_PK, AI_POSTER_PK, RSC, CALLBACK_PROXY (this chain's callback proxy).
/// Optional: FUND_WEI (ETH sent to EACH of requester and vault, default 0.005).
///
/// Two modes:
///  * MOCK (default): MockUSDC + two controllable mock pools.
///  * AAVE: set AAVE_POOL. If AAVE_ASSET is not set, the script prints Aave's reserve list and stops, so you can
///    pick the USDC reserve. With AAVE_ASSET set, the vault holds that real token and its pools are
///    [AaveV3Adapter (real Aave), one controllable mock "stress" pool on the same token].
contract DeployChain is Script {
    function run() external {
        address aavePool = vm.envOr("AAVE_POOL", address(0));
        address aaveAsset = vm.envOr("AAVE_ASSET", address(0));

        if (aavePool != address(0) && aaveAsset == address(0)) {
            address[] memory list = IAaveReserves(aavePool).getReservesList();
            console.log("Aave reserves on this chain (set AAVE_ASSET to the USDC one):");
            for (uint256 i = 0; i < list.length; i++) {
                console.log(list[i]);
            }
            revert("set AAVE_ASSET and re-run");
        }

        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        address poster = vm.addr(vm.envUint("AI_POSTER_PK"));
        address rsc = vm.envAddress("RSC");
        IPayable proxy = IPayable(payable(vm.envAddress("CALLBACK_PROXY")));
        uint256 fund = vm.envOr("FUND_WEI", uint256(0.005 ether));

        vm.startBroadcast(pk);

        IERC20 token;
        address[] memory pools = new address[](2);
        if (aavePool != address(0)) {
            token = IERC20(aaveAsset);
            AaveV3Adapter adapter = new AaveV3Adapter(aavePool, token, "Aave V3");
            MockLendingPool stress = new MockLendingPool(token, "Stress Pool", 300, 3500, deployer);
            pools[0] = address(adapter);
            pools[1] = address(stress);
            console.log("AAVE_ADAPTER=%s", address(adapter));
            console.log("POOL_B=%s", address(stress));
        } else {
            MockUSDC usdc = new MockUSDC();
            token = IERC20(address(usdc));
            MockLendingPool poolA = new MockLendingPool(token, "Pool A", 500, 4000, deployer);
            MockLendingPool poolB = new MockLendingPool(token, "Pool B", 450, 3500, deployer);
            pools[0] = address(poolA);
            pools[1] = address(poolB);
            usdc.mint(deployer, 100_000e6);
            console.log("POOL_A=%s", address(poolA));
            console.log("POOL_B=%s", address(poolB));
        }

        DecisionRequester requester = new DecisionRequester{value: fund}(proxy, rsc);
        AIVerdictRegistry registry = new AIVerdictRegistry(poster, IDecisionRequester(address(requester)));
        RoninVault vault = new RoninVault{value: fund}(proxy, rsc, token, IAIVerdictRegistry(address(registry)), pools);
        vm.stopBroadcast();

        console.log("chainId=%s", block.chainid);
        console.log("ASSET=%s", address(token));
        console.log("REQUESTER=%s", address(requester));
        console.log("REGISTRY=%s", address(registry));
        console.log("VAULT=%s", address(vault));
    }
}
