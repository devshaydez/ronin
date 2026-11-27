# Security model

Ronin is a hackathon build running on **Base Sepolia, Unichain Sepolia and Reactive Lasna**. It is
**testnet-only, unaudited, and holds no real money**. Do not deploy it to a mainnet or put funds you care
about into it.

This document states what the contracts actually enforce, which Foundry test proves each property, and where
the trust assumptions are. Every test named below lives in `test/RoninVault.t.sol`, `test/RoninReactive.t.sol`
or `test/AaveAdapter.t.sol` and runs with `forge test`.

## Actors

| Actor | Who it is | Can do |
|---|---|---|
| User | Any wallet | Deposit, withdraw, create and cancel their own standing orders |
| AI poster | An EOA held by the off-chain AI service | Post a signed verdict into `AIVerdictRegistry` |
| Reactive contract (RSC) | `RoninReactive` on Lasna | Pause, unpause, rebalance and execute plans through the callback proxy |
| Admin | The deployer EOA | Unpause, unfreeze a pool, add pools, change parameters |
| Callback proxy | Reactive Network system contract per chain | Forward RSC callbacks to the vault / requester |

## Threat model

| Threat | What stops it | Test |
|---|---|---|
| Someone else calls `rebalance`/`executePlan` directly | Callbacks must come from the proxy **and** name the RSC | `test_rebalanceRevertsForWrongCaller`, `test_rebalanceRevertsForWrongReactiveSender`, `test_executePlanOnlyThroughProxyAndReactive` |
| A leaked AI key is used to drain the vault | A verdict can only *ask*; the vault re-checks confidence, age, cooldown, move size and profit gate | `test_lowConfidenceRejected`, `test_staleVerdictRejected`, `test_profitGateSkipsATinyGain` |
| A verdict is replayed | Each `requestId` is answered once and verdict ids are consumed | `test_verdictCannotBeReplayed`, `test_requestCanOnlyBeAnsweredOnce` |
| A stranger posts a verdict | Only the configured poster can post | `test_onlyPosterCanPostVerdicts` |
| An unsolicited verdict moves funds | The registry only accepts verdicts answering its own open request | `test_unsolicitedVerdictRejected` |
| The AI unpauses a vault an admin paused | Reactive can only lift pauses it created itself | `test_reactiveCannotLiftAnAIPause`, `test_reactivePauseAndSameReasonHeal` |
| A bad pool drains the vault | An `EXIT` verdict freezes the pool and pulls funds before it can be used again | `test_emergencyExitFreezesPoolAndPullsFunds` |
| A pool turns toxic without any AI call | The RSC trips its own utilisation breaker on the rate feed | `test_breakerTripsOnHighUtilisationWithoutAI`, `test_exitOnOneChainPausesTheOtherAndHeals` |
| Stale rates keep the vault running | The watchdog pauses a chain whose feed goes quiet and heals when it returns | `test_cronPausesStaleChainAndRateResumeHeals` |
| Duplicate or noisy events spam the AI | Identical events collapse into one request, with backoff and a per-chain hourly cap | `test_repeatedIdenticalEventsProduceOneRequest`, `test_backoffExpiryProducesANewRequest`, `test_hourlyCapStopsRequestsPerChain`, `test_capIsPerChain` |
| A callback is never acknowledged | Callbacks retry a bounded number of times, then go `Stuck` instead of looping forever | `test_missingAckRetriesThenStuck`, `test_staleVerdictIsNotRetried` |
| A plan loop runs unbounded in one tick | At most 3 plans + 2 retries per tick | `test_boundedPlanLoopRespectsPerTickCap`, `test_gasCronTickWithMaxPlans` |
| A user's plan pays someone else's order | Only the plan owner can cancel; payouts are keyed by plan id | `test_cancelPlanOnlyOwner` |
| A YIELD_ONLY order quietly spends principal | YIELD_ONLY pays from accrued yield only and skips (without consuming a payment) when yield is short | `test_yieldOnlyPaysAfterYieldAccruesAndNeverTouchesPrincipal`, `test_yieldOnlySkipsWithoutYieldAndDoesNotConsumeAPayment`, `test_sixYieldOnlyPayoutsLeavePrincipalUntouched` |
| Cost basis is gamed by transfers or withdrawals | Basis moves proportionally on transfer, with yield, and to zero on a full exit | `test_costBasisMovesProportionallyOnTransfer`, `test_costBasisMovesWithAccruedYieldToo`, `test_fullWithdrawLeavesZeroCostBasis` |
| The Aave feed is spoofed by a look-alike event | The adapter matches the real Aave event signature and ignores other reserves | `test_aaveTopicMatchesTheRealEventSignature`, `test_aaveEventForOtherReserveIsIgnored` |
| Anyone can flip protocol parameters | Every setter is owner/admin gated | `test_addPoolOnlyAdmin`, `test_setBackoffIsOwnerOnly`, `test_minConfidenceIsOwnerOnly`, `test_feedToggleIsOwnerOnly` |
| The RSC is drained by its own cron | Cron is subscribed only while work exists; an idle contract burns nothing | `test_estimatedBurnPerHourIdleIsZero`, `test_gasCronTickIdleIsCheap`, `test_cronFollowsPlansInAndOut` |

