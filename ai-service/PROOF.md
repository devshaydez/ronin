# Ronin Phase B2: evidence run (2026-11-22 deployment)

Generated 2026-11-23 from the live 2026-11-22 deployment. Every transaction below has receipt status `1`.
This is the current report; the older 2026-11-20 Phase B report is kept below as an archive.

| Contract | Address |
|---|---|
| Reactive (RSC, Lasna 5318007) | `0x69107baF143C38722744a09e3f27c3c076469d5f` |
| Base Sepolia vault | `0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66` |
| Base Sepolia requester / registry | `0xd3f0BD4a232AD8061DD119564AF64D8b6f340eBb` / `0x1Ba4da5288751378c1813a256885c7e376592D34` |
| Unichain Sepolia vault | `0xce75a97917c8fd52eA30684F0988FAe4485D64cD` |
| Unichain Sepolia requester / registry | `0xFcC603B48675Ae138890BF4A155A13A378DAA5B5` / `0xA97D4F33F029928B8c0B54Ee47129Aa39F51007f` |

## Final state

| Item | Value |
|---|---|
| `feedOn` | **false** |
| `cronOn` | **false** |
| `watchdog` | **false** |
| `activePlans` | **0** |
| `pendingActions` | **0** |
| `estimatedBurnPerHour` | **0 gas** |
| `ticks` | 63 |
| RSC reserves / debt | **0.4292435 lREACT / 0** |
| Base vault | **not paused**, 990.000000 USDC |
| Unichain vault | **not paused**, 997.000000 USDC |
| Unichain plans | `planCount=3`, no active plan (1 and 2 completed, 3 cancelled) |
| MCP `get_rc_health` | **HEALTHY**, 39/39 subscriptions active, 0 reverts/hour |

## 1. Stale-data self-heal

The Base vault started this run paused with reason `STALE_DATA` and 990 USDC. A fresh Base rate event made
the RSC clear its own stale pause and unpause only that reason.

| What | Chain | Tx | Block |
|---|---|---|---|
| Base stress `setRate(300,3500)` | Base | `0x608868ad8cc4aa49c5f15930b8c7dc41b2f9f7f93948e82522aa8e2261972ff5` | — |
| `StaleHealed(84532)` | Lasna | `0x2d5cb5f47e954b081c1cd932b19648a8ba65ccbe8c82376e2272ca82ea473c4e` | 9076360 |
| Base `UnpausedByReactive(STALE_DATA)` | Base | `0x056c4b4a56a699a0d9ce1abe0e3a41b7b8324901e02465870ebd6c6056b71bb5` | 62686011 |

After the callback: Base `paused=false`.

## 2. Omnichain breaker + heal

The breaker and the cross-chain pause were triggered by a real Unichain utilisation spike, then cleared by
returning utilisation to normal. The Unichain vault had no admin `pause()`; the breaker is what paused Base.

| What | Chain | Tx | Block |
|---|---|---|---|
| Unichain pool U `setRate(2400,9700)` | Unichain | `0xfe66a1bb4d49350c74f0348159980a361166b800ad2cb10a8f30c6613934379b` | — |
| `BreakerTripped(1301, U, 9700)` | Lasna | `0x691e0c939e31a06f040bf39dea366bc38151c2cbbbfe04422bf941734c3aea64` | 9076500 |
| U `EmergencyExit`, 500 USDC withdrawn | Unichain | `0x58b4999a16631e27b6daac5273f969d8f26e0ef282ae7c9725b0c112c7a02bf0` | 68606795 |
| `ExitObserved` + `OmniPause(84532)` | Lasna | `0x3a006972dcbb0e90560c7c56faa89a187400a899975720f472ee227e64eb64bb` | 9076502 |
| Base `PausedByReactive(OMNI_BREAKER)` | Base | `0x97e7dd3be8a95acc252efa5073d19a6669f30bce0b3e89e7e25f3abd400647e9` | 62686776 |
| U `setRate(2400,3500)` (heal) | Unichain | `0x44845c46081d0570645982135035319c98240c98fb607fceb39e871720cf89d6` | — |
| `BreakerCleared` + `OmniHeal(84532)` | Lasna | `0xc2a51d4270dcb3a43f5fc07dea609ff65d23a15bee31b7224477dd82a9b1ab56` | 9076713 |
| Base `UnpausedByReactive(OMNI_BREAKER)` | Base | `0x1bcddab6b02b99651e4e719c40e9076ea5cc4f3da6bad99f8f629e5e6073a723` | 62687892 |

