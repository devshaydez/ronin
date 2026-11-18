// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockLendingPool} from "../src/mocks/MockLendingPool.sol";
import {DecisionRequester} from "../src/DecisionRequester.sol";
import {AIVerdictRegistry} from "../src/AIVerdictRegistry.sol";
import {RoninVault} from "../src/RoninVault.sol";
import {IAIVerdictRegistry} from "../src/interfaces/IAIVerdictRegistry.sol";
import {IDecisionRequester} from "../src/interfaces/IDecisionRequester.sol";

/// Vault + registry tests. The callback proxy and Reactive contract are simulated with plain addresses,
/// since the destination contracts only check msg.sender == proxy and the injected first argument == rsc.
contract RoninVaultTest is Test {
    MockUSDC usdc;
    MockLendingPool poolA;
    MockLendingPool poolB;
    DecisionRequester requester;
    AIVerdictRegistry registry;
    RoninVault vault;

    address payable proxy = payable(makeAddr("proxy"));
    address rsc = makeAddr("rsc");
    address poster = makeAddr("poster");
    address alice = makeAddr("alice");

    function setUp() public {
        usdc = new MockUSDC();
        poolA = new MockLendingPool(usdc, "A", 400, 3000, address(this));
        poolB = new MockLendingPool(usdc, "B", 300, 3000, address(this));
        requester = new DecisionRequester(IPayable(proxy), rsc);
        registry = new AIVerdictRegistry(poster, IDecisionRequester(address(requester)));

        address[] memory pools = new address[](2);
        pools[0] = address(poolA);
        pools[1] = address(poolB);
        vault = new RoninVault(IPayable(proxy), rsc, IERC20(address(usdc)), IAIVerdictRegistry(address(registry)), pools);

        usdc.mint(alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e6, alice);
        vm.stopPrank();
    }

    /// Simulates the Reactive contract asking for a decision (hop 1), returns the request id.
    function _request() internal returns (uint256) {
        vm.prank(proxy);
        requester.requestDecision(rsc, address(poolB), 900, 450, 3000, 500, 4000, 1);
        return requester.count();
    }

    /// Simulates the AI answering a request (hop 2), returns the verdict id.
    function _post(uint8 action, uint16 conf, address target) internal returns (uint256) {
        uint256 req = _request();
        string memory why = "test";
        vm.prank(poster);
        return registry.postVerdict(req, action, conf, target, keccak256(bytes(why)), why);
    }

    function test_depositGoesToBestPool() public view {
        assertEq(poolA.balanceOf(address(vault)), 1_000e6);
        assertEq(vault.totalAssets(), 1_000e6);
    }

    function test_rebalanceMovesToBetterPool() public {
        poolB.setRate(900, 3000); // B now out-yields A
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.prank(proxy);
        vault.rebalance(rsc, id, address(poolB));
        assertEq(poolB.balanceOf(address(vault)), 500e6); // cap: 50% of TVL per rebalance
        assertEq(poolA.balanceOf(address(vault)), 500e6);
        assertEq(vault.totalAssets(), 1_000e6);
    }

    function test_profitGateSkipsATinyGain() public {
        poolB.setRate(410, 3000); // only 10 bps better than A (400): 500 USDC * 0.10% = 0.5 USDC per year
        vault.setMinAnnualGain(1e6); // require at least 1 USDC per year
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.prank(proxy);
        vault.rebalance(rsc, id, address(poolB));
        assertEq(poolA.balanceOf(address(vault)), 1_000e6); // nothing moved
        assertEq(poolB.balanceOf(address(vault)), 0);
    }

    function test_profitGateAllowsWorthwhileMove() public {
        poolB.setRate(900, 3000); // 500 USDC * 5% = 25 USDC per year
        vault.setMinAnnualGain(1e6);
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.prank(proxy);
        vault.rebalance(rsc, id, address(poolB));
        assertEq(poolB.balanceOf(address(vault)), 500e6);
    }

    function test_rebalanceRevertsForWrongCaller() public {
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.expectRevert();
        vault.rebalance(rsc, id, address(poolB)); // not the proxy
    }

    function test_rebalanceRevertsForWrongReactiveSender() public {
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.prank(proxy);
        vm.expectRevert();
        vault.rebalance(makeAddr("attacker"), id, address(poolB));
    }

    function test_lowConfidenceRejected() public {
        poolB.setRate(900, 3000);
        uint256 id = _post(1, 5000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.prank(proxy);
        vm.expectRevert("low confidence");
        vault.rebalance(rsc, id, address(poolB));
    }

    function test_verdictCannotBeReplayed() public {
        poolB.setRate(900, 3000);
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 30);
        vm.startPrank(proxy);
        vault.rebalance(rsc, id, address(poolB));
        vm.warp(vm.getBlockTimestamp() + 30);
        vm.expectRevert("verdict used");
        vault.rebalance(rsc, id, address(poolB));
        vm.stopPrank();
    }

    function test_staleVerdictRejected() public {
        poolB.setRate(900, 3000);
        uint256 id = _post(1, 9000, address(poolB));
        vm.warp(block.timestamp + 1 hours);
        vm.prank(proxy);
        vm.expectRevert("stale verdict");
        vault.rebalance(rsc, id, address(poolB));
    }

    function test_pauseVerdictBlocksDeposits() public {
        uint256 id = _post(3, 9000, address(0));
        vm.prank(proxy);
        vault.pauseByVerdict(rsc, id);
        assertTrue(vault.paused());
        assertEq(vault.maxDeposit(alice), 0);
    }

    function test_emergencyExitFreezesPoolAndPullsFunds() public {
        vm.prank(proxy);
        vault.emergencyExit(rsc, address(poolA));
        assertEq(poolA.balanceOf(address(vault)), 0);
        assertEq(usdc.balanceOf(address(vault)), 1_000e6);
        assertTrue(vault.poolFrozen(address(poolA)));
        assertEq(vault.totalAssets(), 1_000e6);
    }

    function test_withdrawPullsFromPools() public {
        vm.prank(alice);
        vault.withdraw(400e6, alice, alice);
        assertEq(usdc.balanceOf(alice), 400e6);
        assertEq(vault.totalAssets(), 600e6);
    }

    // ── registry is bound to Reactive-originated requests ──

    function test_onlyPosterCanPostVerdicts() public {
        uint256 req = _request();
        vm.expectRevert("only poster");
        registry.postVerdict(req, 1, 9000, address(poolB), keccak256("x"), "x");
    }

    function test_unsolicitedVerdictRejected() public {
        vm.prank(poster);
        vm.expectRevert("unknown request");
        registry.postVerdict(999, 1, 9000, address(poolB), keccak256("x"), "x");
    }

    function test_requestCanOnlyBeAnsweredOnce() public {
        uint256 req = _request();
        vm.startPrank(poster);
        registry.postVerdict(req, 2, 9000, address(0), keccak256("x"), "x");
        vm.expectRevert("already answered");
        registry.postVerdict(req, 1, 9000, address(poolB), keccak256("x"), "x");
        vm.stopPrank();
    }

    function test_requesterRejectsNonProxy() public {
        vm.expectRevert();
        requester.requestDecision(rsc, address(poolB), 1, 1, 1, 1, 1, 1);
    }

    // ── Reactive-only pause / heal / omni signal ──

    function test_reactivePauseAndSameReasonHeal() public {
        bytes32 reason = keccak256("STALE_DATA");
        vm.startPrank(proxy);
        vault.pauseByReactive(rsc, reason);
        assertTrue(vault.paused());
        vault.unpauseByReactive(rsc, keccak256("OTHER")); // wrong reason: no-op
        assertTrue(vault.paused());
        vault.unpauseByReactive(rsc, reason);
        vm.stopPrank();
        assertFalse(vault.paused());
    }

    function test_reactiveCannotLiftAnAIPause() public {
        uint256 id = _post(3, 9000, address(0));
        vm.startPrank(proxy);
        vault.pauseByVerdict(rsc, id);
        vault.unpauseByReactive(rsc, keccak256("STALE_DATA"));
        vault.unpauseByReactive(rsc, keccak256("OMNI_BREAKER"));
        vm.stopPrank();
        assertTrue(vault.paused());
    }

    function test_omniSignalStored() public {
        vm.prank(proxy);
        vault.updateOmniSignal(rsc, 500, 900, 1301);
        assertEq(vault.globalBestBps(), 900);
        assertEq(vault.globalBestChainId(), 1301);
    }

    function test_addPoolOnlyAdmin() public {
        address p = makeAddr("newPool");
        vm.prank(alice);
        vm.expectRevert("only admin");
        vault.addPool(p);
        vault.addPool(p);
        assertTrue(vault.isPool(p));
    }
}
