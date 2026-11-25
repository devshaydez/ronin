import { parseAbi } from 'viem';

/** ERC-4626 + the RoninVault plan surface used by the UI. */
export const vaultAbi = parseAbi([
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256) view returns (uint256)',
  'function previewWithdraw(uint256) view returns (uint256)',
  'function maxWithdraw(address) view returns (uint256)',
  'function yieldAvailable(address) view returns (uint256)',
  'function costBasis(address) view returns (uint256)',
  'function paused() view returns (bool)',
  'function pauseReason() view returns (bytes32)',
  'function planCount() view returns (uint256)',
  'function minPeriod() view returns (uint32)',
  'function poolFrozen(address) view returns (bool)',
  'function plans(uint256) view returns (address owner, address payee, uint128 amount, uint32 period, uint64 nextDue, uint16 remaining, bool active, uint8 mode, uint16 skips)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
  'function createPlan(address payee, uint128 amount, uint32 period, uint16 count, uint8 mode) returns (uint256)',
  'function cancelPlan(uint256 id)',
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event Rebalanced(uint256 indexed verdictId, address indexed toPool, uint256 moved, uint256 deployed)',
  'event RebalanceSkipped(uint256 indexed verdictId, uint256 plannedMove, uint256 annualGain)',
  'event PausedByVerdict(uint256 indexed verdictId)',
  'event PausedByReactive(bytes32 indexed reason)',
  'event UnpausedByReactive(bytes32 indexed reason)',
  'event EmergencyExit(address indexed pool, uint256 withdrawn)',
  'event OmniSignal(uint256 localBestBps, uint256 globalBestBps, uint256 globalBestChainId)',
  'event PoolAdded(address indexed pool)',
  'event Unpaused()',
  'event PoolUnfrozen(address indexed pool)',
  'event PlanCreated(uint256 indexed id, address indexed owner, address indexed payee, uint128 amount, uint32 period, uint64 nextDue, uint16 remaining, uint8 mode)',
  'event PlanCancelled(uint256 indexed id)',
  'event PlanSkipped(uint256 indexed id, string reason)',
  'event PlanExpired(uint256 indexed id)',
  'event PlanExecuted(uint256 indexed id, address indexed payee, uint256 amount, uint256 fromYield, uint256 fromPrincipal, uint64 nextDue, uint16 remaining)',
]);

/** Vault events only: the activity/log reader does not need the write surface. */
export const vaultEventsAbi = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event Rebalanced(uint256 indexed verdictId, address indexed toPool, uint256 moved, uint256 deployed)',
  'event RebalanceSkipped(uint256 indexed verdictId, uint256 plannedMove, uint256 annualGain)',
  'event PausedByVerdict(uint256 indexed verdictId)',
  'event PausedByReactive(bytes32 indexed reason)',
  'event UnpausedByReactive(bytes32 indexed reason)',
  'event EmergencyExit(address indexed pool, uint256 withdrawn)',
  'event OmniSignal(uint256 localBestBps, uint256 globalBestBps, uint256 globalBestChainId)',
  'event PoolAdded(address indexed pool)',
  'event Unpaused()',
  'event PoolUnfrozen(address indexed pool)',
  'event PlanCreated(uint256 indexed id, address indexed owner, address indexed payee, uint128 amount, uint32 period, uint64 nextDue, uint16 remaining, uint8 mode)',
  'event PlanCancelled(uint256 indexed id)',
  'event PlanSkipped(uint256 indexed id, string reason)',
  'event PlanExpired(uint256 indexed id)',
  'event PlanExecuted(uint256 indexed id, address indexed payee, uint256 amount, uint256 fromYield, uint256 fromPrincipal, uint64 nextDue, uint16 remaining)',
]);

export const registryAbi = parseAbi([
  'function count() view returns (uint256)',
  'function getVerdict(uint256 id) view returns (uint8 action, uint16 confidenceBps, address targetPool, bytes32 reasoningHash, uint64 timestamp, uint256 requestId)',
  'event VerdictPosted(uint256 indexed id, address indexed targetPool, uint8 action, uint16 confidenceBps, bytes32 reasoningHash, uint256 requestId)',
  'event VerdictReasoning(uint256 indexed id, string reasoning)',
]);

export const requesterAbi = parseAbi([
  'function count() view returns (uint256)',
  'function requestedAt(uint256 id) view returns (uint64)',
  'event DecisionRequested(uint256 indexed id, address indexed pool, uint256 rateBps, uint256 emaBps, uint256 utilBps, uint256 gapBps, uint256 riskScore, uint8 trigger)',
]);

/** Reactive Lasna events that explain retries, breaker actions and stale-data pauses. */
export const rscAbi = parseAbi([
  'function ticks() view returns (uint256)',
  'function activePlans() view returns (uint256)',
  'function pendingActions() view returns (uint256)',
  'function estimatedBurnPerHour() view returns (uint256)',
  'function feedOn() view returns (bool)',
  'function cronOn() view returns (bool)',
  'function watchdog() view returns (bool)',
  'event VerdictSeen(uint256 indexed chainId, uint256 indexed verdictId, uint8 action, uint256 secsSinceRequest, uint256 originTx)',
  'event RebalanceRequested(uint256 indexed chainId, uint256 indexed verdictId, address indexed toPool, uint256 gapBps)',
  'event PauseRequested(uint256 indexed chainId, uint256 indexed verdictId)',
  'event VerdictSkipped(uint256 indexed chainId, uint256 indexed verdictId, string reason)',
  'event LoopClosed(uint256 indexed chainId, uint256 indexed verdictId, uint256 requestToRebalanceSecs, uint256 originTx)',
  'event BreakerTripped(uint256 indexed chainId, address indexed pool, uint256 utilBps)',
  'event BreakerCleared(uint256 indexed chainId, address indexed pool)',
  'event ExitObserved(uint256 indexed chainId, address indexed pool, uint256 withdrawn, uint256 originTx)',
  'event OmniPause(uint256 indexed pausedChainId, uint256 indexed sourceChainId)',
  'event OmniHeal(uint256 indexed chainId)',
  'event StaleDetected(uint256 indexed chainId, uint256 silentForSecs)',
  'event StaleHealed(uint256 indexed chainId)',
  'event ActionRetried(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint8 attempt, uint256 originTx)',
  'event ActionStuck(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint256 originTx)',
  'event PlanScheduled(uint256 indexed chainId, uint256 indexed planId, uint64 nextDue, uint16 remaining)',
  'event CronEnabled(uint256 activePlans, uint256 pendingActions, bool watchdog, uint256 rescoreEveryTicks)',
  'event CronDisabled(uint256 activePlans, uint256 pendingActions, bool watchdog, uint256 rescoreEveryTicks)',
]);

export const systemAbi = parseAbi([
  'function reserves(address account) view returns (uint256)',
  'function debt(address account) view returns (uint256)',
]);

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);
