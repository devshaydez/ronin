# Ronin: a keeperless, AI-gated, omnichain yield vault on Reactive

ERC-4626 vaults on Base Sepolia and Unichain Sepolia, orchestrated by **one Reactive contract on Lasna**.
No keeper bot. The AI is woken by the Reactive contract and gated by the vault.

```
 origin chains                              Lasna (Reactive)                         origin chains
 ─────────────                              ────────────────                         ─────────────
 Pool.RateUpdated ─────────────────────▶  RoninReactive.react()
 Vault.Rebalanced / EmergencyExit /          │ computes EMA, spike, risk score on-chain
 PoolAdded  ───────────────────────────▶     │ HOP 1: requestCallback ───────────────▶ DecisionRequester
 Registry.VerdictPosted ───────────────▶     │                                              │ DecisionRequested
 DecisionRequested ────────────────────▶     │                                              ▼
 Cron100 (~2 min) ─────────────────────▶     │                                      ai-service (NEAR AI)
                                             │                                              │ postVerdict
                                             │ HOP 2: ACT/PAUSE verdict ◀── VerdictPosted ──┘ (AIVerdictRegistry)
                                             ├─ rebalance / pauseByVerdict ──────────▶ RoninVault (re-validates)
                                             ├─ emergencyExit (breaker, no AI) ──────▶ RoninVault
                                             ├─ pauseByReactive / unpauseByReactive ─▶ every OTHER chain's vault
                                             ├─ executePlan (standing orders) ───────▶ RoninVault
                                             └─ updateOmniSignal ────────────────────▶ every vault
```

Repository layout:

| Path | What |
|---|---|
| `src/` | `RoninVault` (ERC-4626 + plans), `RoninReactive` (the brain), `DecisionRequester`, `AIVerdictRegistry`, Aave adapter, mocks |
| `test/` | 87 Foundry tests: vault accounting/plans, reactive scheduling/acks/backoff, Aave adapter |
| `script/` | `1_DeployReactive`, `2_DeployChain`, `3_WireReactive` |
| `ai-service/` | `index.js` (NEAR AI answerer), `ops.js` (autonomous top-ups), `proof.js` (writes `PROOF.md`) |
| `DEPLOYMENTS.md` | every address and transaction of the live testnet deployment |
| `ai-service/PROOF.md` | generated evidence: origin tx → Reactive tx → destination tx per loop |

## What the Reactive contract does

| # | Capability | Reactive feature used |
|---|---|---|
| 1 | Per-pool EMA, deviation, spike and 0-10000 risk score computed in `react()` | stateful on-chain compute |
| 2 | Wakes the AI via a callback to `DecisionRequester`; the registry only accepts verdicts that answer a real request | callbacks as a trigger for off-chain work |
| 3 | Consumes `VerdictPosted` and calls the vault; the vault re-checks the verdict on-chain | event-driven callbacks, two-hop loop |
| 4 | **Omnichain breaker**: an exit on any chain pauses deposits on all others; heals itself when the trigger clears | multi-chain subscriptions, one brain |
| 5 | **Omnichain yield signal** pushed to every vault (UI can steer new deposits) | multi-chain callbacks |
| 6 | **CRON watchdog**: no rate data for 15 min pauses the vault; data returning unpauses it | `Cron100` subscription |
| 7 | **Dynamic subscriptions**: `vault.addPool()` emits `PoolAdded`; the Reactive contract subscribes to the new pool by itself | subscribe from inside `react()` |
| 8 | **Feedback loop**: watches the vault's own `Rebalanced` and measures request-to-rebalance time on-chain (`LoopClosed`) | subscribing to your own outputs |
| 9 | **Self-funding**: on every CRON tick the Reactive contract tops its own reserves up (`depositTo`) before they run dry, because execution stops while debt > 0 | Reactive economy (reserves, debt) |
| 10 | **Machine-readable proof**: events carry `LogRecord.txHash` (origin tx); `proof.js` joins it with the Reactive tx and `getCallbacks(reactiveTx)` (destination tx) and writes `PROOF.md` | `LogRecord`, system contract `getCallbacks`, `rnk_getFilters` |
| 11 | **Autonomous ops agent** (`ops.js`) watches balance / reserves / debt of the Reactive contract, vaults and requesters, tops up with `depositTo`, and attaches Reactive MCP `get_rc_health` reports | Reactive economy + Reactive MCP |
| 12 | **Request backoff + hourly cap**: a `(chain, pool)` pair is not asked twice while both of its rates sit still; per-chain rolling-hour budget | bounded off-chain work, no log-spam loops |
| 13 | **Standing orders**: choose `YIELD_ONLY` (principal untouched) or `YIELD_THEN_PRINCIPAL`; `Vault.PlanCreated` is enough for the RSC to schedule recurring payouts from CRON, round-robin, at most 5 per tick (~747k gas measured with 5 due plans) | event-driven scheduling, bounded CRON compute |
| 14 | **Ack + retry**: every plan payout and ACT rebalance is recorded in flight; `PlanExecuted`/`PlanSkipped` and `Rebalanced`/`RebalanceSkipped` clear it. No ack after `retryAfter` re-sends, max 3 attempts, then `ActionStuck` (never retries a stale verdict) | subscriptions to your own outputs |

