// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, Vm} from "forge-std/Test.sol";
import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {RoninReactive} from "../src/RoninReactive.sol";
import {IVaultCallbacks, IRequesterCallbacks} from "../src/interfaces/IRoninCallbacks.sol";

/// Stand-in for the Reactive system contract. Records subscriptions and callback requests so the
/// tests can assert exactly what RoninReactive asked the network to do.
contract MockSystem {
    struct Cb {
        uint256 chainId;
        address recipient;
        bytes payload;
    }

    Cb[] public cbs;
    uint256 public subs;
    uint256 public unsubs;

    function subscribe(uint256, address, uint256, uint256, uint256, uint256) external {
        subs++;
    }

    function unsubscribe(uint256, address, uint256, uint256, uint256, uint256) external {
        unsubs++;
    }

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory c) external {
        cbs.push(Cb(c.chainId, c.recipient, c.payload));
    }

    function cbCount() external view returns (uint256) {
        return cbs.length;
    }

    // economy stand-ins
    uint256 public reservesValue;
    uint256 public depositedTotal;

    function setReserves(uint256 v) external {
        reservesValue = v;
    }

    function reserves(address) external view returns (uint256) {
        return reservesValue;
    }

    function depositTo(address) external payable {
        depositedTotal += msg.value;
    }
}