## Trust assumptions you should know about

**Admin is a single EOA.** The deployment uses one deployer key for `onlyAdmin` on the vaults and `onlyOwner`
on the RSC. That key can unpause, unfreeze pools, add pools and change confidence, cooldown, move-size,
min-gain, min-period and max-skip parameters. It **cannot** move user funds out of the vault: there is no
withdraw-for-admin function. It also cannot post AI verdicts. Even so, a stolen admin key could lower the
rules to unsafe values, so treat it as trusted for this build. A real deployment needs a multisig plus a
timelock.

**The AI service is off-chain.** It decides *whether to ask* for a move; the on-chain rules decide whether
the move happens. The AI key can only post verdicts that answer an open request, and every such verdict is
re-checked by the vault. If the AI service is down, the vault keeps serving deposits and withdrawals and the
RSC keeps running its own breaker and watchdog; nothing gets stuck.

**Explorer and RPC reads are trusted for display only.** The UI and `npm run verify` read public RPCs and
Blockscout. A lying RPC can make the UI show the wrong numbers, but it cannot sign for you.

**The callback proxy is a Reactive Network system contract.** The vaults trust the proxy address given at
deploy and require every callback to name the RSC. If Reactive Network misbehaves, the affected path is
automation, not custody: withdrawals never depend on a callback.

## Money never crosses chains

There is no bridge. The Base vault holds Base Sepolia USDC, the Unichain vault holds Unichain Sepolia
USDC, and neither contract can move the other chain's token. What crosses chains is *information*: rates and
safety signals go to Lasna, and pause/exit instructions come back as callbacks. A compromise of one chain
therefore cannot drain the other directly.

## Mock pools and testnet tokens

On Unichain the vault sits in 16 `MockLendingPool` contracts whose rates are set by their owner, and the
asset is `MockUSDC`. On Base the vault uses a real Aave V3 adapter plus a controllable "stress" mock pool.
Mock pools are clearly labelled as demo data in the UI and are **not** a yield product: their rates can be
changed at will, which is exactly what the breaker and stale-data tests exercise. Base Sepolia USDC and the
mock tokens have no value.

## Known limitation: cost basis and reported yield

`yieldAvailable(owner)` is `convertToAssets(balanceOf(owner)) - costBasis(owner)`, and `costBasis` moves
proportionally on share transfers while withdrawals reduce it only by their principal part. Two consequences
remain by design: the number inherits ERC-4626 share-value rounding (a few wei) and only reflects yield already
accrued in this vault, and `YIELD_THEN_PRINCIPAL` will spend principal once yield is exhausted.

The 2026-11-20 build had a real defect in that accounting: `_withdraw` reduced cost basis in proportion to the
shares burned, removing the same fraction of unrealised gain, so `yieldAvailable` stayed roughly constant as a
`YIELD_ONLY` plan paid and the plan could spend principal without ever hitting the skip path; `PlanExecuted` also
reported `fromPrincipal = 0` for every payout. Fixed in commit `7fe5da3` before the 2026-11-22 deployment. Both
live vaults' verified source contains the principal-only reduction, so the deployed contracts are not affected and
no redeploy is needed; the Phase B2 run (only `YIELD_THEN_PRINCIPAL`, no yield) is unaffected too. Nothing in this
documentation change alters a contract.

## Not audited

No third party has reviewed this code. There is no bug bounty. The test suite (103 Foundry tests) is
evidence of intended behaviour, not proof of safety. If you build on it, get an audit first.

## Reporting

Open an issue at https://github.com/devshaydez/ronin. Please do not test against the live testnet
deployment in ways that could confuse other reviewers; fork the chain locally with `forge test` instead.