### AI request backoff and the hourly cap

A rate event is a candidate request only if there is a spike or a gap. On top of that the RSC keeps a
**per-pair gate** and a **per-chain budget**:

- After a request for `(chainId, pool)`, the same pair is not requested again until the target rate **or** the
  pool it was measured against moves by at least `spikeBps` (150), or `requestBackoff` (default **600 s**) passes.
  An `IGNORE` verdict, a `VerdictSkipped`, or a vault `RebalanceSkipped` re-arms the gate, so an answer of "no"
  is respected even if the gap that caused it is still there.
- Each chain gets at most `maxRequestsPerHour` (default **12**) AI requests per rolling hour, independent of
  the number of pools or plans. A new hour resets the budget.
- Every dropped request emits `RequestSuppressed(chainId, pool, reason)` with `reason` = `"backoff"`,
  `"cooldown"` (the per-chain `requestCooldown`) or `"hourly cap"`. `requestGateOf(chainId, pool)` and
  `requestsThisHour(chainId)` expose the state; `setBackoff(seconds, perHour)` tunes it.

Tests: `test_repeatedIdenticalEventsProduceOneRequest`, `test_changedRateProducesANewRequest`,
`test_backoffExpiryProducesANewRequest`, `test_ignoreVerdictRestartsTheBackoff`,
`test_vaultSkipRestartsTheBackoff`, `test_hourlyCapStopsRequestsPerChain`, `test_capIsPerChain`.

### Standing orders

Choose **YIELD_ONLY** (principal untouched; a period with no yield is skipped and does not consume a payment) or
**YIELD_THEN_PRINCIPAL** (pays from yield first, then principal; an unfunded period counts as a payment).
`createPlan(payee, amount, period, count, mode)`; `period >= minPeriod` (default 120s); 1..365 payments.
`YIELD_ONLY` plans expire after `maxSkips` (default 12) consecutive empty periods. `costBasis` tracks each
depositor's principal pro-rata on deposits, withdrawals and share transfers, so `yieldAvailable(owner)` is real
yield. Payouts keep working while deposits are paused.

Honest limits: Reactive moves *messages*, not tokens. Funds never cross chains here. Rebalancing happens between
pools on one chain, and the omnichain layer is protection plus a yield signal.

## Trust model
Vault callbacks need (a) the Reactive callback proxy as `msg.sender` and (b) our Reactive contract as the injected
sender. For AI-driven moves the vault re-reads the verdict from the registry: right action, confidence >= 70%,
under 15 min old, never used, target matches, only whitelisted pools, max 50% of TVL per call, cooldown.
Reactive-only actions (pause, heal, exit) cannot send funds to a third party, and `unpauseByReactive` only lifts a
pause set for the same reason (it can never lift an AI or admin pause).

## Live deployment (Base Sepolia + Unichain Sepolia + Reactive Lasna)

