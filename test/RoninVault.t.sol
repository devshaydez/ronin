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
    address bob = makeAddr("bob");

    event PlanCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed payee,
        uint128 amount,
        uint32 period,
        uint64 nextDue,
        uint16 remaining,
        RoninVault.PayoutMode mode
    );
    event PlanExecuted(
        uint256 indexed id,
        address indexed payee,
        uint256 amount,
        uint256 fromYield,
        uint256 fromPrincipal,
        uint64 nextDue,
        uint16 remaining
    );
    event PlanSkipped(uint256 indexed id, string reason);
    event PlanExpired(uint256 indexed id);
    event PlanCancelled(uint256 indexed id);

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

    // ───────────── standing orders ─────────────

    function _create(RoninVault.PayoutMode mode, uint128 amount, uint32 period, uint16 count)
        internal
        returns (uint256 id)
    {
        vm.prank(alice);
        id = vault.createPlan(bob, amount, period, count, mode);
    }

    function _pay(uint256 id) internal {
        vm.prank(proxy);
        vault.executePlan(rsc, id);
    }

    function _accrue(uint256 yield) internal {
        usdc.mint(address(poolA), yield);
        poolA.accrue(address(vault), yield);
    }

    function test_createPlanValidatesInputsAndStoresEvent() public {
        vm.startPrank(alice);
        vm.expectRevert("payee required");
        vault.createPlan(address(0), 1e6, 120, 1, RoninVault.PayoutMode.YIELD_ONLY);
        vm.expectRevert("amount required");
        vault.createPlan(bob, 0, 120, 1, RoninVault.PayoutMode.YIELD_ONLY);
        vm.expectRevert("period too short");
        vault.createPlan(bob, 1e6, 119, 1, RoninVault.PayoutMode.YIELD_ONLY);
        vm.expectRevert("count out of range");
        vault.createPlan(bob, 1e6, 120, 0, RoninVault.PayoutMode.YIELD_ONLY);
        vm.expectRevert("count out of range");
        vault.createPlan(bob, 1e6, 120, 366, RoninVault.PayoutMode.YIELD_ONLY);
        vm.stopPrank();

        uint64 due = uint64(block.timestamp + 120);
        vm.expectEmit(true, true, true, true, address(vault));
        emit PlanCreated(1, alice, bob, 10e6, 120, due, 3, RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 10e6, 120, 3);
        assertEq(id, 1);
        assertEq(vault.planCount(), 1);
        RoninVault.Plan memory p = vault.plans(id);
        assertEq(p.owner, alice);
        assertEq(p.payee, bob);
        assertEq(p.amount, 10e6);
        assertEq(p.period, 120);
        assertEq(p.nextDue, due);
        assertEq(p.remaining, 3);
        assertTrue(p.active);
    }

    function test_planPayoutMovesTheRightSharesAndAssets() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 10e6, 120, 3);
        uint256 supplyBefore = vault.totalSupply();
        uint256 assetsBefore = vault.totalAssets();
        uint256 shares = vault.previewWithdraw(10e6);
        uint256 basisBefore = vault.costBasis(alice);
        vm.warp(t0 + 120);

        _pay(id);

        assertEq(usdc.balanceOf(bob), 10e6);
        assertEq(vault.totalAssets(), assetsBefore - 10e6);
        assertEq(vault.totalSupply(), supplyBefore - shares);
        assertEq(vault.balanceOf(alice), supplyBefore - shares);
        assertLt(vault.costBasis(alice), basisBefore); // proportional reduction, never more than the payout
        assertGe(vault.convertToAssets(vault.balanceOf(alice)), vault.costBasis(alice));
    }

    function test_planNextDueIsDriftFree() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 1e6, 120, 5);
        vm.warp(t0 + 120);
        _pay(id);
        assertEq(vault.plans(id).nextDue, t0 + 240);

        // Pay very late: the next due date still advances from the previous due date, not from now.
        vm.warp(t0 + 900);
        _pay(id);
        assertEq(vault.plans(id).nextDue, t0 + 360);
    }

    function test_planCannotPayBeforeDue() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 1e6, 120, 1);
        vm.warp(t0 + 119);
        vm.prank(proxy);
        vm.expectRevert("not due");
        vault.executePlan(rsc, id);
    }

    function test_planDeactivatesAfterLastPayment() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 1e6, 120, 1);
        vm.warp(t0 + 120);
        _pay(id);
        RoninVault.Plan memory p = vault.plans(id);
        assertEq(p.remaining, 0);
        assertFalse(p.active);
        vm.prank(proxy);
        vm.expectRevert("inactive");
        vault.executePlan(rsc, id);
    }

    function test_principalSkipConsumesAPaymentAndKeepsGoing() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 2_000e6, 120, 2);
        uint256 before = vault.totalAssets();
        vm.warp(t0 + 120);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PlanSkipped(id, "insufficient");
        _pay(id);
        RoninVault.Plan memory p = vault.plans(id);
        assertEq(p.remaining, 1);
        assertTrue(p.active);
        assertEq(vault.totalAssets(), before);

        vm.warp(t0 + 240);
        _pay(id);
        p = vault.plans(id);
        assertEq(p.remaining, 0);
        assertFalse(p.active);
    }

    function test_executePlanOnlyThroughProxyAndReactive() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 1e6, 120, 1);
        vm.warp(t0 + 120);

        vm.expectRevert();
        vault.executePlan(rsc, id); // direct call, not the proxy

        vm.prank(proxy);
        vm.expectRevert();
        vault.executePlan(makeAddr("attacker"), id); // proxy but wrong injected RSC
    }

    function test_cancelPlanOnlyOwner() public {
        uint256 id = _create(RoninVault.PayoutMode.YIELD_ONLY, 1e6, 120, 3);
        vm.prank(bob);
        vm.expectRevert("only plan owner");
        vault.cancelPlan(id);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PlanCancelled(id);
        vm.prank(alice);
        vault.cancelPlan(id);
        RoninVault.Plan memory p = vault.plans(id);
        assertFalse(p.active);
        vm.prank(proxy);
        vm.expectRevert("inactive");
        vault.executePlan(rsc, id);
    }

    function test_planPaysWhilePaused() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 5e6, 120, 1);
        vm.prank(proxy);
        vault.pauseByReactive(rsc, keccak256("TEST_PAUSE"));
        assertTrue(vault.paused());
        vm.warp(t0 + 120);
        _pay(id);
        assertEq(usdc.balanceOf(bob), 5e6);
    }

    // ───────────── payout modes ─────────────

    function test_yieldOnlySkipsWithoutYieldAndDoesNotConsumeAPayment() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_ONLY, 10e6, 120, 3);
        uint64 due = vault.plans(id).nextDue;
        vm.warp(t0 + 120);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PlanSkipped(id, "no yield yet");
        _pay(id);

        RoninVault.Plan memory p = vault.plans(id);
        assertEq(p.remaining, 3); // untouched in YIELD_ONLY
        assertEq(p.nextDue, due + 120);
        assertEq(uint256(p.mode), uint256(RoninVault.PayoutMode.YIELD_ONLY));
        assertEq(p.skips, 1);
        assertTrue(p.active);
        assertEq(vault.costBasis(alice), 1_000e6);
        assertEq(usdc.balanceOf(bob), 0);
    }

    function test_yieldOnlyPaysAfterYieldAccruesAndNeverTouchesPrincipal() public {
        _accrue(50e6); // position now worth 1050, basis 1000 -> 50 available
        uint256 id = _create(RoninVault.PayoutMode.YIELD_ONLY, 10e6, 120, 3);
        uint64 due = vault.plans(id).nextDue;
        vm.warp(due);

        vm.expectEmit(true, true, false, true, address(vault));
        emit PlanExecuted(id, bob, 10e6, 10e6, 0, due + 120, 2);
        _pay(id);

        assertEq(usdc.balanceOf(bob), 10e6);
        // Principal is untouched: the whole payout came out of yield.
        assertEq(vault.costBasis(alice), 1_000e6);
        assertApproxEqAbs(vault.yieldAvailable(alice), 40e6, 2);
        assertGe(vault.convertToAssets(vault.balanceOf(alice)), vault.costBasis(alice));
    }

    function test_sixYieldOnlyPayoutsLeavePrincipalUntouched() public {
        _accrue(100e6); // worth 1100, basis 1000 -> 100 available
        uint256 id = _create(RoninVault.PayoutMode.YIELD_ONLY, 10e6, 120, 6);
        uint256 basis = vault.costBasis(alice);
        uint256 y0 = vault.yieldAvailable(alice);
        uint256 paid;

        for (uint256 i = 0; i < 6; i++) {
            uint256 before = vault.yieldAvailable(alice);
            vm.warp(vault.plans(id).nextDue);
            _pay(id);
            paid += 10e6;
            assertEq(vault.costBasis(alice), basis, "principal moved");
            // Each payout removes exactly its amount from the yield pot.
            assertApproxEqAbs(before - vault.yieldAvailable(alice), 10e6, 2);
        }

        assertEq(vault.costBasis(alice), basis);
        assertEq(usdc.balanceOf(bob), paid);
        assertApproxEqAbs(vault.yieldAvailable(alice), y0 - paid, 3);
    }

    function test_withdrawingPartOfTheYieldLeavesBasisUnchanged() public {
        _accrue(100e6);
        uint256 basis = vault.costBasis(alice);
        uint256 y0 = vault.yieldAvailable(alice);

        vm.prank(alice);
        vault.withdraw(30e6, alice, alice);

        assertEq(vault.costBasis(alice), basis);
        assertApproxEqAbs(vault.yieldAvailable(alice), y0 - 30e6, 2);
    }

    function test_yieldOnlyExpiresAfterMaxSkips() public {
        vault.setMaxSkips(2);
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_ONLY, 1e6, 120, 3);
        vm.warp(t0 + 120);
        _pay(id);
        RoninVault.Plan memory p = vault.plans(id);
        assertTrue(p.active);
        assertEq(p.skips, 1);

        vm.warp(t0 + 240);
        vm.expectEmit(true, false, false, true, address(vault));
        emit PlanExpired(id);
        _pay(id);
        p = vault.plans(id);
        assertFalse(p.active);
    }

    function test_yieldThenPrincipalSplitsYieldAndPrincipal() public {
        _accrue(5e6);
        uint256 id = _create(RoninVault.PayoutMode.YIELD_THEN_PRINCIPAL, 10e6, 120, 3);
        uint64 due = vault.plans(id).nextDue;
        vm.warp(due);

        uint256 expectedYield = vault.yieldAvailable(alice); // ERC-4626 virtual offset rounds it down by 1 wei
        uint256 basisBefore = vault.costBasis(alice);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PlanExecuted(id, bob, 10e6, expectedYield, 10e6 - expectedYield, due + 120, 2);
        _pay(id);

        assertEq(usdc.balanceOf(bob), 10e6);
        // Yield is consumed first, so only the principal component reduces cost basis.
        assertEq(vault.costBasis(alice), basisBefore - (10e6 - expectedYield));
        assertLt(vault.costBasis(alice), basisBefore);
        assertGe(vault.convertToAssets(vault.balanceOf(alice)), vault.costBasis(alice));
    }

    // ───────────── cost basis ─────────────

    function test_costBasisMovesProportionallyOnTransfer() public {
        uint256 total = vault.costBasis(alice) + vault.costBasis(bob);
        vm.prank(alice);
        vault.transfer(bob, 250e6);
        assertEq(vault.costBasis(alice), 750e6);
        assertEq(vault.costBasis(bob), 250e6);
        assertEq(vault.costBasis(alice) + vault.costBasis(bob), total);
        assertGe(vault.convertToAssets(vault.balanceOf(bob)), vault.costBasis(bob));
    }

    function testFuzz_transferKeepsTotalCostBasis(uint96 transferAmount) public {
        uint256 total = vault.costBasis(alice) + vault.costBasis(bob);
        uint256 xfer = bound(uint256(transferAmount), 0, vault.balanceOf(alice));
        vm.prank(alice);
        vault.transfer(bob, xfer);
        assertEq(vault.costBasis(alice) + vault.costBasis(bob), total);
    }

    function test_costBasisMovesWithAccruedYieldToo() public {
        _accrue(100e6);
        vm.prank(alice);
        vault.transfer(bob, 500e6);
        assertApproxEqAbs(vault.costBasis(alice), 500e6, 1);
        assertApproxEqAbs(vault.costBasis(bob), 500e6, 1);
        assertGe(vault.convertToAssets(vault.balanceOf(bob)), vault.costBasis(bob));
        assertApproxEqAbs(vault.yieldAvailable(alice), 50e6, 2);
        assertApproxEqAbs(vault.yieldAvailable(bob), 50e6, 2);
    }

    function test_fullWithdrawLeavesZeroCostBasis() public {
        _accrue(25e6);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertEq(vault.costBasis(alice), 0);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.yieldAvailable(alice), 0);
    }

    function testFuzz_costBasisNeverExceedsPosition(uint96 transferAmount, uint96 withdrawAssets) public {
        _accrue(80e6);
        uint256 xfer = bound(uint256(transferAmount), 0, vault.balanceOf(alice));
        vm.prank(alice);
        vault.transfer(bob, xfer);

        uint256 wd = bound(uint256(withdrawAssets), 0, vault.maxWithdraw(alice));
        if (wd > 0) {
            vm.prank(alice);
            vault.withdraw(wd, alice, alice);
        }
        assertGe(vault.convertToAssets(vault.balanceOf(alice)), vault.costBasis(alice));
        assertGe(vault.convertToAssets(vault.balanceOf(bob)), vault.costBasis(bob));
    }

    /// After any sequence of deposits, accruals, yield-only payouts, withdrawals and transfers, an account's
    /// position is never worth less than the principal it still has on the books.
    function testFuzz_valueAlwaysCoversCostBasis(
        uint96 extraDeposit,
        uint96 accrue1,
        uint96 payoutAmount,
        uint96 withdrawAssets,
        uint96 transferAmount,
        uint96 accrue2
    ) public {
        uint256 dep = bound(uint256(extraDeposit), 0, 500e6);
        if (dep > 0) {
            usdc.mint(alice, dep);
            vm.startPrank(alice);
            usdc.approve(address(vault), type(uint256).max);
            vault.deposit(dep, alice);
            vm.stopPrank();
        }

        _accrue(bound(uint256(accrue1), 0, 200e6));

        uint256 id = _create(
            RoninVault.PayoutMode.YIELD_ONLY, uint128(bound(uint256(payoutAmount), 1, 50e6)), 120, 3
        );
        vm.warp(vault.plans(id).nextDue);
        _pay(id);

        uint256 wd = bound(uint256(withdrawAssets), 0, vault.maxWithdraw(alice));
        if (wd > 0) {
            vm.prank(alice);
            vault.withdraw(wd, alice, alice);
        }

        uint256 xfer = bound(uint256(transferAmount), 0, vault.balanceOf(alice));
        if (xfer > 0) {
            vm.prank(alice);
            vault.transfer(bob, xfer);
        }

        _accrue(bound(uint256(accrue2), 0, 100e6));
        vm.warp(vault.plans(id).nextDue);
        _pay(id);

        assertGe(vault.convertToAssets(vault.balanceOf(alice)), vault.costBasis(alice));
        assertGe(vault.convertToAssets(vault.balanceOf(bob)), vault.costBasis(bob));
    }
}
