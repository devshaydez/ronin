// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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

    bool public paused;
    bytes32 public pauseReason;
    uint16 public minConfidenceBps = 7000;
    uint16 public maxMoveBps = 5000; // max share of TVL moved per rebalance
    uint64 public maxVerdictAge = 15 minutes;
    uint64 public cooldown = 20 seconds;
    uint64 public lastRebalance;
    uint256 public minAnnualGain; // asset units per year the move must earn to be worth it (0 = gate off)

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
        _deployIdle();
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) _pullFromPools(assets - idle);
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    function poolsLength() external view returns (uint256) {
        return pools.length;
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
