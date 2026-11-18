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
                                             └─ updateOmniSignal ────────────────────▶ every vault
```

## What the Reactive contract does (the part judges should look at)

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

Honest limits: Reactive moves *messages*, not tokens. Funds never cross chains here. Rebalancing happens between pools
on one chain, and the omnichain layer is protection plus a yield signal.

## Trust model
Vault callbacks need (a) the Reactive callback proxy as `msg.sender` and (b) our Reactive contract as the injected
sender. For AI-driven moves the vault re-reads the verdict from the registry: right action, confidence >= 70%,
under 15 min old, never used, target matches, only whitelisted pools, max 50% of TVL per call, cooldown.
Reactive-only actions (pause, heal, exit) cannot send funds to a third party, and `unpauseByReactive` only lifts a pause
set for the same reason (it can never lift an AI or admin pause).

## Setup (Codespace)

```bash
forge install Reactive-Network/reactive-lib-omni OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-commit
forge build
forge test -vv
cd ai-service && npm install && cd ..
```

Secrets: `DEPLOYER_PK AI_POSTER_PK AI_API_KEY AI_BASE_URL AI_MODEL BASE_SEPOLIA_RPC UNICHAIN_SEPOLIA_RPC LASNA_RPC`
Fund the AI poster wallet with ~0.02 ETH on Base Sepolia (and Unichain Sepolia if you use it).

Callback proxies (current docs, re-check dev.reactive.network/origins-and-destinations):
- Base Sepolia `0x476F44b11F5C942c58f4c8E3d0300E5710743585`
- Unichain Sepolia `0x775c9B990ADe401060B78D0e98684eEf8d2466C1`

## Real Aave V3 mode (recommended for the submission: judges score Usefulness)

Instead of two mock pools, the vault can hold the real Aave V3 USDC reserve on Base Sepolia. The Reactive contract
subscribes to the **Aave Pool's own `ReserveDataUpdated` event, filtered to that reserve (topic1)**, so it reacts to
live protocol activity, not to events we emit ourselves. One controllable mock "stress" pool stays beside it so the demo
is deterministic (Aave testnet rates rarely move on their own); label it as such in the video.

1. Aave V3 Pool on Base Sepolia (per Coinbase CDP docs, double-check against Aave's address book):
   `export AAVE_POOL=0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27`
2. Run step 2 once. With `AAVE_POOL` set and no `AAVE_ASSET`, the script **prints Aave's reserve list and stops**.
   Pick the USDC reserve and `export AAVE_ASSET=0x...`.
3. Get that test token from Aave's testnet faucet (testnet mode in the Aave app) and re-run step 2.
4. Sanity-check the adapter against the Aave UI: `cast call $AAVE_ADAPTER "rateBps()(uint256)"` should match the
   supply APY shown, and `utilizationBps()` the reserve utilisation. If they are wrong or revert, the reserve struct layout
   differs on this Aave version; tell me the revert and I'll adjust the word offsets in `AaveV3Adapter._reserve()`.
5. Wire with `AAVE_ADAPTER`, `AAVE_POOL`, `AAVE_ASSET` set (see step 4 below). Aave's event has rates but no
   utilisation, so the Reactive contract estimates utilisation as `liquidityRate / variableBorrowRate`, a lower bound,
   and the AI reads the exact figure from the adapter.

Profit gate: `cast send $VAULT "setMinAnnualGain(uint256)" 1000000` makes the vault skip any move that would earn less
than 1 USDC a year (emits `RebalanceSkipped`).

## Deploy (order matters: the destination contracts need the Reactive contract's address)

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
If a Lasna script fails on gas estimation, add `--legacy` or `--gas-price`.

`foundry.toml` targets `cancun` because forge simulates the Lasna system contract locally: under `paris` that
simulation aborts with `EvmError: NotActivated` (the system contract uses Cancun opcodes). Lasna, Base Sepolia and
Unichain Sepolia all run Cancun, so the same setting is safe for every deploy target.

## Demo script (save every tx hash: origin, Reactive, destination)

```bash
cd ai-service && npm start     # second terminal; it only reacts to DecisionRequested

# deposit 1000 USDC on Base
cast send $BASE_USDC "approve(address,uint256)" $BASE_VAULT 1000000000 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
cast send $BASE_VAULT "deposit(uint256,address)" 1000000000 $DEPLOYER --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK

# A. AI loop: make Pool B clearly better. Reactive computes features -> wakes AI -> verdict -> vault rebalances
cast send $BASE_POOL_B "setRate(uint256,uint256)" 900 3500 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
# watch RSC events on lasna.reactscan.net: RateObserved, DecisionRequestSent, VerdictSeen, RebalanceRequested, LoopClosed

# B. Omnichain breaker: utilisation spike on Base pool A -> Base emergencyExit -> Unichain vault paused
cast send $BASE_POOL_A "setRate(uint256,uint256)" 500 9700 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
# heal: bring utilisation back down
cast send $BASE_POOL_A "setRate(uint256,uint256)" 500 4000 --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK

# C. CRON watchdog: stop updating rates for 15 minutes -> vault paused (StaleDetected); any update heals it (StaleHealed)

# D. Dynamic subscription: deploy a third MockLendingPool, then
cast send $BASE_VAULT "addPool(address)" $NEW_POOL --rpc-url $BASE_SEPOLIA_RPC --private-key $DEPLOYER_PK
# Reactive emits PoolWatched by itself, no owner call needed
```

## Reactive's own tooling (use it, it saves hours)

**Reactive MCP**: a read-only diagnostics server for agents (`get_rc_health`, `trace_origin_event`,
`trace_reactive_tx`, `decode_callback`, `list_subscriptions`, `validate_subscription`, `estimate_cost`, plus the
prompts `diagnose_rc` and `review_rc_source`). Add it to your Claude Code in the Codespace:

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

**Generate the submission evidence** after running the demo (origin tx, Reactive tx, destination tx, latency per reaction):
```bash
cd ai-service && npm run proof        # writes ai-service/PROOF.md
```

Economy rules that shaped the design: execution stops while debt > 0; reverted `react()` and failed callbacks are still
charged; callbacks under 100,000 gas are ignored; a Reactive transaction is capped at 900,000 gas; Omni blocks are
about 1s with instant finality (no reorgs, so the latency numbers are real).

## Operating costs
- Callbacks are billed to the recipient (vault, requester) in the destination chain's ETH. Top up with
  `cast send <addr> --value 0.005ether` and call `coverDebt()` if callbacks stop.
- The Reactive contract pays in lREACT. **CRON bills on every tick** (~2 min). Turn it off when not demoing:
  `cast send $RSC "setCron(bool)" false --rpc-url $LASNA_RPC --private-key $DEPLOYER_PK`
- The Reactive contract is verified with `forge verify-contract --verifier sourcify --chain-id 5318007 <addr> RoninReactive`.