contract RoninReactiveTest is Test {
    address constant SYSTEM = 0x8888888888888888888888888888888888888888;
    uint256 constant BASE = 84532;
    uint256 constant UNI = 1301;

    RoninReactive rsc;

    address vaultB = makeAddr("vaultBase");
    address reqB = makeAddr("requesterBase");
    address regB = makeAddr("registryBase");
    address poolA = makeAddr("poolA");
    address poolB = makeAddr("poolB");

    address vaultU = makeAddr("vaultUni");
    address reqU = makeAddr("requesterUni");
    address regU = makeAddr("registryUni");
    address poolC = makeAddr("poolC");
    address poolD = makeAddr("poolD");

    function setUp() public {
        vm.warp(1_000_000);
        vm.etch(SYSTEM, address(new MockSystem()).code);
        // minGap 50, breaker 95%, spike 150, stale 900s, no request cooldown, rescore every 2 ticks
        rsc = new RoninReactive(50, 9500, 150, 900, 0, 2);
        _configure(BASE, vaultB, reqB, regB, poolA, poolB);
    }

    // ───────────── helpers ─────────────

    function _configure(uint256 chainId, address v, address rq, address rg, address p1, address p2) internal {
        address[] memory pools = new address[](2);
        pools[0] = p1;
        pools[1] = p2;
        rsc.configureChain(chainId, v, rq, rg, pools);
    }

    function _log(uint256 chainId, address src, uint256 topic0, uint256 t1, uint256 t2, uint256 opCode, bytes memory data)
        internal
        pure
        returns (IReactive.LogRecord memory l)
    {
        l.chainId = chainId;
        l.contractAddress = src;
        l.topic0 = topic0;
        l.topic1 = t1;
        l.topic2 = t2;
        l.opCode = opCode;
        l.data = data;
    }

    function _react(IReactive.LogRecord memory l) internal {
        vm.prank(SYSTEM);
        rsc.react(l);
    }

    function _rate(uint256 chainId, address pool, uint256 rate, uint256 util) internal {
        _react(_log(chainId, pool, rsc.RATE_TOPIC(), uint256(uint160(pool)), 0, 2, abi.encode(rate, util)));
    }

    function _verdict(uint256 chainId, address reg, uint256 id, address target, uint8 action, uint256 requestId) internal {
        _verdictWithConfidence(chainId, reg, id, target, action, 9000, requestId);
    }

    function _verdictWithConfidence(
        uint256 chainId,
        address reg,
        uint256 id,
        address target,
        uint8 action,
        uint16 confidence,
        uint256 requestId
    ) internal {
        _react(
            _log(
                chainId,
                reg,
                rsc.VERDICT_TOPIC(),
                id,
                uint256(uint160(target)),
                3,
                abi.encode(action, confidence, bytes32(0), requestId)
            )
        );
    }

    function _cbCount() internal view returns (uint256) {
        return MockSystem(SYSTEM).cbCount();
    }

    function _countSel(address recipient, bytes4 sel) internal view returns (uint256 n) {
        for (uint256 i = 0; i < _cbCount(); i++) {
            (, address r, bytes memory payload) = MockSystem(SYSTEM).cbs(i);
            if (r == recipient && bytes4(payload) == sel) n++;
        }
    }

    // ───────────── tests ─────────────

    function test_subscribesToEverythingOnConfigure() public view {
        // cron(1) + vault (rebalanced, skipped, exit, poolAdded, 5 plan events = 9) + registry + requester + 2 pools = 14
        assertEq(MockSystem(SYSTEM).subs(), 14);
    }

    function test_emaAndSpikeComputedOnChain() public {
        _rate(BASE, poolA, 500, 4000);
        (uint256 rate, uint256 ema,,,,,,) = rsc.pool(BASE, poolA);
        assertEq(rate, 500);
        assertEq(ema, 500);
        _rate(BASE, poolA, 900, 4000); // spike of 400 vs ema 500 -> ema = (500*7+900)/8 = 550
        (, ema,,,,,,) = rsc.pool(BASE, poolA);
        assertEq(ema, 550);
        assertGt(rsc.riskScore(BASE, poolA), 0);
    }

    function test_gapWakesTheAIViaRequester() public {
        _rate(BASE, poolA, 500, 4000); // only one pool seen: no gap yet
        assertEq(_cbCount(), 0);
        _rate(BASE, poolB, 450, 3500); // gap = 50 >= minGap -> hop 1
        assertEq(_countSel(reqB, IRequesterCallbacks.requestDecision.selector), 1);
    }

    function test_actVerdictTriggersRebalanceCallback() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500); // B clearly better
        _verdict(BASE, regB, 1, poolB, 1, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 1);
    }

    function test_actVerdictBelowGapIsSkipped() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 510, 3500); // gap 10 < 50
        _verdict(BASE, regB, 1, poolB, 1, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 0);
    }

    function test_ignoreVerdictDoesNothing() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);
        _verdict(BASE, regB, 1, poolB, 2, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 0);
    }

    function test_pauseVerdictTriggersPauseCallback() public {
        _verdict(BASE, regB, 1, address(0), 3, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.pauseByVerdict.selector), 1);
    }

    function test_breakerTripsOnHighUtilisationWithoutAI() public {
        _rate(BASE, poolA, 500, 9700);
        assertEq(_countSel(vaultB, IVaultCallbacks.emergencyExit.selector), 1);
        _rate(BASE, poolA, 500, 9800); // already tripped: no second exit
        assertEq(_countSel(vaultB, IVaultCallbacks.emergencyExit.selector), 1);
    }

    function test_exitOnOneChainPausesTheOtherAndHeals() public {
        _configure(UNI, vaultU, reqU, regU, poolC, poolD);
        _rate(BASE, poolA, 500, 9700); // trips breaker on Base
        // vault confirms the exit
        _react(
            _log(BASE, vaultB, rsc.EXIT_TOPIC(), uint256(uint160(poolA)), 0, 2, abi.encode(uint256(1_000e6)))
        );
        assertEq(_countSel(vaultU, IVaultCallbacks.pauseByReactive.selector), 1);

        _rate(BASE, poolA, 500, 4000); // utilisation back to normal: breaker clears, omni heals
        assertEq(_countSel(vaultU, IVaultCallbacks.unpauseByReactive.selector), 1);
    }

    function test_omniSignalSentToEveryChain() public {
        _configure(UNI, vaultU, reqU, regU, poolC, poolD);
        _rate(BASE, poolA, 500, 4000);
        _rate(UNI, poolC, 800, 4000);
        assertGe(_countSel(vaultB, IVaultCallbacks.updateOmniSignal.selector), 1);
        assertGe(_countSel(vaultU, IVaultCallbacks.updateOmniSignal.selector), 1);
    }

    function test_cronPausesStaleChainAndRateResumeHeals() public {
        rsc.setWatchdog(true); // the watchdog is opt-in
        _rate(BASE, poolA, 500, 4000);
        vm.warp(block.timestamp + 901);
        _react(_log(block.chainid, rsc.LEGACY_SYSTEM(), rsc.CRON100_TOPIC(), 0, 0, 1, ""));
        assertEq(_countSel(vaultB, IVaultCallbacks.pauseByReactive.selector), 1);

        _rate(BASE, poolA, 500, 4000); // data flows again
        assertEq(_countSel(vaultB, IVaultCallbacks.unpauseByReactive.selector), 1);
    }

    function test_cronScheduledRescoreRequestsDecision() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 500, 4000); // no gap, no spike: no request
        assertEq(_countSel(reqB, IRequesterCallbacks.requestDecision.selector), 0);
        _react(_log(block.chainid, rsc.LEGACY_SYSTEM(), rsc.CRON100_TOPIC(), 0, 0, 1, "")); // tick 1
        _react(_log(block.chainid, rsc.LEGACY_SYSTEM(), rsc.CRON100_TOPIC(), 0, 0, 1, "")); // tick 2 -> rescore
        assertEq(_countSel(reqB, IRequesterCallbacks.requestDecision.selector), 1);
    }

    function test_poolAddedSubscribesDynamically() public {
        uint256 before = MockSystem(SYSTEM).subs();
        address newPool = makeAddr("newPool");
        _react(_log(BASE, vaultB, rsc.POOL_ADDED_TOPIC(), uint256(uint160(newPool)), 0, 2, ""));
        assertEq(MockSystem(SYSTEM).subs(), before + 1);
        assertTrue(rsc.isWatched(BASE, newPool));
    }

    function test_loopLatencyMeasuredOnChain() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);
        // request observed at t0
        _react(_log(BASE, reqB, rsc.REQUEST_TOPIC(), 1, uint256(uint160(poolB)), 3, ""));
        vm.warp(block.timestamp + 2);
        _verdict(BASE, regB, 1, poolB, 1, 1);
        vm.warp(block.timestamp + 1);
        _react(_log(BASE, vaultB, rsc.REBALANCED_TOPIC(), 1, uint256(uint160(poolB)), 3, abi.encode(uint256(1), uint256(2))));
        // Chain struct: vault, requester, registry, exists, stalePaused, omniPaused, lastRateAt,
        // lastRequestAt, lastRebalanceAt, rebalances, sentLocal, sentGlobal, sentBestChain,
        // requestWindowStart, requestsInWindow
        (,,,,,,,,, uint256 rebalances,,,,,) = rsc.chains(BASE);
        assertEq(rebalances, 1);
    }

    // ───────────── real Aave feed ─────────────

    function test_aaveTopicMatchesTheRealEventSignature() public view {
        // topic0 of ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256) on Aave V3
        assertEq(rsc.AAVE_RESERVE_TOPIC(), 0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a);
    }

    function _aave(address aavePool, address reserve, uint256 liquidityRateRay, uint256 varBorrowRay) internal {
        _react(
            _log(
                BASE,
                aavePool,
                rsc.AAVE_RESERVE_TOPIC(),
                uint256(uint160(reserve)),
                0,
                2,
                abi.encode(liquidityRateRay, uint256(0), varBorrowRay, uint256(1e27), uint256(1e27))
            )
        );
    }

    function test_aaveEventFeedsTheAdapterRate() public {
        address aavePool = makeAddr("aavePool");
        address reserve = makeAddr("usdc");
        address adapter = makeAddr("adapter");
        rsc.configureAave(BASE, aavePool, reserve, adapter);

        _aave(aavePool, reserve, 5e25, 7e25); // 5% supply, 7% borrow -> rate 500 bps, util ~71%
        (uint256 rate,,,, uint256 util,,,) = rsc.pool(BASE, adapter);
        assertEq(rate, 500);
        assertEq(util, 7142); // 5/7 as bps, floor
    }

    function test_aaveEventForOtherReserveIsIgnored() public {
        address aavePool = makeAddr("aavePool");
        rsc.configureAave(BASE, aavePool, makeAddr("usdc"), makeAddr("adapter"));
        _aave(aavePool, makeAddr("someOtherReserve"), 5e25, 7e25);
        assertEq(_cbCount(), 0);
        (uint256 rate,,,,,,,) = rsc.pool(BASE, makeAddr("adapter"));
        assertEq(rate, 0);
    }

    function test_aaveGapWakesTheAI() public {
        address aavePool = makeAddr("aavePool");
        address reserve = makeAddr("usdc");
        address adapter = makeAddr("adapter");
        rsc.configureAave(BASE, aavePool, reserve, adapter);
        _rate(BASE, poolB, 300, 3500); // mock stress pool at 3%
        _aave(aavePool, reserve, 6e25, 7e25); // Aave at 6%: gap 300 bps
        assertEq(_countSel(reqB, IRequesterCallbacks.requestDecision.selector), 1);
    }

    function _configureAave() internal returns (address aavePool, address reserve, address adapter) {
        aavePool = makeAddr("aavePool");
        reserve = makeAddr("usdc");
        adapter = makeAddr("adapter");
        rsc.configureAave(BASE, aavePool, reserve, adapter);
    }

    function test_configureAaveTurnsTheFeedOnAndCountsItInTheBurnEstimate() public {
        rsc.setParams(50, 9500, 150, 900, 0, 0); // no cron work
        assertEq(rsc.estimatedBurnPerHour(), 0);
        _configureAave();
        assertTrue(rsc.feedOn());
        assertEq(rsc.estimatedBurnPerHour(), rsc.FEED_GAS_PER_HOUR());
    }

    function test_disableFeedUnsubscribesAndDropsTheEstimateToZero() public {
        rsc.setParams(50, 9500, 150, 900, 0, 0);
        _configureAave();
        uint256 unsubs = MockSystem(SYSTEM).unsubs();
        uint256 subs = MockSystem(SYSTEM).subs();

        vm.expectEmit(true, false, false, false);
        emit FeedDisabled(1);
        rsc.disableFeed();

        assertFalse(rsc.feedOn());
        assertEq(MockSystem(SYSTEM).unsubs(), unsubs + 1);
        assertEq(rsc.estimatedBurnPerHour(), 0);

        rsc.enableFeed();
        assertTrue(rsc.feedOn());
        assertEq(MockSystem(SYSTEM).subs(), subs + 1);
        assertEq(rsc.estimatedBurnPerHour(), rsc.FEED_GAS_PER_HOUR());
    }

    function test_feedToggleIsOwnerOnly() public {
        _configureAave();
        vm.startPrank(makeAddr("stranger"));
        vm.expectRevert("only owner");
        rsc.disableFeed();
        vm.expectRevert("only owner");
        rsc.enableFeed();
        vm.stopPrank();
    }

    function test_feedDisabledIgnoresAaveEvents() public {
        (address aavePool, address reserve, address adapter) = _configureAave();
        rsc.disableFeed();
        _aave(aavePool, reserve, 5e25, 7e25);
        (uint256 rate,,,,,,,) = rsc.pool(BASE, adapter);
        assertEq(rate, 0);
        rsc.enableFeed();
        _aave(aavePool, reserve, 5e25, 7e25);
        (rate,,,,,,,) = rsc.pool(BASE, adapter);
        assertEq(rate, 500);
    }

    // ───────────── confidence pre-check ─────────────

    event VerdictBelowThreshold(
        uint256 indexed chainId, uint256 indexed verdictId, uint16 confidenceBps, uint16 minConfidenceBps
    );

    function test_lowConfidenceActIsNotSentToTheVault() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);

        vm.expectEmit(true, true, false, true);
        emit VerdictBelowThreshold(BASE, 1, 6000, 7000);
        _verdictWithConfidence(BASE, regB, 1, poolB, 1, 6000, 1);

        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 0);
    }

    function test_minConfidenceIsOwnerSettable() public {
        rsc.setMinConfidence(9500);
        assertEq(rsc.minConfidenceBps(), 9500);
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);

        _verdictWithConfidence(BASE, regB, 1, poolB, 1, 9000, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 0);

        _verdictWithConfidence(BASE, regB, 2, poolB, 1, 9500, 2);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 1);
    }

    function test_minConfidenceIsOwnerOnly() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert("only owner");
        rsc.setMinConfidence(5000);
    }

    function test_lowConfidencePauseIsStillDelivered() public {
        // The floor only gates ACT: a cautious PAUSE must still reach the vault.
        _verdictWithConfidence(BASE, regB, 1, address(0), 3, 1000, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.pauseByVerdict.selector), 1);
    }

    function test_selfFundsReservesOnCronTick() public {
        vm.deal(address(rsc), 10 ether);
        MockSystem(SYSTEM).setReserves(0.1 ether); // below minReserve (0.5)
        _react(_log(block.chainid, rsc.LEGACY_SYSTEM(), rsc.CRON100_TOPIC(), 0, 0, 1, ""));
        assertEq(MockSystem(SYSTEM).depositedTotal(), 1 ether);
    }

    function test_doesNotSelfFundWhenReservesHealthy() public {
        vm.deal(address(rsc), 10 ether);
        MockSystem(SYSTEM).setReserves(5 ether);
        _react(_log(block.chainid, rsc.LEGACY_SYSTEM(), rsc.CRON100_TOPIC(), 0, 0, 1, ""));
        assertEq(MockSystem(SYSTEM).depositedTotal(), 0);
    }

    function test_rejectsReactFromNonSystem() public {
        uint256 rateTopic = rsc.RATE_TOPIC();
        vm.expectRevert();
        rsc.react(_log(BASE, poolA, rateTopic, uint256(uint160(poolA)), 0, 2, abi.encode(uint256(1), uint256(1))));
    }

    // ───────────── standing orders + ack/retry ─────────────

    event ActionRetried(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint8 attempt, uint256 originTx);
    event ActionStuck(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint256 originTx);

    function _tick() internal {
        _react(_log(block.chainid, rsc.LEGACY_SYSTEM(), rsc.CRON100_TOPIC(), 0, 0, 1, ""));
    }

    function _planCreated(
        uint256 chainId,
        address vault,
        uint256 id,
        address payee,
        uint32 period,
        uint64 nextDue,
        uint16 remaining,
        uint8 mode
    ) internal {
        IReactive.LogRecord memory l = _log(
            chainId,
            vault,
            rsc.PLAN_CREATED_TOPIC(),
            id,
            uint256(uint160(payee)),
            4,
            abi.encode(uint128(10e6), period, nextDue, remaining, mode)
        );
        l.topic3 = uint256(uint160(payee));
        _react(l);
    }

    function _planExecuted(uint256 chainId, address vault, uint256 id, uint64 nextDue, uint16 remaining) internal {
        _react(
            _log(
                chainId,
                vault,
                rsc.PLAN_EXECUTED_TOPIC(),
                id,
                uint256(uint160(makeAddr("payee"))),
                3,
                abi.encode(uint256(10e6), uint256(10e6), uint256(0), nextDue, remaining)
            )
        );
    }

    function _planSkipped(uint256 chainId, address vault, uint256 id) internal {
        _react(_log(chainId, vault, rsc.PLAN_SKIPPED_TOPIC(), id, 0, 2, abi.encode("no yield yet")));
    }

    function _countLogs(Vm.Log[] memory logs, bytes32 topic0) internal pure returns (uint256 n) {
        for (uint256 i = 0; i < logs.length; i++) if (logs[i].topics[0] == topic0) n++;
    }

    function test_planTopicHashesMatchVaultEvents() public view {
        assertEq(rsc.PLAN_CREATED_TOPIC(), uint256(keccak256("PlanCreated(uint256,address,address,uint128,uint32,uint64,uint16,uint8)")));
        assertEq(rsc.PLAN_EXECUTED_TOPIC(), uint256(keccak256("PlanExecuted(uint256,address,uint256,uint256,uint256,uint64,uint16)")));
        assertEq(rsc.PLAN_SKIPPED_TOPIC(), uint256(keccak256("PlanSkipped(uint256,string)")));
        assertEq(rsc.PLAN_CANCELLED_TOPIC(), uint256(keccak256("PlanCancelled(uint256)")));
        assertEq(rsc.PLAN_EXPIRED_TOPIC(), uint256(keccak256("PlanExpired(uint256)")));
        assertEq(rsc.REBALANCE_SKIPPED_TOPIC(), uint256(keccak256("RebalanceSkipped(uint256,uint256,uint256)")));
    }

    function test_planCreatedIsStored() public {
        uint64 due = uint64(block.timestamp + 120);
        _planCreated(BASE, vaultB, 7, makeAddr("payee"), 120, due, 3, 0);
        assertEq(rsc.planCount(), 1);
        (uint256 chainId, uint256 planId, uint64 nextDue, uint16 remaining, bool active, uint8 attempts) = rsc.planAt(0);
        assertEq(chainId, BASE);
        assertEq(planId, 7);
        assertEq(nextDue, due);
        assertEq(remaining, 3);
        assertTrue(active);
        assertEq(attempts, 0);
    }

    function test_cronFiresDuePlanOnly() public {
        uint64 due = uint64(block.timestamp + 120);
        _planCreated(BASE, vaultB, 1, makeAddr("payee"), 120, due, 3, 1);
        _tick();
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 0); // not due yet

        vm.warp(due);
        _tick();
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 1);
        (, , , , , uint8 attempts) = rsc.planAt(0);
        assertEq(attempts, 1);
    }

    function test_planExecutedAckClearsInFlight() public {
        uint64 due = uint64(block.timestamp);
        _planCreated(BASE, vaultB, 1, makeAddr("payee"), 120, due, 3, 1);
        _tick();
        assertGt(rsc.planInfo(BASE, 1).inFlightSince, 0);

        _planExecuted(BASE, vaultB, 1, due + 120, 2);
        (uint256 chainId, uint256 planId, uint64 nextDue, uint16 remaining, bool active, uint8 attempts) = rsc.planAt(0);
        assertEq(chainId, BASE);
        assertEq(planId, 1);
        assertEq(nextDue, due + 120);
        assertEq(remaining, 2);
        assertTrue(active);
        assertEq(attempts, 0);
        assertEq(rsc.planInfo(BASE, 1).inFlightSince, 0);
    }

    function test_planSkippedAckAdvancesAndClearsInFlight() public {
        uint64 due = uint64(block.timestamp);
        _planCreated(BASE, vaultB, 1, makeAddr("payee"), 120, due, 3, 1); // YIELD_THEN_PRINCIPAL
        _tick();
        _planSkipped(BASE, vaultB, 1);
        (, , uint64 nextDue, uint16 remaining, , uint8 attempts) = rsc.planAt(0);
        assertEq(nextDue, due + 120);
        assertEq(remaining, 2); // a skip consumes a payment in this mode
        assertEq(attempts, 0);
        assertEq(rsc.planInfo(BASE, 1).inFlightSince, 0);
    }

    function test_missingAckRetriesThenStuck() public {
        uint256 t0 = block.timestamp;
        _planCreated(BASE, vaultB, 1, makeAddr("payee"), 120, uint64(t0), 3, 1);

        _tick(); // attempt 1
        vm.warp(t0 + 360);
        vm.recordLogs();
        _tick(); // retry 2
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_countLogs(logs, keccak256("ActionRetried(uint256,uint8,uint256,uint8,uint256)")), 1);

        vm.warp(t0 + 720);
        _tick(); // retry 3
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 3);

        vm.warp(t0 + 1080);
        vm.recordLogs();
        _tick(); // stuck
        logs = vm.getRecordedLogs();
        assertEq(_countLogs(logs, keccak256("ActionStuck(uint256,uint8,uint256,uint256)")), 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 3);
        assertEq(rsc.planInfo(BASE, 1).inFlightSince, 0);
        assertTrue(rsc.planInfo(BASE, 1).stuck);
    }

    function test_staleVerdictIsNotRetried() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);
        _verdict(BASE, regB, 1, poolB, 1, 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 1);

        uint256 t0 = block.timestamp;
        vm.warp(t0 + 1000); // > retryAfter (360) and > maxVerdictAge (900)
        vm.recordLogs();
        _tick();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_countLogs(logs, keccak256("ActionStuck(uint256,uint8,uint256,uint256)")), 1);
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 1); // no re-send
    }

    function test_rebalanceSkippedAckClearsAction() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);
        _verdict(BASE, regB, 1, poolB, 1, 1);
        _react(_log(BASE, vaultB, rsc.REBALANCE_SKIPPED_TOPIC(), 1, 0, 2, abi.encode(uint256(0), uint256(0))));

        uint256 t0 = block.timestamp;
        vm.warp(t0 + 400);
        _tick();
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 1); // cleared, no retry
    }

    function test_boundedPlanLoopRespectsPerTickCap() public {
        for (uint256 i = 1; i <= 10; i++) {
            _planCreated(BASE, vaultB, i, makeAddr("payee"), 120, uint64(block.timestamp), 3, 1);
        }
        _tick();
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 3);

        _tick(); // the in-flight 3 are waiting; the cursor reaches plans 4..6
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 6);
        _tick();
        _tick();
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 10);
    }

    function test_gasCronTickWithMaxPlans() public {
        for (uint256 i = 1; i <= 3; i++) {
            _planCreated(BASE, vaultB, i, makeAddr("payee"), 120, uint64(block.timestamp), 3, 1);
        }
        uint256 g = gasleft();
        _tick();
        uint256 used = g - gasleft();
        emit log_named_uint("cron tick gas with 3 due plans", used);
        assertLt(used, 600_000);
        assertEq(_countSel(vaultB, IVaultCallbacks.executePlan.selector), 3);
    }

    function test_gasCronTickIdleIsCheap() public {
        uint256 g = gasleft();
        _tick();
        uint256 used = g - gasleft();
        emit log_named_uint("idle cron tick gas", used);
        // Second tick: the slot/log overhead is the same, the account accesses are warm.
        uint256 g2 = gasleft();
        _tick();
        emit log_named_uint("idle cron tick gas (2nd)", g2 - gasleft());
        assertLt(used, 90_000); // 747,051 with 5 due plans before; ~11% of that when idle
    }

    // ───────────── dynamic cron ─────────────

    event CronEnabled(uint256 activePlans, uint256 pendingActions, bool watchdog, uint256 rescoreEveryTicks);
    event CronDisabled(uint256 activePlans, uint256 pendingActions, bool watchdog, uint256 rescoreEveryTicks);
    event FeedEnabled(uint256 feeds);
    event FeedDisabled(uint256 feeds);

    function test_cronFollowsPlansInAndOut() public {
        // Turn the deploy-time rescore off: with it on, cron is legitimately always needed.
        rsc.setParams(50, 9500, 150, 900, 0, 0);
        _tick(); // re-syncs: nothing pending any more
        assertFalse(rsc.cronOn());
        uint256 unsubs = MockSystem(SYSTEM).unsubs();

        vm.expectEmit(true, true, true, true);
        emit CronEnabled(1, 0, false, 0);
        _planCreated(BASE, vaultB, 1, makeAddr("payee"), 120, uint64(block.timestamp), 1, 1);
        assertTrue(rsc.cronOn());
        assertEq(rsc.activePlans(), 1);
        assertEq(MockSystem(SYSTEM).subs(), 15); // configured 14 + cron

        vm.expectEmit(true, true, true, true);
        emit CronDisabled(0, 0, false, 0);
        _planExecuted(BASE, vaultB, 1, uint64(block.timestamp + 120), 0); // last payment acked
        assertFalse(rsc.cronOn());
        assertEq(MockSystem(SYSTEM).unsubs(), unsubs + 1);
    }

    function test_cronStaysOnWhileAnActionAwaitsAck() public {
        rsc.setParams(50, 9500, 150, 900, 0, 0);
        _tick();
        assertFalse(rsc.cronOn());

        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);
        _verdict(BASE, regB, 1, poolB, 1, 1); // -> RebalanceRequested, now unacked
        assertEq(rsc.pendingActions(), 1);
        assertTrue(rsc.cronOn());

        _react(_log(BASE, vaultB, rsc.REBALANCED_TOPIC(), 1, uint256(uint160(poolB)), 3, abi.encode(uint256(1), uint256(2))));
        assertEq(rsc.pendingActions(), 0);
        assertFalse(rsc.cronOn());
    }

    function test_watchdogIsOptInAndKeepsCronOn() public {
        rsc.setParams(50, 9500, 150, 900, 0, 0);
        _tick();
        assertFalse(rsc.cronOn());

        rsc.setWatchdog(true);
        assertTrue(rsc.cronOn());
        assertEq(rsc.estimatedBurnPerHour(), 30 * (79_000 + 5 * 137_000));

        rsc.setWatchdog(false);
        assertFalse(rsc.cronOn());
        assertEq(rsc.estimatedBurnPerHour(), 0);
    }

    function test_estimatedBurnPerHourIdleIsZero() public {
        // Nothing pending and no watchdog/rescore: the RSC costs nothing per hour.
        rsc.setParams(50, 9500, 150, 900, 0, 0);
        assertEq(rsc.estimatedBurnPerHourWei(1 gwei), 0);
    }

    function test_unknownPlanEventDoesNotRevert() public {
        _planExecuted(BASE, vaultB, 99, 1234, 2);
        assertEq(rsc.planCount(), 1);
        _planSkipped(BASE, vaultB, 12345); // never seen: ignored, no revert
        assertEq(rsc.planCount(), 1);
    }

    function test_unknownChainLogsIgnored() public {
        _rate(777, poolA, 500, 4000);
        assertEq(_cbCount(), 0);
    }

    // ───────────── request backoff + hourly cap ─────────────

    event RequestSuppressed(uint256 indexed chainId, address indexed pool, string reason);

    function _requestCount() internal view returns (uint256) {
        return _countSel(reqB, IRequesterCallbacks.requestDecision.selector);
    }

    function _countSuppressed(Vm.Log[] memory logs, string memory reason) internal pure returns (uint256 n) {
        bytes32 topic0 = keccak256("RequestSuppressed(uint256,address,string)");
        bytes32 want = keccak256(bytes(reason));
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] != topic0) continue;
            if (keccak256(bytes(abi.decode(logs[i].data, (string)))) == want) n++;
        }
    }

    function test_repeatedIdenticalEventsProduceOneRequest() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 450, 3500); // gap 50 -> request #1
        assertEq(_requestCount(), 1);

        vm.recordLogs();
        _rate(BASE, poolB, 450, 3500); // identical again
        _rate(BASE, poolB, 450, 3500); // and again
        _rate(BASE, poolA, 500, 4000);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(_requestCount(), 1); // still one
        assertEq(_countSuppressed(logs, "backoff"), 3);
    }

    function test_changedRateProducesANewRequest() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 450, 3500); // request #1
        assertEq(_requestCount(), 1);

        _rate(BASE, poolB, 300, 3500); // the base rate moved by 150 >= spikeBps
        assertEq(_requestCount(), 2);
    }

    function test_backoffExpiryProducesANewRequest() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 450, 3500); // request #1
        vm.warp(block.timestamp + rsc.requestBackoff() - 1);
        _rate(BASE, poolB, 450, 3500);
        assertEq(_requestCount(), 1); // still inside the backoff

        vm.warp(block.timestamp + 1);
        _rate(BASE, poolB, 450, 3500);
        assertEq(_requestCount(), 2); // backoff over, same rates -> ask again
    }

    function test_ignoreVerdictRestartsTheBackoff() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 450, 3500); // request #1

        vm.warp(block.timestamp + 200);
        _verdict(BASE, regB, 1, poolA, 2, 1); // IGNORE -> gate re-armed now

        // 500s after the IGNORE (700s after the request): still inside the restarted backoff
        vm.warp(block.timestamp + 500);
        _rate(BASE, poolB, 450, 3500);
        assertEq(_requestCount(), 1);

        vm.warp(block.timestamp + 100); // exactly the backoff after the IGNORE
        _rate(BASE, poolB, 450, 3500);
        assertEq(_requestCount(), 2);
    }

    function test_vaultSkipRestartsTheBackoff() public {
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 900, 3500);
        _verdict(BASE, regB, 1, poolB, 1, 1); // ACT -> rebalance callback
        assertEq(_countSel(vaultB, IVaultCallbacks.rebalance.selector), 1);

        vm.warp(block.timestamp + 200);
        // vault skipped it: no funds to move
        _react(_log(BASE, vaultB, rsc.REBALANCE_SKIPPED_TOPIC(), 1, 0, 2, abi.encode(uint256(0), uint256(0))));

        vm.warp(block.timestamp + 500); // inside the backoff restarted by the skip
        vm.recordLogs();
        _rate(BASE, poolB, 900, 3500);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_requestCount(), 1);
        assertEq(_countSuppressed(logs, "backoff"), 1);
    }

    function test_hourlyCapStopsRequestsPerChain() public {
        rsc.setBackoff(600, 2);
        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 450, 3500); // request #1
        _rate(BASE, poolB, 300, 3500); // base moved 150 -> request #2
        assertEq(_requestCount(), 2);
        assertEq(rsc.requestsThisHour(BASE), 2);

        vm.expectEmit(true, true, false, true);
        emit RequestSuppressed(BASE, poolA, "hourly cap");
        _rate(BASE, poolB, 150, 3500); // would be a new request, but the hour is spent

        assertEq(_requestCount(), 2);
        assertEq(rsc.requestsThisHour(BASE), 2);

        // a new hour resets the budget
        vm.warp(block.timestamp + 1 hours);
        _rate(BASE, poolB, 150, 3500);
        assertEq(_requestCount(), 3);
        assertEq(rsc.requestsThisHour(BASE), 1);
    }

    function test_capIsPerChain() public {
        _configure(UNI, vaultU, reqU, regU, poolC, poolD);
        rsc.setBackoff(600, 1);

        _rate(BASE, poolA, 500, 4000);
        _rate(BASE, poolB, 450, 3500); // Base request #1 (Base budget now spent)
        _rate(BASE, poolB, 300, 3500); // Base: suppressed by the cap
        assertEq(_requestCount(), 1);

        _rate(UNI, poolC, 700, 4000);
        _rate(UNI, poolD, 600, 3500); // Unichain has its own budget
        assertEq(_countSel(reqU, IRequesterCallbacks.requestDecision.selector), 1);
    }

    function test_setBackoffRejectsBadParams() public {
        vm.expectRevert("backoff too short");
        rsc.setBackoff(1, 10);
        vm.expectRevert("bad hourly cap");
        rsc.setBackoff(600, 0);
    }

    function test_setBackoffIsOwnerOnly() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert("only owner");
        rsc.setBackoff(600, 10);
    }
}