After the heal: Base and Unichain both `paused=false`.

## 3. Standing orders: YIELD_ONLY vs YIELD_THEN_PRINCIPAL

Setup: 5 USDC was added to Unichain pool S and accrued to the vault. `totalAssets` became 1005.000000,
`costBasis` 1000.000000, `yieldAvailable` 4.999999.

| Setup | Tx |
|---|---|
| Mint 5 USDC to pool S | `0x236d8063aa03da4e72de48b628c8e9df14b4cabd7cae86144acd373d63d1c4fb` |
| `accrue(vault, 5e6)` | `0x4f15d987e19d75bfbcfa090266e72b55112b2cb5cbb57db15c9b640173cca2b2` |
| Plan 1, YIELD_ONLY, 1 USDC / 120 s × 3 | `0x89ae2128313e1acf4fae478d42011516a1c9c89527d093f8297fb17efe5363f5` |
| Plan 2, YIELD_THEN_PRINCIPAL, 5 USDC / 120 s × 1 | `0xa5a827f9dafa2e8f6cf04f28e1849be6166903e9165a7ebb2f9fdda4a71f4ed6` |
| Plan 3, YIELD_ONLY, 1 USDC / 120 s × 1 (expects skip) | `0x03cc6aab3dd7a58a5024f56fb463ebb917ff6a36122cb04ae1ed4fc689e8fd07` |

**YIELD_ONLY plan 1 — principal untouched.** Each payout used only yield:

| Payout | Tx | Amount | `fromYield` | `fromPrincipal` | `costBasis` after |
|---|---|---|---|---|---|
| 1 | `0x05c46ec5504583cbf9e49d8b75ccccb533a5f0ecce6a40e6866c167bd5c17518` | 1.000000 | 1.000000 | 0 | 1000.000000 |
| 2 | `0xc6150baa76821bad294c4421edc4de4a47788a48853bdbe783111b708e76ad9f` | 1.000000 | 1.000000 | 0 | 1000.000000 |
| 3 | `0x89de8df2c24342359cd7d7024988cbb2025646db351312f72d55a49065162570` | 1.000000 | 1.000000 | 0 | 1000.000000 |

**YIELD_THEN_PRINCIPAL plan 2 — yield first, then principal.** Executed at Unichain block 68608178:

| Total | `fromYield` | `fromPrincipal` | `costBasis` after | Tx |
|---|---|---|---|---|
| 5.000000 | 1.999999 | 3.000001 | 996.999999 | `0xbdedac6bfd0c82f619e0e635db842ccbe4cd284d109abead35809861b1a0f69e` |

**YIELD_ONLY plan 3 — correctly skipped with no yield left.** `PlanSkipped(3, "no yield yet")` at Unichain
block 68608502, tx `0x9d25fa33507fce94a6906959babab3b0f6e957bc744870050297e480e027e587`.
`remaining` stayed 1, `costBasis` and `yieldAvailable` were unchanged. The plan was then cancelled with
`0x5d570db31cc3c8ac27a58c975e5441f7221893a2693783808d56c9a717c73456`; no plan is active now.

## 4. Retry that heals

A real AI `ACT` was requested while the Unichain vault was paused. The first callback reverted on
`require(!paused, "paused")`; the admin unpaused, and the RSC's retry moved the funds. This is a successful
retry, not a skip.