| Contract | Base Sepolia (84532) | Unichain Sepolia (1301) |
|---|---|---|
| `RoninVault` | `0x1827b78aCEBb5085CFB7C6DCC474414983348Ec9` | `0x4384345dD2fCA2656A7E7105D74D313e0eF5A27B` |
| `DecisionRequester` | `0x2780a1a41e73859b06683D6da0d993Dae0b797f9` | `0xd62B60a3a9893B43f91CC5233B2B50b6E973732F` |
| `AIVerdictRegistry` | `0x0fe0591be4eb54DE1Be6Ec53EBFaC05F86B9758D` | `0xd25d9bE29D617305Dc1F39600604C00DA3D99eC9` |
| asset | Aave USDC `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` | `MockUSDC` `0xeFBcde7Af346A2aCd1429941F6F53B4Ed5c4AD1A` |
| pools | Aave adapter `0x4384345dD2fCA2656A7E7105D74D313e0eF5A27B` + stress `0xa8E0681Ca84A84CB971bcD8485d91e03DB96c740` | A `0x20a6168e96a793e66733aFedd542DD6583eB7A53`, B `0x75CFCe08ca24a68F51373f1643c5F273B6e0265f` |
| callback proxy | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` | `0x775c9B990ADe401060B78D0e98684eEf8d2466C1` |

Reactive Lasna (5318007): `RoninReactive` = `0x8f52a476Ff46D070a4450Fb7283Cb1De6A886813`
(`minGapBps=50`, `breakerUtilBps=9500`, `spikeBps=150`, `staleAfter=900`, `requestCooldown=15`,
`rescoreEveryTicks=5`, `retryAfter=360`, `maxVerdictAge=900`, `MAX_ATTEMPTS=3`, `MAX_PLANS_PER_TICK=5`,
`requestBackoff=600`, `maxRequestsPerHour=12`).

Every deploy/wiring/funding/demo transaction hash is in [`DEPLOYMENTS.md`](DEPLOYMENTS.md). Live state at the last
check (2026-11-20 20:15 UTC): RSC reserves **0** and debt **2.76e15 wei** (the contract is halted until the next
`depositTo`; see the budget table in `DEPLOYMENTS.md`), filters `{"1301":13,"84532":14}`, 11 `DecisionRequested`
on Base (ids 1-11) and none on Unichain. Pool `0x011121a7476Dcc6E342FAA64a0c03bd9A093d1f5` was added with
`vault.addPool` and became watched by the RSC on its own (`isWatched == true`, Base filters 13 → 14).

## Reproduce

### 1. Dependencies (the `lib/` folder)

`lib/` is not committed; install it with Foundry (this is the only setup step that needs network access):

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install Reactive-Network/reactive-lib-omni
```

`remappings.txt` wires them up:

```
@reactive/=lib/reactive-lib-omni/
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
```

`foundry.toml` pins `solc 0.8.29`, `evm_version = cancun` and `via_ir = true` (cancun because forge simulates
the Lasna system contract locally, which uses Cancun opcodes; via_ir because the callback encoders are wide).

### 2. Build and test

```bash
forge build
forge test -vv            # 87 tests, includes the max-plan cron tick gas check
cd ai-service && npm install && cd ..
```

### 3. Secrets

`DEPLOYER_PK AI_POSTER_PK AI_API_KEY AI_BASE_URL AI_MODEL BASE_SEPOLIA_RPC UNICHAIN_SEPOLIA_RPC LASNA_RPC`.
Fund the AI poster wallet with ~0.02 ETH on Base Sepolia (and Unichain Sepolia if you use it).

### 4. Deploy (order matters: the destination contracts need the Reactive contract's address)

```bash
# 1. Lasna: the Reactive contract
forge script script/1_DeployReactive.s.sol --rpc-url $LASNA_RPC --broadcast
export RSC=0x...

# 2. Base Sepolia: token, pools, requester, registry, vault
export CALLBACK_PROXY=0x476F44b11F5C942c58f4c8E3d0300E5710743585
forge script script/2_DeployChain.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
export BASE_USDC=0x... BASE_POOL_A=0x... BASE_POOL_B=0x... BASE_REQUESTER=0x... BASE_REGISTRY=0x... BASE_VAULT=0x...

# 3. (optional) Unichain Sepolia: same script, its own proxy
export CALLBACK_PROXY=0x775c9B990ADe401060B78D0e98684eEf8d2466C1
forge script script/2_DeployChain.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast
export UNICHAIN_USDC=0x... UNICHAIN_POOL_A=0x... UNICHAIN_POOL_B=0x... UNICHAIN_REQUESTER=0x... UNICHAIN_REGISTRY=0x... UNICHAIN_VAULT=0x...

# 4. Lasna: register each chain with the Reactive contract (once per chain)
CHAIN_ID=84532 VAULT=$BASE_VAULT REQUESTER=$BASE_REQUESTER REGISTRY=$BASE_REGISTRY POOL_A=$BASE_POOL_A POOL_B=$BASE_POOL_B \
  forge script script/3_WireReactive.s.sol --rpc-url $LASNA_RPC --broadcast
CHAIN_ID=1301  VAULT=$UNICHAIN_VAULT REQUESTER=$UNICHAIN_REQUESTER REGISTRY=$UNICHAIN_REGISTRY POOL_A=$UNICHAIN_POOL_A POOL_B=$UNICHAIN_POOL_B \
  forge script script/3_WireReactive.s.sol --rpc-url $LASNA_RPC --broadcast
```

