// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {AbstractCallback} from "@reactive/src/base/AbstractCallback.sol";
import {ILendingPool} from "./interfaces/ILendingPool.sol";
import {IAIVerdictRegistry} from "./interfaces/IAIVerdictRegistry.sol";

/// @title RoninVault
/// @notice ERC-4626 yield vault. Funds are only ever moved by callbacks that (a) arrive through the
///         Reactive callback proxy, (b) are signed off by our Reactive contract, and (c) for AI-driven
///         actions, match a fresh, unused, high-confidence verdict re-read from the on-chain registry.
///         Even a fully compromised AI can only move funds between whitelisted pools, within caps.
///         Reactive-only actions (pause / unpause / emergency exit) can never move funds to a third party.
contract RoninVault is ERC4626, AbstractCallback {
    using SafeERC20 for IERC20;

    bytes32 public constant AI_PAUSE = keccak256("AI_PAUSE");

    address public immutable admin;
    IAIVerdictRegistry public immutable registry; // zero => AI rebalancing disabled on this chain

    address[] public pools;
    mapping(address => bool) public isPool;
    mapping(address => bool) public poolFrozen;
    mapping(uint256 => bool) public verdictUsed;

    /// @notice Where a recurring payout draws from.
    ///         YIELD_ONLY never touches principal (skips until the position has earned enough).
    ///         YIELD_THEN_PRINCIPAL pays from yield first, then from principal.
    enum PayoutMode {
        YIELD_ONLY,
        YIELD_THEN_PRINCIPAL
    }

    struct Plan {
        address owner;
        address payee;
        uint128 amount;
        uint32 period;
        uint64 nextDue;
        uint16 remaining;
        bool active;
        PayoutMode mode;
        uint16 skips; // consecutive YIELD_ONLY skips (resets on a payout)
    }

    bool public paused;
    bytes32 public pauseReason;
    uint16 public minConfidenceBps = 7000;
    uint16 public maxMoveBps = 5000; // max share of TVL moved per rebalance
    uint64 public maxVerdictAge = 15 minutes;
    uint64 public cooldown = 20 seconds;
    uint64 public lastRebalance;
    uint256 public minAnnualGain; // asset units per year the move must earn to be worth it (0 = gate off)

    // Standing orders ("Yield Salary")
    uint32 public minPeriod = 120; // shortest allowed payout period, seconds
    uint16 public maxSkips = 12; // consecutive YIELD_ONLY skips before the plan expires
    uint256 public planCount;
    mapping(uint256 => Plan) internal _plans;

    /// @notice Assets each account put in and has not withdrawn. Withdrawals and plan payouts reduce it only
    ///         by their principal portion (yield is consumed first); plain share transfers move it
    ///         proportionally. `convertToAssets(balanceOf(owner)) - costBasis[owner]` is the account's
    ///         unrealised yield.
    mapping(address => uint256) public costBasis;

    // Omnichain yield signal pushed by the Reactive contract (informational: lets a UI route new
    // deposits to the chain with the best yield; the vault does not bridge funds).
    uint256 public localBestBps;
    uint256 public globalBestBps;
    uint256 public globalBestChainId;
    uint64 public omniSignalAt;

    event Rebalanced(uint256 indexed verdictId, address indexed toPool, uint256 moved, uint256 deployed);
    event RebalanceSkipped(uint256 indexed verdictId, uint256 plannedMove, uint256 annualGain);
    event PausedByVerdict(uint256 indexed verdictId);
    event PausedByReactive(bytes32 indexed reason);
    event UnpausedByReactive(bytes32 indexed reason);
    event EmergencyExit(address indexed pool, uint256 withdrawn);
    event OmniSignal(uint256 localBestBps, uint256 globalBestBps, uint256 globalBestChainId);
    event PoolAdded(address indexed pool);
    event Unpaused();
    event PoolUnfrozen(address indexed pool);

    // Standing orders. All plan data is in PlanCreated so the Reactive contract never has to read chain state.
    event PlanCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed payee,
        uint128 amount,
        uint32 period,
        uint64 nextDue,
        uint16 remaining,
        PayoutMode mode
    );
    event PlanCancelled(uint256 indexed id);
    event PlanSkipped(uint256 indexed id, string reason);
    event PlanExpired(uint256 indexed id);
    event PlanExecuted(
        uint256 indexed id,
        address indexed payee,
        uint256 amount,
        uint256 fromYield,
        uint256 fromPrincipal,
        uint64 nextDue,
        uint16 remaining
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(
        IPayable callbackProxy_,
        address callbackSender_,
        IERC20 asset_,
        IAIVerdictRegistry registry_,
        address[] memory pools_
    )
        payable
        ERC4626(asset_)
        ERC20("Ronin Vault Share", "rvUSDC")
        AbstractCallback(callbackProxy_, callbackSender_)
    {
        admin = msg.sender;
        registry = registry_;
        for (uint256 i = 0; i < pools_.length; i++) {
            pools.push(pools_[i]);
            isPool[pools_[i]] = true;
        }
    }

    // ───────────────────────── ERC-4626 ─────────────────────────

    function totalAssets() public view override returns (uint256 total) {
        total = IERC20(asset()).balanceOf(address(this));
        for (uint256 i = 0; i < pools.length; i++) {
            total += ILendingPool(pools[i]).balanceOf(address(this));
        }
    }

    function maxDeposit(address receiver) public view override returns (uint256) {
        return paused ? 0 : super.maxDeposit(receiver);
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return paused ? 0 : super.maxMint(receiver);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        costBasis[receiver] += assets;
        _deployIdle();
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        // Measure yield BEFORE the withdrawal: a payout consumes yield first, and only the part of the
        // assets above it is principal. Cost basis tracks principal, so that is the only part that moves.
        uint256 yieldBefore = yieldAvailable(owner_);
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) _pullFromPools(assets - idle);
        super._withdraw(caller, receiver, owner_, assets, shares);

        uint256 principalPart = assets > yieldBefore ? assets - yieldBefore : 0;
        uint256 basis = costBasis[owner_];
        uint256 remaining = basis > principalPart ? basis - principalPart : 0;
        // Share-value rounding can leave the position one wei below the computed basis; never report a
        // cost basis above what the remaining shares are worth.
        uint256 valueAfter = convertToAssets(balanceOf(owner_));
        costBasis[owner_] = remaining > valueAfter ? valueAfter : remaining;
    }

    /// @dev Plain share transfers move cost basis proportionally, so yield cannot be created or destroyed
    ///      by moving shares between wallets. Mints and burns are handled in _deposit/_withdraw above.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 balBefore = balanceOf(from);
            uint256 basis = costBasis[from];
            if (balBefore > 0 && basis > 0) {
                uint256 moved = Math.mulDiv(basis, value, balBefore);
                // Proportional movement, with a wei-level guard so rounding can never report a basis above
                // what the shares are worth on either side.
                uint256 remaining = basis - moved;
                uint256 fromValue = convertToAssets(balBefore - value);
                costBasis[from] = remaining > fromValue ? fromValue : remaining;
                uint256 toBasis = costBasis[to] + moved;
                uint256 toValue = convertToAssets(balanceOf(to) + value);
                costBasis[to] = toBasis > toValue ? toValue : toBasis;
            }
        }
        super._update(from, to, value);
    }

    function poolsLength() external view returns (uint256) {
        return pools.length;
    }

    // ───────────────────── Standing orders ("Yield Salary") ─────────────────────

    /// @notice Create a recurring payout. The Reactive contract sees PlanCreated and schedules the payouts;
    ///         no keeper or signature is needed after this transaction.
    function createPlan(address payee, uint128 amount, uint32 period, uint16 count, PayoutMode mode)
        external
        returns (uint256 id)
    {
        require(payee != address(0), "payee required");
        require(amount > 0, "amount required");
        require(period >= minPeriod, "period too short");
        require(count >= 1 && count <= 365, "count out of range");

        id = ++planCount;
        uint64 nextDue = uint64(block.timestamp + period);
        _plans[id] = Plan({
            owner: msg.sender,
            payee: payee,
            amount: amount,
            period: period,
            nextDue: nextDue,
            remaining: count,
            active: true,
            mode: mode,
            skips: 0
        });
        emit PlanCreated(id, msg.sender, payee, amount, period, nextDue, count, mode);
    }

    /// @notice Stop a plan. Only its owner may do this.
    function cancelPlan(uint256 id) external {
        Plan storage p = _plans[id];
        require(p.owner == msg.sender, "only plan owner");
        require(p.active, "inactive");
        p.active = false;
        emit PlanCancelled(id);
    }

    /// @notice Execute one due payout. Called only by the Reactive contract, through the callback proxy.
    ///         Payouts keep working while the vault is paused: a pause only blocks deposits.
    function executePlan(address reactive_, uint256 id)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        Plan storage p = _plans[id];
        require(p.active, "inactive");
        require(block.timestamp >= p.nextDue, "not due");

        address owner_ = p.owner;
        uint256 amount = p.amount;
        uint256 fromYield;
        uint256 fromPrincipal;

        if (p.mode == PayoutMode.YIELD_ONLY) {
            if (yieldAvailable(owner_) < amount) {
                // No principal is touched, and the period does not consume a payment: the salary is simply
                // postponed. Too many consecutive empty periods expire the plan instead of retrying forever.
                p.nextDue = uint64(uint256(p.nextDue) + p.period);
                p.skips++;
                emit PlanSkipped(id, "no yield yet");
                if (p.skips >= maxSkips) {
                    p.active = false;
                    emit PlanExpired(id);
                }
                return;
            }
            fromYield = amount;
        } else {
            if (maxWithdraw(owner_) < amount) {
                p.nextDue = uint64(uint256(p.nextDue) + p.period);
                p.remaining--;
                emit PlanSkipped(id, "insufficient");
                if (p.remaining == 0) p.active = false;
                return;
            }
            uint256 yield_ = yieldAvailable(owner_);
            fromYield = yield_ < amount ? yield_ : amount;
            fromPrincipal = amount - fromYield;
        }

        uint256 shares = previewWithdraw(amount);
        _withdraw(owner_, p.payee, owner_, amount, shares);

        p.skips = 0;
        p.nextDue = uint64(uint256(p.nextDue) + p.period);
        p.remaining--;
        if (p.remaining == 0) p.active = false;
        emit PlanExecuted(id, p.payee, amount, fromYield, fromPrincipal, p.nextDue, p.remaining);
    }

    /// @notice Unrealised yield for an account: current value minus what it deposited (net of withdrawals).
    function yieldAvailable(address owner_) public view returns (uint256) {
        uint256 value = convertToAssets(balanceOf(owner_));
        uint256 basis = costBasis[owner_];
        return value > basis ? value - basis : 0;
    }

    function plans(uint256 id) external view returns (Plan memory) {
        return _plans[id];
    }

    // ───────────────────── Reactive callbacks ─────────────────────
    // First argument is always the injected reactive address (see Reactive docs).

    /// @notice Move capital from lower-rate pools into `toPool`, authorised by an AI ACT verdict.
    function rebalance(address reactive_, uint256 verdictId, address toPool)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        require(!paused, "paused");
        require(isPool[toPool] && !poolFrozen[toPool], "bad target");
        require(block.timestamp >= lastRebalance + cooldown, "cooldown");
        _consumeVerdict(verdictId, 1, toPool);

        uint256 budget = (totalAssets() * maxMoveBps) / 10_000;

        // Profitability gate: only move if the annualised extra yield on the amount moved is worth acting on.
        (uint256 plannedMove, uint256 annualGain) = _planMove(toPool, budget);
        if (plannedMove == 0 || annualGain < minAnnualGain) {
            emit RebalanceSkipped(verdictId, plannedMove, annualGain);
            return; // verdict stays consumed; nothing moved, nothing wasted
        }

        lastRebalance = uint64(block.timestamp);
        uint256 moved = _drainLowerRatePools(toPool, budget);
        uint256 deployed = _deployTo(toPool);
        emit Rebalanced(verdictId, toPool, moved, deployed);
    }

    /// @notice Pause new deposits, authorised by an AI PAUSE verdict.
    function pauseByVerdict(address reactive_, uint256 verdictId)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        _consumeVerdict(verdictId, 3, address(0));
        paused = true;
        pauseReason = AI_PAUSE;
        emit PausedByVerdict(verdictId);
    }

    /// @notice Circuit breaker: pull everything out of a pool and freeze it. No AI involved.
    function emergencyExit(address reactive_, address pool)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        require(isPool[pool], "unknown pool");
        poolFrozen[pool] = true;
        uint256 bal = ILendingPool(pool).balanceOf(address(this));
        if (bal > 0) ILendingPool(pool).withdraw(bal);
        emit EmergencyExit(pool, bal);
    }

    /// @notice Pause deposits for a protocol-level reason (stale data, omnichain breaker). Withdrawals stay open.
    function pauseByReactive(address reactive_, bytes32 reason)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        if (!paused) {
            paused = true;
            pauseReason = reason;
            emit PausedByReactive(reason);
        }
    }

    /// @notice Self-healing: only lifts a pause that was set for the SAME reason. Never lifts an AI pause
    ///         or an admin pause. A no-op (not a revert) if the reason does not match.
    function unpauseByReactive(address reactive_, bytes32 reason)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        if (paused && pauseReason == reason) {
            paused = false;
            pauseReason = bytes32(0);
            emit UnpausedByReactive(reason);
        }
    }

    function updateOmniSignal(address reactive_, uint256 local_, uint256 global_, uint256 globalChainId_)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        localBestBps = local_;
        globalBestBps = global_;
        globalBestChainId = globalChainId_;
        omniSignalAt = uint64(block.timestamp);
        emit OmniSignal(local_, global_, globalChainId_);
    }

    // ───────────────────────── Admin ─────────────────────────

    /// @notice Whitelist a new pool. The Reactive contract sees PoolAdded and subscribes to the pool's
    ///         rate events by itself (dynamic subscription).
    function addPool(address pool) external onlyAdmin {
        require(!isPool[pool], "exists");
        isPool[pool] = true;
        pools.push(pool);
        emit PoolAdded(pool);
    }

    function unpause() external onlyAdmin {
        paused = false;
        pauseReason = bytes32(0);
        emit Unpaused();
    }

    function unfreeze(address pool) external onlyAdmin {
        poolFrozen[pool] = false;
        emit PoolUnfrozen(pool);
    }

    function setParams(uint16 minConfidenceBps_, uint16 maxMoveBps_, uint64 maxVerdictAge_, uint64 cooldown_)
        external
        onlyAdmin
    {
        require(minConfidenceBps_ <= 10_000 && maxMoveBps_ <= 10_000, "bps");
        minConfidenceBps = minConfidenceBps_;
        maxMoveBps = maxMoveBps_;
        maxVerdictAge = maxVerdictAge_;
        cooldown = cooldown_;
    }

    function setMinAnnualGain(uint256 minAnnualGain_) external onlyAdmin {
        minAnnualGain = minAnnualGain_;
    }

    function setMinPeriod(uint32 minPeriod_) external onlyAdmin {
        require(minPeriod_ > 0, "period");
        minPeriod = minPeriod_;
    }

    /// @notice Consecutive YIELD_ONLY skips before a plan expires (1..365).
    function setMaxSkips(uint16 maxSkips_) external onlyAdmin {
        require(maxSkips_ >= 1 && maxSkips_ <= 365, "maxSkips");
        maxSkips = maxSkips_;
    }

    /// @notice Settle outstanding callback debt from this contract's ETH balance.
    function coverDebt() external {
        _coverDebt();
    }

    // ───────────────────────── Internals ─────────────────────────

    function _consumeVerdict(uint256 id, uint8 expectedAction, address expectedPool) internal {
        require(address(registry) != address(0), "no AI registry");
        require(!verdictUsed[id], "verdict used");
        IAIVerdictRegistry.Verdict memory v = registry.getVerdict(id);
        require(v.timestamp != 0, "no verdict");
        require(v.action == expectedAction, "wrong action");
        require(v.confidenceBps >= minConfidenceBps, "low confidence");
        require(block.timestamp <= uint256(v.timestamp) + maxVerdictAge, "stale verdict");
        require(v.targetPool == expectedPool, "pool mismatch");
        verdictUsed[id] = true;
    }

    /// @dev Dry run of _drainLowerRatePools: how much would move and what it would earn per year (asset units).
    function _planMove(address toPool, uint256 budget) internal view returns (uint256 moved, uint256 annualGain) {
        uint256 targetRate = ILendingPool(toPool).rateBps();
        for (uint256 i = 0; i < pools.length && moved < budget; i++) {
            address p = pools[i];
            if (p == toPool) continue;
            uint256 r = ILendingPool(p).rateBps();
            if (r >= targetRate) continue;
            uint256 bal = ILendingPool(p).balanceOf(address(this));
            if (bal == 0) continue;
            uint256 take = bal < budget - moved ? bal : budget - moved;
            moved += take;
            annualGain += (take * (targetRate - r)) / 10_000;
        }
    }

    function _drainLowerRatePools(address toPool, uint256 budget) internal returns (uint256 moved) {
        uint256 targetRate = ILendingPool(toPool).rateBps();
        for (uint256 i = 0; i < pools.length && moved < budget; i++) {
            address p = pools[i];
            if (p == toPool) continue;
            if (ILendingPool(p).rateBps() >= targetRate) continue;
            uint256 bal = ILendingPool(p).balanceOf(address(this));
            if (bal == 0) continue;
            uint256 take = bal < budget - moved ? bal : budget - moved;
            ILendingPool(p).withdraw(take);
            moved += take;
        }
    }

    function _deployTo(address pool) internal returns (uint256 amount) {
        amount = IERC20(asset()).balanceOf(address(this));
        if (amount == 0) return 0;
        IERC20(asset()).forceApprove(pool, amount);
        ILendingPool(pool).deposit(amount);
    }

    function _deployIdle() internal {
        address best;
        uint256 bestRate;
        for (uint256 i = 0; i < pools.length; i++) {
            address p = pools[i];
            if (poolFrozen[p]) continue;
            uint256 r = ILendingPool(p).rateBps();
            if (best == address(0) || r > bestRate) {
                best = p;
                bestRate = r;
            }
        }
        if (best != address(0)) _deployTo(best);
    }

    function _pullFromPools(uint256 needed) internal {
        for (uint256 i = 0; i < pools.length && needed > 0; i++) {
            address p = pools[i];
            uint256 bal = ILendingPool(p).balanceOf(address(this));
            if (bal == 0) continue;
            uint256 take = bal < needed ? bal : needed;
            ILendingPool(p).withdraw(take);
            needed -= take;
        }
    }
}