| What | Chain | Tx | Block |
|---|---|---|---|
| AI `PAUSE` verdict 40, vault pauses | Lasna / Unichain | `0x2d7cc90190193cbe98a199b96d05034f4422c2fdfd8279ac57cdf475e2e586f4` | 9082014 |
| `VerdictSeen` 44 + `RebalanceRequested` for U (ACT, confidence **7000**, target `0x7938…B9F4`) | Lasna | `0x3361c4be7390f78f8092d4b20b0abb9791b7876a897683995c85f38c16250cca` | 9083685 |
| First callback rejected because the vault was paused | Unichain | not retrievable (Lasna does not post callback failure hashes) | — |
| Admin `unpause()` | Unichain | `0x12b0575b35776d0d71a94dbef7c07f9e2ce77a127204aa341617ce8bd2c398be` | 68614956 |
| Retry callback for verdict 44 | Lasna | `0x9e80c7d4e81944796819688f5404cb3dfd80f90231a9a69e903b5e5b3fceebfa` | 9084301 |
| `Rebalanced(44, U, 498.762144 moved, 990.000000 deployed)` | Unichain | `0xa71bcca7a280c61258e0050226b3287bcfdf5d416aa2cef386ce602a32b54ece` | 68615069 |
| `LoopClosed(1301, 44, 683 s)` | Lasna | `0x21032d303e9860d0b7c84e6a70aad5da9728766d3a81f78ed3a6c325a6a82dc1` | 9084303 |

The first attempt could not be observed as a failed destination tx: the vault reverted before emitting, and
Lasna only records the retry. The state before the unpause was `paused=true`; after it was `paused=false`, and
only then did the retry emit `Rebalanced`.

**Earlier stuck attempt.** An earlier ACT for the same pool (verdict 39) could not land because the step-2
breaker's `emergencyExit` had left pool U frozen; every callback reverted `bad target`. U was unfrozen with
`0xff8d329397b5973c80791ed0aabc4c469ab02efbb0d297a37fa9a7226e320fba`, and a fresh ACT (verdict 44) was
obtained. This is why the final proof uses verdict 44 rather than reusing 39.

## 5. Reactive MCP evidence

Captured from the Reactive MCP endpoint (`https://mcp.rnk.dev/mcp`) with the four tools below; full text is
committed under `docs/mcp-evidence/`.

| Tool | File | Result |
|---|---|---|
| `get_rc_health` | `get_rc_health.txt` | **HEALTHY**, debt 0, reserves 0.4292435 lREACT, 39/39 subscriptions, 0 reverts/hour |
| `list_subscriptions` | `list_subscriptions.txt` | **OK_SUBSCRIBED**, 39 active, 0 inactive |
| `trace_reactive_tx` | `trace_reactive_tx.txt` | traces the `BreakerTripped` tx `0x691e0c…` |
| `decode_callback` | `decode_callback.txt` | decodes the `OmniPause(84532)` callback tx `0x3a0069…` |

## Cost and deviations

- **Reserves hit zero twice during this run.** Execution stops while debt is positive, so two rate events were
  skipped until a top-up. Debt reached 0.0284 lREACT once and 0.0097 lREACT later; both were cleared by a
  top-up, and debt ended at 0.
- **Three extra 1 lREACT top-ups** were required: `0x800dbfe73eb75b401b8c4787796a4e9f6a54f0139067ab975fd6cd2f6389c295`,
  `0xd7aeca65323eb8714652f2a276be71e77a9b27f462ad73f996a9629ab399d631`,
  `0xb38f70b70c3aeb14382f689b0cf99ed8868e7043d35770de82bcbb88943ace5d`.
- **This exceeded the quoted estimate.** Starting reserve was 1.2367516 lREACT; after 3.0 lREACT of top-ups the
  final reserve is 0.4292435, so this run consumed **3.8075081 lREACT**, above the 2.5 lREACT worst case quoted
  before starting. The overrun came from repeated AI requests (the model returned `IGNORE` for “spike” several
  times), EMA warm-up updates, and retries against a frozen pool. It is reported here rather than hidden.
- **AI verdicts were stochastic.** The model accepted U only after the rate had been sustained long enough for
  its EMA to catch up (EMA 2388 at rate 2400, risk 312). Earlier samples were rejected as an unverified spike.
- **All controls are restored:** feed off, cron off, watchdog off, no active plans, no pending actions, both
  vaults unpaused, debt 0, `estimatedBurnPerHour()=0`.

---

# Historical Phase B report (2026-11-20 deployment)

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