On Lasna add `--legacy --gas-price 110000000000`: the node rejects a transaction whose gas cost is above 1 lREACT.

## Demo script (save every tx hash: origin, Reactive, destination)

Set `PAYEE` to a second wallet before running section E.

```bash
cd ai-service && npm start     # second terminal; it only reacts to DecisionRequested

# deposit 1000 USDC on Base
cast send $BASE_USDC "approve(address,uint256)" $BASE_VAULT 1000000000 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
cast send $BASE_VAULT "deposit(uint256,address)" 1000000000 $DEPLOYER --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK

# A. AI loop: make pool B clearly better. The RSC computes features -> wakes the AI -> verdict -> vault rebalances
cast send $BASE_POOL_B "setRate(uint256,uint256)" 900 3500 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
# watch RateObserved, DecisionRequestSent, VerdictSeen, RebalanceRequested, LoopClosed on lasna.reactscan.net
# send the same setRate again: it is suppressed with RequestSuppressed(..., "backoff") because nothing moved

# B. Omnichain breaker: utilisation spike on Base pool A -> Base emergencyExit -> Unichain vault paused
cast send $BASE_POOL_A "setRate(uint256,uint256)" 500 9700 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
cast send $BASE_POOL_A "setRate(uint256,uint256)" 500 4000 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK   # heal

# C. CRON watchdog: stop updating rates for 15 minutes -> vault paused (StaleDetected); any update heals it (StaleHealed)

# D. Dynamic subscription, no owner call to the RSC:
forge create src/mocks/MockLendingPool.sol:MockLendingPool --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK \
  --constructor-args $BASE_USDC 500 4000
export NEW_POOL=0x...
cast send $BASE_VAULT "addPool(address)" $NEW_POOL --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
# the vault emits PoolAdded, react() subscribes to the new pool, RSC emits PoolWatched; filter count grows

# E0. Prepay callback fees on the destination chains. Callbacks are billed to the recipient in the
#     destination chain's native token; with zero reserves the network accepts the request but never
#     delivers it (you only see ActionRetried, then ActionStuck).
cast send 0x476F44b11F5C942c58f4c8E3d0300E5710743585 "depositTo(address)" $BASE_VAULT \
  --value 0.002ether --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
cast send 0x775c9B990ADe401060B78D0e98684eEf8d2466C1 "depositTo(address)" $UNICHAIN_VAULT \
  --value 0.002ether --rpc-url $UNICHAIN_SEPOLIA_RPC --private-key $DEPLOYER_PK

# E. Standing orders. Mode: 0 = YIELD_ONLY, 1 = YIELD_THEN_PRINCIPAL.
cast send $BASE_VAULT "createPlan(address,uint128,uint32,uint16,uint8)" $PAYEE 1000000 120 3 0 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
cast send $BASE_VAULT "createPlan(address,uint128,uint32,uint16,uint8)" $PAYEE 1000000 120 3 1 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
# Then send nothing: on each CRON tick the RSC calls executePlan and the vault emits PlanExecuted.
# Watch PlanCreated / PlanExecuted / PlanSkipped on the vault, and ActionRetried / ActionStuck on Lasna.

# E2. Faster retry demo (3 CRON ticks is ~6 min by default; lower it for a recording):
cast send $RSC "setRetryParams(uint256,uint256)" 120 900 --rpc-url $LASNA_RPC --private-key $DEPLOYER_PK
# The retry path needs a callback that produces no ack. The forge suite covers it deterministically
# (`test_missingAckRetriesThenStuck`); on a live chain use a throwaway vault harness that reverts.
```

## Real Aave V3 mode (recommended: judges score usefulness)

Instead of two mock pools, the vault can hold the real Aave V3 USDC reserve on Base Sepolia. The Reactive contract
subscribes to the **Aave Pool's own `ReserveDataUpdated` event, filtered to that reserve (topic1)**, so it reacts to
live protocol activity, not to events we emit ourselves. One controllable mock "stress" pool stays beside it so the
demo is deterministic (Aave testnet rates rarely move on their own); label it as such in the video.

