# Ronin Phase B: measured loop latency

Generated 2026-11-22 from the events of the fresh Phase B deployment.

| Contract | Address |
|---|---|
| Reactive (RSC, Lasna 5318007) | `0x69107baF143C38722744a09e3f27c3c076469d5f` |
| Base Sepolia vault | `0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66` |
| Base Sepolia requester | `0xd3f0BD4a232AD8061DD119564AF64D8b6f340eBb` |
| Unichain Sepolia vault | `0xce75a97917c8fd52eA30684F0988FAe4485D64cD` |
| Unichain Sepolia requester | `0xFcC603B48675Ae138890BF4A155A13A378DAA5B5` |

Windows scanned: Lasna `8,980,238..8,995,629`, Unichain `68,504,320..68,521,307`, Base `62,173,780..62,182,500`.

## Method

- **Origin tx** is the target pool's `RateUpdated` transaction (the `setRate` that produced the `RateObserved`).
- **Reactive tx** is the Lasna transaction that emitted `RebalanceRequested` for the verdict.
- **Destination tx** is the vault's `Rebalanced` with the same `verdictId`.
- **Request → Rebalanced** is `LoopClosed.requestToRebalanceSecs`, measured from `DecisionRequested` to
  `Rebalanced`, so it includes model inference, verdict posting and both callbacks.
- Payout origin is the vault's `PlanCreated`; the Reactive side is `PlanScheduled`; destination is each
  `PlanExecuted`. `Due → executed` uses the plan's 120 s cadence (`nextDue` of the previous step) and shows
  execution lateness rather than the intended wait.

The RSC produced **13** `Rebalanced` events. The table uses the 10 most recent loops where the triggering
`RateUpdated` and the destination `Rebalanced` both resolve cleanly; one duplicate F rebalance and the first B
loop (no `RateUpdated` inside the queried window) are excluded. Verdict 19 is also not in this table: it was
retried and ended in `RebalanceSkipped`, not `Rebalanced` (see below).

## AI-gated rebalances (n = 10)

| Verdict | Origin → Reactive | Origin → Destination | Request → Rebalanced |
|---|---|---|---|
| 9 | 19 s | 22 s | 19 s |
| 10 | 19 s | 22 s | 18 s |
| 11 | 23 s | 26 s | 23 s |
| 15 | 17 s | 20 s | 18 s |
| 20 | 23 s | 26 s | 24 s |
| 21 | 17 s | 19 s | 17 s |
| 22 | 19 s | 22 s | 20 s |
| 23 | 22 s | 25 s | 23 s |
| 24 | 18 s | 21 s | 20 s |
| 28 | 23 s | 26 s | 24 s |
| **Median** | **19 s** | **22 s** | **20 s** |
| **Worst** | **23 s** | **26 s** | **24 s** |

## Standing-order payouts (n = 10, plan #1: 1 USDC / 120 s, YIELD_THEN_PRINCIPAL)

