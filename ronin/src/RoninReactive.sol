// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ISystemContract} from "@reactive/src/interfaces/ISystemContract.sol";
import {IReactive} from "@reactive/src/interfaces/IReactive.sol";
import {AbstractReactive} from "@reactive/src/base/AbstractReactive.sol";
import {IVaultCallbacks, IRequesterCallbacks} from "./interfaces/IRoninCallbacks.sol";

/// @dev Economy hooks on the system contract (documented at dev.reactive.network/system-contract).
interface ISystemFunding {
    function reserves(address account) external view returns (uint256);
    function depositTo(address account) external payable;
}

/// @title RoninReactive (deployed once, on Reactive Lasna)
/// @notice The brain. One contract orchestrates every chain. It:
///   1. COMPUTES on-chain: per-pool EMA of the rate, deviation, spike and a 0..10000 risk score.
///   2. WAKES THE AI (hop 1): on a spike / yield gap / scheduled tick it calls DecisionRequester on the
///      origin chain; that emits DecisionRequested, which the off-chain AI answers.
///   3. ACTS ON THE ANSWER (hop 2): it consumes VerdictPosted and calls the vault (rebalance / pause).
///   4. PROTECTS OMNICHAIN: a pool breaker or EmergencyExit on ANY chain pauses the vaults on ALL others;
///      pauses heal themselves once the trigger clears.
///   5. WATCHES ITSELF via CRON: if a chain's rate feed goes quiet, it pauses that vault, and unpauses on resume.
///   6. WATCHES THE VAULTS: Rebalanced / EmergencyExit / PoolAdded feedback; PoolAdded creates new
///      subscriptions at runtime. It also measures the request -> rebalance loop time on-chain.
///   7. STEERS: pushes an omnichain best-yield signal to every vault (a UI can route new deposits).
contract RoninReactive is AbstractReactive {
    // ───── event topics we subscribe to ─────
    uint256 public constant RATE_TOPIC = uint256(keccak256("RateUpdated(address,uint256,uint256)"));
    uint256 public constant VERDICT_TOPIC =
        uint256(keccak256("VerdictPosted(uint256,address,uint8,uint16,bytes32,uint256)"));
    uint256 public constant REQUEST_TOPIC =
        uint256(keccak256("DecisionRequested(uint256,address,uint256,uint256,uint256,uint256,uint256,uint8)"));
    uint256 public constant REBALANCED_TOPIC = uint256(keccak256("Rebalanced(uint256,address,uint256,uint256)"));
    uint256 public constant EXIT_TOPIC = uint256(keccak256("EmergencyExit(address,uint256)"));
    uint256 public constant POOL_ADDED_TOPIC = uint256(keccak256("PoolAdded(address)"));
    // Standing-order events. The PlanCreated signature includes the payout mode (enum = uint8).
    uint256 public constant PLAN_CREATED_TOPIC =
        uint256(keccak256("PlanCreated(uint256,address,address,uint128,uint32,uint64,uint16,uint8)"));
    uint256 public constant PLAN_EXECUTED_TOPIC =
        uint256(keccak256("PlanExecuted(uint256,address,uint256,uint256,uint256,uint64,uint16)"));
    uint256 public constant PLAN_SKIPPED_TOPIC = uint256(keccak256("PlanSkipped(uint256,string)"));
    uint256 public constant PLAN_CANCELLED_TOPIC = uint256(keccak256("PlanCancelled(uint256)"));
    uint256 public constant PLAN_EXPIRED_TOPIC = uint256(keccak256("PlanExpired(uint256)"));
    uint256 public constant REBALANCE_SKIPPED_TOPIC =
        uint256(keccak256("RebalanceSkipped(uint256,uint256,uint256)"));
    // Aave V3 Pool event (topic0 should equal 0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a;
    // a unit test asserts it).
    uint256 public constant AAVE_RESERVE_TOPIC =
        uint256(keccak256("ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)"));
    uint256 internal constant RAY_TO_BPS = 1e23;

    // CRON (docs): the legacy system contract emits Cron100 roughly every 100 blocks (~2 minutes).
    address public constant LEGACY_SYSTEM = 0x0000000000000000000000000000000000fffFfF;
    uint256 public constant CRON100_TOPIC = 0xb49937fb8970e19fd46d48f7e3fb00d659deac0347f79cd7cb542f0fc1503c70;

    bytes32 public constant STALE_REASON = keccak256("STALE_DATA");
    bytes32 public constant OMNI_REASON = keccak256("OMNI_BREAKER");
    uint64 public constant CALLBACK_GAS_LIMIT = 1_000_000;

    struct Chain {
        address vault;
        address requester;
        address registry;
        bool exists;
        bool stalePaused;
        bool omniPaused;
        uint256 lastRateAt;
        uint256 lastRequestAt;
        uint256 lastRebalanceAt;
        uint256 rebalances;
        uint256 sentLocal; // last omni signal values sent (throttling)
        uint256 sentGlobal;
        uint256 sentBestChain;
    }

    /// @notice Mirror of a vault plan, kept entirely from events (the RSC never reads origin state).
    struct PlanState {
        uint256 originTx; // PlanCreated's tx, copied into retry/stuck events
        uint64 nextDue;
        uint32 period;
        uint16 remaining;
        uint8 mode; // 0 = YIELD_ONLY, 1 = YIELD_THEN_PRINCIPAL
        uint8 attempts;
        bool active;
        bool known;
        bool stuck;
        uint64 inFlightSince;
    }

    /// @notice A rebalance callback waiting for its Rebalanced / RebalanceSkipped ack.
    struct RebalanceAction {
        uint256 id;
        address target;
        uint64 verdictAt;
        uint64 lastSentAt;
        uint8 attempts;
        uint256 originTx;
        bool pending;
    }

    struct PlanRef {
        uint256 chainId;
        uint256 planId;
    }

    struct PoolState {
        uint256 rateBps;
        uint256 emaBps; // exponential moving average, alpha = 1/8
        uint256 devEmaBps; // EMA of |rate - ema|, a volatility proxy
        uint256 lastSpikeBps; // |rate - previous ema| at the last update
        uint256 utilBps;
        uint256 updatedAt;
        bool seen;
        bool tripped; // breaker tripped / pool exited
    }

    address public immutable owner;

    // tunables
    uint256 public minGapBps; // yield differential worth acting on
    uint256 public breakerUtilBps; // utilisation that trips the circuit breaker
    uint256 public spikeBps; // |rate - ema| that wakes the AI
    uint256 public staleAfter; // seconds of silence before a chain is considered stale
    uint256 public requestCooldown; // min seconds between AI requests per chain
    uint256 public rescoreEveryTicks; // every N Cron100 ticks, ask the AI for a scheduled re-score (0 = off)
    bool public cronOn = true;
    uint256 public ticks;
    // Self-funding: reserves are consumed first, and execution STOPS while debt > 0, so on every CRON tick
    // the contract tops its own reserves up from its balance before they run dry.
    uint256 public minReserve = 0.5 ether;
    uint256 public topUp = 1 ether;

    mapping(uint256 => Chain) public chains;
    uint256[] public chainIds;
    mapping(uint256 => mapping(address => PoolState)) public pool;
    mapping(uint256 => address[]) internal poolList;
    mapping(uint256 => mapping(address => bool)) public isWatched;
    mapping(bytes32 => uint256) public requestTs; // (chain, requestId) => Reactive-side timestamp
    mapping(bytes32 => uint256) public verdictReqTs; // (chain, verdictId) => timestamp of the originating request
    mapping(bytes32 => address) public aaveAdapter; // (chain, aavePool, reserve) => vault adapter fed by that reserve

    // Standing orders: plans are processed round-robin, at most MAX_PLANS_PER_TICK per cron tick.
    // 5 keeps a worst-case tick under the 900k react() cap even when every plan needs a callback
    // (measured in test_gasCronTickWithMaxPlans; 8 plans was ~1.13M in the local harness).
    uint256 public constant MAX_PLANS_PER_TICK = 5;
    uint256 public constant MAX_ATTEMPTS = 3;
    PlanRef[] internal planRefs;
    mapping(bytes32 => PlanState) internal planState;
    mapping(bytes32 => bool) internal planSeen;
    mapping(bytes32 => RebalanceAction) internal rebalanceAction;
    mapping(uint256 => bytes32[]) internal pendingRebalances; // chainId => action keys
    uint256 public planCursor;
    /// @notice Seconds without an ack before a callback is re-sent (default ~3 CRON ticks).
    uint256 public retryAfter = 360;
    /// @notice Rebalances are never retried after the verdict is this old (matches the vault default).
    uint256 public maxVerdictAge = 15 minutes;

    // ───── events (these are the audit trail / demo evidence on Lasna) ─────
    event ChainConfigured(uint256 indexed chainId, address vault, address requester, address registry);
    event AaveFeedConfigured(uint256 indexed chainId, address indexed aavePool, address indexed reserve, address adapter);
    event PoolWatched(uint256 indexed chainId, address indexed pool);
    // `originTx` is LogRecord.txHash: the origin-chain transaction that caused this reaction. Together with the
    // Reactive tx hash of the event itself and getCallbacks(reactiveTx) (destination tx), it makes every
    // origin -> Reactive -> destination trace machine-readable (see ai-service/proof.js).
    event RateObserved(
        uint256 indexed chainId, address indexed pool, uint256 rateBps, uint256 emaBps, uint256 utilBps, uint256 originTx
    );
    event DecisionRequestSent(uint256 indexed chainId, address indexed pool, uint256 gapBps, uint256 riskScore, uint8 trigger);
    event RequestObserved(uint256 indexed chainId, uint256 indexed requestId, uint256 originTx);
    event VerdictSeen(
        uint256 indexed chainId, uint256 indexed verdictId, uint8 action, uint256 secsSinceRequest, uint256 originTx
    );
    event RebalanceRequested(uint256 indexed chainId, uint256 indexed verdictId, address indexed toPool, uint256 gapBps);
    event PauseRequested(uint256 indexed chainId, uint256 indexed verdictId);
    event VerdictSkipped(uint256 indexed chainId, uint256 indexed verdictId, string reason);
    event LoopClosed(
        uint256 indexed chainId, uint256 indexed verdictId, uint256 requestToRebalanceSecs, uint256 originTx
    );
    event BreakerTripped(uint256 indexed chainId, address indexed pool, uint256 utilBps);
    event BreakerCleared(uint256 indexed chainId, address indexed pool);
    event ExitObserved(uint256 indexed chainId, address indexed pool, uint256 withdrawn, uint256 originTx);
    event SelfFunded(uint256 reservesBefore, uint256 amount);
    event OmniPause(uint256 indexed pausedChainId, uint256 indexed sourceChainId);
    event OmniHeal(uint256 indexed chainId);
    event StaleDetected(uint256 indexed chainId, uint256 silentForSecs);
    event StaleHealed(uint256 indexed chainId);
    event OmniSignalSent(uint256 indexed chainId, uint256 localBestBps, uint256 globalBestBps, uint256 globalBestChainId);
    event Tick(uint256 indexed n);
    event ActionRetried(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint8 attempt, uint256 originTx);
    event ActionStuck(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint256 originTx);
    event PlanScheduled(uint256 indexed chainId, uint256 indexed planId, uint64 nextDue, uint16 remaining);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(
        uint256 minGapBps_,
        uint256 breakerUtilBps_,
        uint256 spikeBps_,
        uint256 staleAfter_,
        uint256 requestCooldown_,
        uint256 rescoreEveryTicks_
    ) payable {
        owner = msg.sender;
        minGapBps = minGapBps_;
        breakerUtilBps = breakerUtilBps_;
        spikeBps = spikeBps_;
        staleAfter = staleAfter_;
        requestCooldown = requestCooldown_;
        rescoreEveryTicks = rescoreEveryTicks_;
        _subscribeCron();
    }

    // ───────────────────────── Owner wiring ─────────────────────────

    /// @notice Register an origin/destination chain and subscribe to everything on it. Call once per chain
    ///         after the chain's contracts are deployed (they need this contract's address first).
    function configureChain(
        uint256 chainId,
        address vault,
        address requester,
        address registry,
        address[] calldata pools_
    ) external onlyOwner {
        require(!chains[chainId].exists, "configured");
        require(vault != address(0), "vault required");
        Chain storage c = chains[chainId];
        c.vault = vault;
        c.requester = requester;
        c.registry = registry;
        c.exists = true;
        chainIds.push(chainId);

        _sub(chainId, vault, REBALANCED_TOPIC);
        _sub(chainId, vault, REBALANCE_SKIPPED_TOPIC);
        _sub(chainId, vault, EXIT_TOPIC);
        _sub(chainId, vault, POOL_ADDED_TOPIC);
        _sub(chainId, vault, PLAN_CREATED_TOPIC);
        _sub(chainId, vault, PLAN_EXECUTED_TOPIC);
        _sub(chainId, vault, PLAN_SKIPPED_TOPIC);
        _sub(chainId, vault, PLAN_CANCELLED_TOPIC);
        _sub(chainId, vault, PLAN_EXPIRED_TOPIC);
        if (registry != address(0)) _sub(chainId, registry, VERDICT_TOPIC);
        if (requester != address(0)) _sub(chainId, requester, REQUEST_TOPIC);
        for (uint256 i = 0; i < pools_.length; i++) {
            _watchPool(chainId, pools_[i]);
        }
        emit ChainConfigured(chainId, vault, requester, registry);
    }

    /// @notice Feed a vault adapter from a REAL Aave V3 reserve. Subscribes to the Aave Pool's ReserveDataUpdated,
    ///         filtered on topic1 = reserve, so only that asset's updates wake this contract.
    function configureAave(uint256 chainId, address aavePool, address reserve, address adapter) external onlyOwner {
        require(chains[chainId].exists, "unknown chain");
        require(aavePool != address(0) && reserve != address(0) && adapter != address(0), "zero address");
        aaveAdapter[_aaveKey(chainId, aavePool, reserve)] = adapter;
        if (!isWatched[chainId][adapter]) {
            isWatched[chainId][adapter] = true;
            poolList[chainId].push(adapter); // tracked for ranking; its rates come from Aave, not from RateUpdated
        }
        SYSTEM.subscribe(chainId, aavePool, AAVE_RESERVE_TOPIC, uint256(uint160(reserve)), REACTIVE_IGNORE, REACTIVE_IGNORE);
        emit AaveFeedConfigured(chainId, aavePool, reserve, adapter);
    }

    function _aaveKey(uint256 chainId, address aavePool, address reserve) private pure returns (bytes32) {
        return keccak256(abi.encode(chainId, aavePool, reserve));
    }

    function watchPool(uint256 chainId, address p) external onlyOwner {
        require(chains[chainId].exists, "unknown chain");
        _watchPool(chainId, p);
    }

    function setParams(
        uint256 minGapBps_,
        uint256 breakerUtilBps_,
        uint256 spikeBps_,
        uint256 staleAfter_,
        uint256 requestCooldown_,
        uint256 rescoreEveryTicks_
    ) external onlyOwner {
        minGapBps = minGapBps_;
        breakerUtilBps = breakerUtilBps_;
        spikeBps = spikeBps_;
        staleAfter = staleAfter_;
        requestCooldown = requestCooldown_;
        rescoreEveryTicks = rescoreEveryTicks_;
    }

    /// @notice CRON subscriptions bill on every tick. Switch off to save lREACT when not demoing.
    function setCron(bool on) external onlyOwner {
        if (on == cronOn) return;
        cronOn = on;
        if (on) _subscribeCron();
        else
            SYSTEM.unsubscribe(
                block.chainid, LEGACY_SYSTEM, CRON100_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
    }

    function coverDebt() external {
        _coverDebt();
    }

    // ───────────────────────── Reactive entry point ─────────────────────────

    /// @inheritdoc IReactive
    function react(LogRecord memory log_) external onlySystem {
        if (log_.topic0 == CRON100_TOPIC && log_.contractAddress == LEGACY_SYSTEM) {
            _onCron();
            return;
        }

        uint256 chainId = log_.chainId;
        Chain storage c = chains[chainId];
        if (!c.exists) return;
        address src = log_.contractAddress;

        if (log_.topic0 == RATE_TOPIC && log_.opCode == 2 && isWatched[chainId][src]) {
            _onRate(chainId, address(uint160(log_.topic1)), log_);
        } else if (log_.topic0 == VERDICT_TOPIC && log_.opCode == 3 && src == c.registry) {
            _onVerdict(chainId, log_);
        } else if (log_.topic0 == REQUEST_TOPIC && log_.opCode == 3 && src == c.requester) {
            requestTs[_key(chainId, log_.topic1)] = block.timestamp;
            emit RequestObserved(chainId, log_.topic1, log_.txHash);
        } else if (log_.topic0 == REBALANCED_TOPIC && log_.opCode == 3 && src == c.vault) {
            _onRebalanced(chainId, log_);
        } else if (log_.topic0 == REBALANCE_SKIPPED_TOPIC && log_.opCode == 2 && src == c.vault) {
            _clearRebalance(chainId, log_.topic1);
        } else if (log_.topic0 == PLAN_CREATED_TOPIC && log_.opCode == 4 && src == c.vault) {
            _onPlanCreated(chainId, log_);
        } else if (log_.topic0 == PLAN_EXECUTED_TOPIC && log_.opCode == 3 && src == c.vault) {
            _onPlanExecuted(chainId, log_);
        } else if (log_.topic0 == PLAN_SKIPPED_TOPIC && log_.opCode == 2 && src == c.vault) {
            _onPlanSkipped(chainId, log_);
        } else if (log_.topic0 == PLAN_CANCELLED_TOPIC && log_.opCode == 2 && src == c.vault) {
            _onPlanClosed(chainId, log_.topic1);
        } else if (log_.topic0 == PLAN_EXPIRED_TOPIC && log_.opCode == 2 && src == c.vault) {
            _onPlanClosed(chainId, log_.topic1);
        } else if (log_.topic0 == EXIT_TOPIC && log_.opCode == 2 && src == c.vault) {
            _onExit(chainId, log_);
        } else if (log_.topic0 == POOL_ADDED_TOPIC && log_.opCode == 2 && src == c.vault) {
            // Dynamic subscription: the vault whitelisted a new pool; start watching it right now.
            _watchPool(chainId, address(uint160(log_.topic1)));
        } else if (log_.topic0 == AAVE_RESERVE_TOPIC && log_.opCode == 2) {
            // Real Aave V3 rate feed: the Aave Pool itself emits ReserveDataUpdated on every supply / borrow /
            // repay / withdraw of the reserve we subscribed to (filtered by topic1 = reserve).
            address adapter = aaveAdapter[_aaveKey(chainId, src, address(uint160(log_.topic1)))];
            if (adapter != address(0)) _onAave(chainId, adapter, log_);
        }
    }

    // ───────────────────────── Handlers ─────────────────────────

    function _onRate(uint256 chainId, address p, LogRecord memory log_) internal {
        (uint256 rate, uint256 util) = abi.decode(log_.data, (uint256, uint256));
        _applyRate(chainId, p, rate, util, log_.txHash);
    }

    /// @dev Aave's event carries rates, not utilisation. liquidityRate = borrowRate * utilisation * (1 - reserveFactor),
    ///      so liquidityRate / variableBorrowRate is a LOWER BOUND on utilisation. It still moves with the real
    ///      utilisation, which is what the risk score and the AI need. The adapter exposes the exact figure on-chain.
    function _onAave(uint256 chainId, address adapter, LogRecord memory log_) internal {
        (uint256 liquidityRate,, uint256 variableBorrowRate,,) =
            abi.decode(log_.data, (uint256, uint256, uint256, uint256, uint256));
        uint256 rate = liquidityRate / RAY_TO_BPS; // ray (1e27 = 100%) -> bps
        uint256 util = variableBorrowRate == 0 ? 0 : (liquidityRate * 10_000) / variableBorrowRate;
        if (util > 10_000) util = 10_000;
        _applyRate(chainId, adapter, rate, util, log_.txHash);
    }

    function _applyRate(uint256 chainId, address p, uint256 rate, uint256 util, uint256 originTx) internal {
        Chain storage c = chains[chainId];
        PoolState storage s = pool[chainId][p];

        // 1. on-chain compute: EMA, deviation EMA, spike
        uint256 spike;
        if (!s.seen) {
            s.emaBps = rate;
            s.seen = true;
        } else {
            uint256 prev = s.emaBps;
            spike = rate > prev ? rate - prev : prev - rate;
            s.devEmaBps = (s.devEmaBps * 7 + spike) / 8;
            s.emaBps = (prev * 7 + rate) / 8;
        }
        s.rateBps = rate;
        s.utilBps = util;
        s.lastSpikeBps = spike;
        s.updatedAt = block.timestamp;
        c.lastRateAt = block.timestamp;
        emit RateObserved(chainId, p, rate, s.emaBps, util, originTx);

        // 2. self-heal a stale pause now that data is flowing again
        if (c.stalePaused) {
            c.stalePaused = false;
            emit StaleHealed(chainId);
            _cb(chainId, c.vault, abi.encodeCall(IVaultCallbacks.unpauseByReactive, (address(0), STALE_REASON)));
        }

        // 3. circuit breaker: no AI, no delay
        if (util >= breakerUtilBps) {
            if (!s.tripped) {
                s.tripped = true;
                emit BreakerTripped(chainId, p, util);
                _cb(chainId, c.vault, abi.encodeCall(IVaultCallbacks.emergencyExit, (address(0), p)));
            }
            return;
        }
        if (s.tripped) {
            s.tripped = false;
            emit BreakerCleared(chainId, p);
            _healOmni();
        }

        // 4. wake the AI on a spike or a worthwhile yield gap
        (address best,, uint256 gap) = _bestAndGap(chainId);
        if (best != address(0) && (spike >= spikeBps || gap >= minGapBps)) {
            _maybeRequest(chainId, best, gap, spike >= spikeBps ? 1 : 2);
        }

        // 5. push the omnichain yield signal
        _updateOmni();
    }

    function _onVerdict(uint256 chainId, LogRecord memory log_) internal {
        Chain storage c = chains[chainId];
        uint256 id = log_.topic1;
        address target = address(uint160(log_.topic2));
        (uint8 action,,, uint256 requestId) = abi.decode(log_.data, (uint8, uint16, bytes32, uint256));

        uint256 reqAt = requestTs[_key(chainId, requestId)];
        verdictReqTs[_key(chainId, id)] = reqAt;
        emit VerdictSeen(chainId, id, action, reqAt == 0 ? 0 : block.timestamp - reqAt, log_.txHash);

        if (action == 3) {
            emit PauseRequested(chainId, id);
            _cb(chainId, c.vault, abi.encodeCall(IVaultCallbacks.pauseByVerdict, (address(0), id)));
            return;
        }
        if (action != 1) return; // IGNORE

        PoolState storage s = pool[chainId][target];
        if (!isWatched[chainId][target] || !s.seen || s.tripped) {
            emit VerdictSkipped(chainId, id, "target not eligible");
            return;
        }
        uint256 gap = _gapOf(chainId, target);
        if (gap < minGapBps) {
            emit VerdictSkipped(chainId, id, "gap below threshold");
            return;
        }
        emit RebalanceRequested(chainId, id, target, gap);
        _startRebalance(chainId, id, target, log_.txHash);
        _cb(chainId, c.vault, abi.encodeCall(IVaultCallbacks.rebalance, (address(0), id, target)));
    }

    function _onRebalanced(uint256 chainId, LogRecord memory log_) internal {
        Chain storage c = chains[chainId];
        uint256 verdictId = log_.topic1;
        c.lastRebalanceAt = block.timestamp;
        c.rebalances++;
        _clearRebalance(chainId, verdictId);
        uint256 start = verdictReqTs[_key(chainId, verdictId)];
        emit LoopClosed(chainId, verdictId, start == 0 ? 0 : block.timestamp - start, log_.txHash);
    }

    // ───────────────────────── Standing orders ─────────────────────────

    function _onPlanCreated(uint256 chainId, LogRecord memory log_) internal {
        uint256 id = log_.topic1;
        (, uint32 period, uint64 nextDue, uint16 remaining, uint8 mode) =
            abi.decode(log_.data, (uint128, uint32, uint64, uint16, uint8));
        PlanState storage ps = _ensurePlan(chainId, id, log_.txHash);
        ps.nextDue = nextDue;
        ps.period = period;
        ps.remaining = remaining;
        ps.mode = mode;
        ps.active = true;
        ps.stuck = false;
        ps.inFlightSince = 0;
        ps.attempts = 0;
        emit PlanScheduled(chainId, id, nextDue, remaining);
    }

    function _onPlanExecuted(uint256 chainId, LogRecord memory log_) internal {
        uint256 id = log_.topic1;
        (,,, uint64 nextDue, uint16 remaining) = abi.decode(log_.data, (uint256, uint256, uint256, uint64, uint16));
        PlanState storage ps = _ensurePlan(chainId, id, 0);
        ps.nextDue = nextDue;
        ps.remaining = remaining;
        ps.active = remaining > 0;
        ps.stuck = false;
        ps.inFlightSince = 0;
        ps.attempts = 0;
    }

    function _onPlanSkipped(uint256 chainId, LogRecord memory log_) internal {
        PlanState storage ps = planState[_planKey(chainId, log_.topic1)];
        if (!ps.known) return; // event for a plan we never saw created: ignore, never revert
        ps.inFlightSince = 0;
        ps.attempts = 0;
        ps.nextDue = uint64(uint256(ps.nextDue) + ps.period);
        // YIELD_THEN_PRINCIPAL consumes a payment when it cannot pay; YIELD_ONLY postpones it.
        if (ps.mode == 1 && ps.remaining > 0) {
            ps.remaining--;
            if (ps.remaining == 0) ps.active = false;
        }
    }

    function _onPlanClosed(uint256 chainId, uint256 id) internal {
        PlanState storage ps = planState[_planKey(chainId, id)];
        if (!ps.known) return;
        ps.active = false;
        ps.inFlightSince = 0;
        ps.attempts = 0;
    }

    function _ensurePlan(uint256 chainId, uint256 id, uint256 originTx) internal returns (PlanState storage ps) {
        ps = planState[_planKey(chainId, id)];
        if (!ps.known) {
            ps.known = true;
            planRefs.push(PlanRef(chainId, id));
        }
        if (originTx != 0) ps.originTx = originTx;
    }

    function _startRebalance(uint256 chainId, uint256 verdictId, address target, uint256 originTx) internal {
        bytes32 key = _key(chainId, verdictId);
        RebalanceAction storage a = rebalanceAction[key];
        if (!a.pending) {
            a.pending = true;
            a.id = verdictId;
            a.target = target;
            a.verdictAt = uint64(block.timestamp);
            a.originTx = originTx;
            a.attempts = 1;
            a.lastSentAt = uint64(block.timestamp);
            pendingRebalances[chainId].push(key);
        }
    }

    function _clearRebalance(uint256 chainId, uint256 verdictId) internal {
        RebalanceAction storage a = rebalanceAction[_key(chainId, verdictId)];
        if (a.pending) a.pending = false;
    }

    function _onExit(uint256 chainId, LogRecord memory log_) internal {
        address p = address(uint160(log_.topic1));
        uint256 withdrawn = abi.decode(log_.data, (uint256));
        pool[chainId][p].tripped = true;
        emit ExitObserved(chainId, p, withdrawn, log_.txHash);

        // Omnichain breaker: a confirmed exit on one chain pauses deposits on every other chain.
        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 id = chainIds[i];
            Chain storage o = chains[id];
            if (id == chainId || o.omniPaused) continue;
            o.omniPaused = true;
            emit OmniPause(id, chainId);
            _cb(id, o.vault, abi.encodeCall(IVaultCallbacks.pauseByReactive, (address(0), OMNI_REASON)));
        }
    }

    /// @dev Best-effort: if the system contract rejects any of this we simply carry on (try/catch).
    ///      A reverting react() would still be billed, so nothing here is allowed to revert.
    function _selfFund() internal {
        if (topUp == 0) return;
        try ISystemFunding(address(SYSTEM)).reserves(address(this)) returns (uint256 r) {
            if (r >= minReserve || address(this).balance < topUp) return;
            try ISystemFunding(address(SYSTEM)).depositTo{value: topUp}(address(this)) {
                emit SelfFunded(r, topUp);
            } catch {}
        } catch {}
    }

    function setFunding(uint256 minReserve_, uint256 topUp_) external onlyOwner {
        minReserve = minReserve_;
        topUp = topUp_;
    }

    function _onCron() internal {
        ticks++;
        emit Tick(ticks);
        _selfFund();
        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 id = chainIds[i];
            Chain storage c = chains[id];

            // staleness watchdog
            if (c.lastRateAt != 0 && !c.stalePaused && block.timestamp > c.lastRateAt + staleAfter) {
                c.stalePaused = true;
                emit StaleDetected(id, block.timestamp - c.lastRateAt);
                _cb(id, c.vault, abi.encodeCall(IVaultCallbacks.pauseByReactive, (address(0), STALE_REASON)));
            }

            // scheduled AI re-score
            if (rescoreEveryTicks != 0 && ticks % rescoreEveryTicks == 0) {
                (address best,, uint256 gap) = _bestAndGap(id);
                if (best != address(0)) _maybeRequest(id, best, gap, 3);
            }
        }

        // Standing orders and retries share the same bounded budget, so one react stays well under 900k gas.
        _processPlans();
        _retryRebalances();
    }

    /// @dev Round-robin over all plans, at most MAX_PLANS_PER_TICK examined per tick. A due plan gets one
    ///      callback; an in-flight one is re-sent after retryAfter, at most MAX_ATTEMPTS times.
    function _processPlans() internal {
        uint256 n = planRefs.length;
        if (n == 0) return;
        uint256 start = planCursor;
        uint256 scanned;
        for (; scanned < n && scanned < MAX_PLANS_PER_TICK; scanned++) {
            PlanRef storage ref = planRefs[(start + scanned) % n];
            PlanState storage ps = planState[_planKey(ref.chainId, ref.planId)];
            if (!ps.active || ps.stuck) continue;
            Chain storage c = chains[ref.chainId];
            if (!c.exists) continue;

            if (ps.inFlightSince != 0) {
                if (block.timestamp < uint256(ps.inFlightSince) + retryAfter) continue;
                if (ps.attempts >= MAX_ATTEMPTS) {
                    ps.stuck = true;
                    ps.inFlightSince = 0;
                    emit ActionStuck(ref.chainId, 1, ref.planId, ps.originTx);
                    continue;
                }
                ps.attempts++;
                ps.inFlightSince = uint64(block.timestamp);
                emit ActionRetried(ref.chainId, 1, ref.planId, ps.attempts, ps.originTx);
                _cb(ref.chainId, c.vault, abi.encodeCall(IVaultCallbacks.executePlan, (address(0), ref.planId)));
                continue;
            }

            if (block.timestamp < ps.nextDue) continue;
            ps.inFlightSince = uint64(block.timestamp);
            ps.attempts = 1;
            _cb(ref.chainId, c.vault, abi.encodeCall(IVaultCallbacks.executePlan, (address(0), ref.planId)));
        }
        planCursor = (start + scanned) % n;
    }

    function _retryRebalances() internal {
        uint256 budget = MAX_PLANS_PER_TICK;
        for (uint256 i = 0; i < chainIds.length && budget > 0; i++) {
            uint256 chainId = chainIds[i];
            Chain storage c = chains[chainId];
            bytes32[] storage keys = pendingRebalances[chainId];
            for (uint256 j = 0; j < keys.length && budget > 0; j++) {
                RebalanceAction storage a = rebalanceAction[keys[j]];
                if (!a.pending) continue;
                if (block.timestamp < uint256(a.lastSentAt) + retryAfter) continue;
                budget--;
                // A verdict the vault would now reject is never worth re-sending.
                if (block.timestamp > uint256(a.verdictAt) + maxVerdictAge || a.attempts >= MAX_ATTEMPTS) {
                    a.pending = false;
                    emit ActionStuck(chainId, 2, a.id, a.originTx);
                    continue;
                }
                a.attempts++;
                a.lastSentAt = uint64(block.timestamp);
                emit ActionRetried(chainId, 2, a.id, a.attempts, a.originTx);
                _cb(chainId, c.vault, abi.encodeCall(IVaultCallbacks.rebalance, (address(0), a.id, a.target)));
            }
        }
    }

    // ───────────────────────── Internals ─────────────────────────

    function _maybeRequest(uint256 chainId, address best, uint256 gap, uint8 trigger) internal {
        Chain storage c = chains[chainId];
        if (c.requester == address(0)) return;
        if (block.timestamp < c.lastRequestAt + requestCooldown) return;
        c.lastRequestAt = block.timestamp;

        PoolState storage s = pool[chainId][best];
        uint256 risk = _risk(s);
        emit DecisionRequestSent(chainId, best, gap, risk, trigger);
        _cb(
            chainId,
            c.requester,
            abi.encodeCall(
                IRequesterCallbacks.requestDecision,
                (address(0), best, s.rateBps, s.emaBps, s.utilBps, gap, risk, trigger)
            )
        );
    }

    /// @dev Heuristic 0..10000. Recent rate spike and volatility dominate; high utilisation adds to it.
    function _risk(PoolState storage s) internal view returns (uint256 r) {
        r = s.lastSpikeBps * 8 + s.devEmaBps * 4;
        if (s.utilBps > 5000) r += (s.utilBps - 5000) / 2;
        if (r > 10_000) r = 10_000;
    }

    function _bestAndGap(uint256 chainId) internal view returns (address best, uint256 bestRate, uint256 gap) {
        address[] storage list = poolList[chainId];
        uint256 worst = type(uint256).max;
        uint256 seenCount;
        for (uint256 i = 0; i < list.length; i++) {
            PoolState storage s = pool[chainId][list[i]];
            if (!s.seen) continue;
            seenCount++;
            if (s.rateBps < worst) worst = s.rateBps;
            if (!s.tripped && (best == address(0) || s.rateBps > bestRate)) {
                best = list[i];
                bestRate = s.rateBps;
            }
        }
        if (best != address(0) && seenCount > 1 && bestRate > worst) gap = bestRate - worst;
    }

    /// @dev Rate of `target` minus the lowest other observed rate on the chain (0 if not higher).
    function _gapOf(uint256 chainId, address target) internal view returns (uint256) {
        address[] storage list = poolList[chainId];
        uint256 targetRate = pool[chainId][target].rateBps;
        uint256 worst = type(uint256).max;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == target) continue;
            PoolState storage s = pool[chainId][list[i]];
            if (!s.seen) continue;
            if (s.rateBps < worst) worst = s.rateBps;
        }
        if (worst == type(uint256).max || targetRate <= worst) return 0;
        return targetRate - worst;
    }

    function _updateOmni() internal {
        if (chainIds.length < 2) return;
        uint256 gBest;
        uint256 gChain;
        for (uint256 i = 0; i < chainIds.length; i++) {
            (, uint256 r,) = _bestAndGap(chainIds[i]);
            if (r > gBest) {
                gBest = r;
                gChain = chainIds[i];
            }
        }
        if (gBest == 0) return;

        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 id = chainIds[i];
            Chain storage c = chains[id];
            if (c.omniPaused) continue;
            (, uint256 local,) = _bestAndGap(id);
            bool changed = gChain != c.sentBestChain || _absDiff(gBest, c.sentGlobal) >= minGapBps
                || _absDiff(local, c.sentLocal) >= minGapBps;
            if (!changed) continue;
            c.sentBestChain = gChain;
            c.sentGlobal = gBest;
            c.sentLocal = local;
            emit OmniSignalSent(id, local, gBest, gChain);
            _cb(id, c.vault, abi.encodeCall(IVaultCallbacks.updateOmniSignal, (address(0), local, gBest, gChain)));
        }
    }

    function _healOmni() internal {
        // Only lift omnichain pauses once no pool anywhere is still tripped.
        for (uint256 i = 0; i < chainIds.length; i++) {
            address[] storage list = poolList[chainIds[i]];
            for (uint256 j = 0; j < list.length; j++) {
                if (pool[chainIds[i]][list[j]].tripped) return;
            }
        }
        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 id = chainIds[i];
            Chain storage c = chains[id];
            if (!c.omniPaused) continue;
            c.omniPaused = false;
            emit OmniHeal(id);
            _cb(id, c.vault, abi.encodeCall(IVaultCallbacks.unpauseByReactive, (address(0), OMNI_REASON)));
        }
    }

    function _watchPool(uint256 chainId, address p) internal {
        if (isWatched[chainId][p]) return;
        isWatched[chainId][p] = true;
        poolList[chainId].push(p);
        _sub(chainId, p, RATE_TOPIC);
        emit PoolWatched(chainId, p);
    }

    function _sub(uint256 chainId, address src, uint256 topic0) internal {
        SYSTEM.subscribe(chainId, src, topic0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    function _subscribeCron() internal {
        SYSTEM.subscribe(
            block.chainid, LEGACY_SYSTEM, CRON100_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
    }

    function _cb(uint256 chainId, address recipient, bytes memory payload) internal {
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: chainId,
                recipient: recipient,
                gasLimit: CALLBACK_GAS_LIMIT,
                payload: payload
            })
        );
    }

    function _key(uint256 chainId, uint256 id) private pure returns (bytes32) {
        return keccak256(abi.encode(chainId, id));
    }

    function _planKey(uint256 chainId, uint256 id) private pure returns (bytes32) {
        return keccak256(abi.encode(chainId, id));
    }

    function _absDiff(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a - b : b - a;
    }

    // ───────────────────────── Views (for the UI) ─────────────────────────

    function chainCount() external view returns (uint256) {
        return chainIds.length;
    }

    function poolCount(uint256 chainId) external view returns (uint256) {
        return poolList[chainId].length;
    }

    function poolAt(uint256 chainId, uint256 i) external view returns (address) {
        return poolList[chainId][i];
    }

    function riskScore(uint256 chainId, address p) external view returns (uint256) {
        return _risk(pool[chainId][p]);
    }

    function planCount() external view returns (uint256) {
        return planRefs.length;
    }

    function planAt(uint256 i)
        external
        view
        returns (uint256 chainId, uint256 planId, uint64 nextDue, uint16 remaining, bool active, uint8 attempts)
    {
        PlanRef storage ref = planRefs[i];
        PlanState storage ps = planState[_planKey(ref.chainId, ref.planId)];
        return (ref.chainId, ref.planId, ps.nextDue, ps.remaining, ps.active, ps.attempts);
    }

    function planInfo(uint256 chainId, uint256 id) external view returns (PlanState memory) {
        return planState[_planKey(chainId, id)];
    }

    function setRetryParams(uint256 retryAfter_, uint256 maxVerdictAge_) external onlyOwner {
        require(retryAfter_ >= 30, "retry too short");
        require(maxVerdictAge_ >= 60, "verdict age too short");
        retryAfter = retryAfter_;
        maxVerdictAge = maxVerdictAge_;
    }
}