1. Aave V3 Pool on Base Sepolia (per Coinbase CDP docs, double-check against Aave's address book):
   `export AAVE_POOL=0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27`
2. Run step 2 once. With `AAVE_POOL` set and no `AAVE_ASSET`, the script **prints Aave's reserve list and stops**.
   Pick the USDC reserve and `export AAVE_ASSET=0x...`.
3. Get that test token from Aave's testnet faucet (testnet mode in the Aave app) and re-run step 2.
4. Sanity-check the adapter against the Aave UI: `cast call $AAVE_ADAPTER "rateBps()(uint256)"` should match the
   supply APY shown, and `utilizationBps()` the reserve utilisation.
5. Wire with `AAVE_ADAPTER`, `AAVE_POOL`, `AAVE_ASSET` set. Aave's event has rates but no utilisation, so the
   Reactive contract estimates utilisation as `liquidityRate / variableBorrowRate`, a lower bound, and the AI reads
   the exact figure from the adapter.

Profit gate: `cast send $VAULT "setMinAnnualGain(uint256)" 1000000` makes the vault skip any move that would earn
less than 1 USDC a year (emits `RebalanceSkipped`).

Admin knobs: `setMinPeriod(uint32)` (default 120s), `setMaxSkips(uint16)` (default 12) on the vault;
`setRetryParams(retryAfter, maxVerdictAge)` (360s, 900s), `setBackoff(seconds, perHour)` (600s, 12) and
`setParams(...)` on the RSC.

## Reactive's own tooling (use it, it saves hours)

**Reactive MCP**: a read-only diagnostics server for agents (`get_rc_health`, `trace_origin_event`,
`trace_reactive_tx`, `decode_callback`, `list_subscriptions`, `validate_subscription`, `estimate_cost`, plus the
prompts `diagnose_rc` and `review_rc_source`):

```bash
claude mcp add --transport http reactive-mcp https://mcp.rnk.dev/mcp
```
Then ask your agent: "run review_rc_source on src/RoninReactive.sol", "diagnose_rc <RSC address>",
"estimate_cost for the RSC". Do the review BEFORE the first Lasna deploy: a reverted `react()` is still billed.

**Keep the loop alive** (autonomous top-ups + a status endpoint for your UI at `http://localhost:8787/status`):
```bash
export LASNA_RPC=https://lasna-rpc.rnk.dev/ OPS_PK=$DEPLOYER_PK   # the ops wallet needs lREACT and ETH to top up
cd ai-service && npm run ops          # or: npm run ops:once
```

**Generate the submission evidence** after running the demo:
```bash
cd ai-service && BASE_VAULT=$BASE_VAULT UNICHAIN_VAULT=$UNICHAIN_VAULT npm run proof   # writes ai-service/PROOF.md
```
`proof.js` prints one row per **complete** loop (origin tx → Reactive tx → destination tx) and collapses refused
or ignored requests into a single count line. Standing-order payouts are complete loops too (`PlanCreated` →
`PlanScheduled` → `PlanExecuted`). Use `--from-block 8684076` to cover the whole deployment, and `--all` for an
appendix listing the reactions that never reached a destination.

Economy rules that shaped the design: execution stops while debt > 0; reverted `react()` and failed callbacks are
still charged; callbacks under 100,000 gas are ignored; a Reactive transaction is capped at 900,000 gas; Omni blocks
are about 1s with instant finality (no reorgs, so the latency numbers are real).

## Operating costs
- Callbacks are billed to the recipient (vault, requester) in the destination chain's ETH. Prepay reserves at the
  destination callback proxy with `cast send <proxy> "depositTo(address)" <addr> --value 0.01ether`; a recipient with
  no reserves still gets its callback requests accepted but **never delivered** (you only see `ActionRetried`, then
  `ActionStuck`). You can also top up the contract itself (`cast send <addr> --value 0.005ether`) and call
  `coverDebt()` if callbacks stop.
- The Reactive contract pays in lREACT. **CRON bills on every tick** (~2 min): a tick with 5 due plans is
  746,897 gas, about **0.08-0.1 lREACT at 110 gwei**, so a 0.5 lREACT refill buys roughly 5 ticks. Event reactions are
  cheaper but constant (the Aave adapter republishes rates every few minutes), so budget in lREACT and keep the
  reserve topped up while the demo runs. Turn CRON off when not demoing:
  `cast send $RSC "setCron(bool)" false --rpc-url $LASNA_RPC --private-key $DEPLOYER_PK`.
  Check its economy with
  `cast call 0x8888888888888888888888888888888888888888 "reserves(address)(uint256)" $RSC --rpc-url $LASNA_RPC` and
  `cast call 0x8888888888888888888888888888888888888888 "debt(address)(uint256)" $RSC --rpc-url $LASNA_RPC`;
  refill with `cast send 0x8888888888888888888888888888888888888888 "depositTo(address)" $RSC --value 0.5ether`.
- The Reactive contract is verified with `forge verify-contract --verifier sourcify --chain-id 5318007 <addr> RoninReactive`.