`PlanCreated → PlanScheduled` took **<1 s** (the two chains' block clocks differ by one second).

| Payout | Origin → Destination | Due → Executed |
|---|---|---|
| 1 | 174 s | 54 s |
| 2 | 279 s | 39 s |
| 3 | 385 s | 25 s |
| 4 | 491 s | 11 s |
| 5 | 702 s | 102 s |
| 6 | 808 s | 88 s |
| 7 | 914 s | 74 s |
| 8 | 1019 s | 59 s |
| 9 | 1125 s | 45 s |
| 10 | 1230 s | 30 s |
| **Median** | **755 s** | **50 s** |
| **Worst** | **1230 s** | **102 s** |

Origin → destination includes the deliberate 120 s payout spacing; all ten executed, with no skipped or expired
payouts.

## Payout accounting (plan #1, `YIELD_THEN_PRINCIPAL`)

Read at the Base block before the first payout and at each payout block through the Tenderly archive gateway
(`costBasis`, `yieldAvailable`, `convertToAssets(balanceOf(owner))`, `totalAssets`; owner
`0x40A9e821A48BA535B17679b95F4F7353d7F845ab`, 6-decimal USDC). These are live historical `eth_call`s, not
derived from the events.

| Mark | Block | `costBasis` | `yieldAvailable` | `convertToAssets(balanceOf)` | `totalAssets` | `fromYield` / `fromPrincipal` |
|---|---|---|---|---|---|---|
| before #1 | 62176768 | 1000.000000 | 0.000000 | 1000.000000 | 1000.000000 | — |
| after #1 | 62176769 | 999.000000 | 0.000000 | 999.000000 | 999.000000 | 0 / 1.000000 |
| after #2 | 62177295 | 998.000000 | 0.000000 | 998.000000 | 998.000000 | 0 / 1.000000 |
| after #3 | 62177825 | 997.000000 | 0.000000 | 997.000000 | 997.000000 | 0 / 1.000000 |
| after #4 | 62178355 | 996.000000 | 0.000000 | 996.000000 | 996.000000 | 0 / 1.000000 |
| after #5 | 62179410 | 995.000000 | 0.000000 | 995.000000 | 995.000000 | 0 / 1.000000 |
| after #6 | 62179936 | 994.000000 | 0.000000 | 994.000000 | 994.000000 | 0 / 1.000000 |
| after #7 | 62180466 | 993.000000 | 0.000000 | 993.000000 | 993.000000 | 0 / 1.000000 |
| after #8 | 62180994 | 992.000000 | 0.000000 | 992.000000 | 992.000000 | 0 / 1.000000 |
| after #9 | 62181521 | 991.000000 | 0.000000 | 991.000000 | 991.000000 | 0 / 1.000000 |
| after #10 | 62182049 | 990.000000 | 0.000000 | 990.000000 | 990.000000 | 0 / 1.000000 |

There was **no yield** in this plan: every payout was `fromYield = 0`, `fromPrincipal = 1 USDC`, so cost basis
and position value both fell by exactly 1 USDC per payout (1000 → 990). This is the expected
`YIELD_THEN_PRINCIPAL` behaviour when the position has not earned yield — it does not show principal unchanged.

**No `YIELD_ONLY` plan was created in Phase B.** The fresh vault has exactly one `PlanCreated`, mode 1
(`YIELD_THEN_PRINCIPAL`). The `YIELD_ONLY` runs in `DEPLOYMENTS.md` belong to the older 2026-11-20 deployment,
not this one, so there is no Phase B YIELD_ONLY principal-unchanged proof to show.

## Ack, retry, pause, and self-heal evidence

This is the complete Phase B record. There is **one genuine retry**, and it ended in a skip rather than a move.

| What | Chain | Tx | Block | Time (unix) |
|---|---|---|---|---|
| AI `PAUSE` verdict 17 | Unichain | `0xc9b2600c7671ca20df0b67406f4248f8e73217814ade9ea1018aa8d159d9a919` | 68519694 | 1795372122 |
| Vault pauses on verdict 17 | Unichain | `0x05712d5f3f0d5d937aa02d1b5a8ef638d8386bcb605cd4fe8937322bf3801d78` | 68519696 | 1795372124 |
| Verdict 19 `ACT` posted (first rebalance callback sent while paused) | Unichain | `0x5a0d374980be58afc99278c7d590bd1289077a66629e0f3dd110b963fbc8ac70` | 68519766 | 1795372194 |
| Admin `unpause()` | Unichain | `0xeee67d5cdd11d6224865a0db4ecbef72fd0af45f5c23fdf74b60dcc282a486bc` | 68519907 | 1795372335 |
| `ActionRetried(1301, kind=2, id=19, attempt=2)` | Lasna | `0x81d2647d6b82aed90efadf872f48b7a96b2142c0f833242cb933feb6bf29c703` | 8994901 | 1795372649 |
| Retry accepted, `RebalanceSkipped(19, 0, 0)` | Unichain | `0xd0f8d815d5080c0556d97a6e90597c99ef51fdd8ad51b10c9cad3a2d4825d0dd` | 68520224 | 1795372652 |

**Cause.** Verdict 17 paused the Unichain vault 70 s before verdict 19's first `rebalance` callback. The vault's
`rebalance()` begins with `require(!paused, "paused")`, so the first callback reverted; Lasna does not post
callback results back, so that failed tx hash is not retrievable. After the admin unpause, the RSC retried at
attempt 2. This time the call succeeded, but `_planMove` returned `plannedMove = 0, annualGain = 0`, so the vault
emitted `RebalanceSkipped` instead of moving funds. No `ActionStuck` occurred and the action was cleared.

No `BreakerTripped`, `BreakerCleared`, `EmergencyExit`, `ExitObserved`, `OmniPause`, or `OmniHeal` event exists in
the full Phase B Lasna range (`8,979,790..8,998,573`), so the omnichain breaker + self-heal demo was **not run on
this deployment**. The only other pause was a stale-data pause, and it was not healed:

| What | Chain | Tx | Block | Time |
|---|---|---|---|---|
| `StaleDetected(84532, 2616)` + `SelfFunded` | Lasna | `0x57c4c8787ee505fa6b5bb4e95dd56b03a2d980f100b8e568d8c1362c2ededfd6` | 8982501 | 1795359442 |
| Base vault `PausedByReactive(STALE_DATA)` | Base | `0x6ed04bc267a73da9c83435f3755ff0a01309d9ef20e2cd6d866e1c83e136206f` | 62187880 | 1795359444 |

The Base vault is still paused at capture (see final state), and the feed is off, so no new `RateObserved`
arrives to trigger the RSC's automatic `StaleHealed` unpause.

## Final state at capture

| Item | Value |
|---|---|
| `feedOn` | false |
| `cronOn` | false |
| `watchdog` | false |
| `activePlans` | 0 |
| `pendingActions` | 0 |
| `estimatedBurnPerHour` | 0 gas (cron and feed both off) |
| `ticks` | 21 |
| RSC reserves (system credit) | 1.2367516 lREACT |
| RSC debt | 0 |
| lREACT balance of the RSC address | 0 |
| Base vault | paused, reason `STALE_DATA`, 990 USDC |
| Unichain vault | not paused, 1000 USDC |
| Lasna `stalePaused` | Base true, Unichain false |
| `rebalances` counter | Base 5, Unichain 13 |
| Deployer lREACT (Lasna) | 6.047264759995901037 |
| Deployer Base ETH | 0.033840418431903699 |
| Deployer Unichain ETH | 0.088981267935069914 |

**What "1.24 lREACT left in RSC reserves and no balance in the RSC contract" means.** `reserves(RSC)` is an
accounting credit inside Reactive's system contract (`0x8888…8888`), not an ERC20 balance at the RSC address.
The RSC address holds 0 lREACT; the system contract holds the pooled lREACT and lets the RSC spend its 1.2367516
credit on reactions and callbacks. It is usable prepaid gas, not a token the RSC can transfer.

## Not run / not captured

- **Omnichain breaker + self-heal** (`BreakerTripped` → `EmergencyExit` → cross-chain pause → `BreakerCleared` →
  unpause): not run on the Phase B deployment; no such events exist.
- **`ActionStuck`**: none occurred. The one retry (verdict 19) succeeded as a skip.
- **`YIELD_ONLY` plan**: not created in Phase B.
- **Reactive MCP** `get_rc_health` / `decode_callback`: no output was captured. `ops.js` only keeps a 1200-char
  in-memory snippet and it was not run for this report; the `HEALTHY` line in `DEPLOYMENTS.md` is from the older
  2026-11-20 deployment.

## Spend

About **6.7 lREACT** of the **12.238 lREACT** budget was consumed (deploy gas, 4 lREACT RSC funding, the 1.5
lREACT reserve seed, and owner/loop transactions). **1.2367516 lREACT** remains as system-contract reserve
credit for the RSC; the RSC address itself holds 0 lREACT.
