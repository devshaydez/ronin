# Deployments

Live testnet deployment of Ronin, including standing orders (plans) and callback ack/retry.
Every transaction below has receipt status `1` unless noted.
Deployed **2026-11-19** with Foundry 1.9.0 (solc 0.8.29, `evm_version = cancun`, `via_ir = true`).

## CURRENT — 2026-11-20 redeploy (dynamic CRON, per-tick caps, backoff)

This is the live build; everything below it is the previous deployment, kept for reference.

| Contract | Chain | Address | Tx | Block |
|---|---|---|---|---|
| `RoninReactive` | Lasna | `0x1827b78acebb5085cfb7c6dcc474414983348ec9` | `0x2275df2724ac73e693484cf2d81dd14697680a716f679c3ccfb9f708e1575eb7` | 8842382 |
| `AaveV3Adapter` | Base | `0x5FcA572238C2d68bfAf208bA0C362a6091484E6e` | `0xb6204a59b7086e8a692af2df59bf05d8184525629b3c0fde8025d4d11c4d643f` | 61444881 |
| `MockLendingPool` (stress) | Base | `0x0Bd0E5FDa3e21a23D0ef9B3267d1541c2AbE58F6` | `0x725adfc1f34eaecf3c91f9922178b6b6aec4b1c6d1fb13af58b7cd9b53a88b2c` | 61444881 |
| `MockLendingPool` (Boost, added at runtime) | Base | `0x139a6D6A2aCFd5E35156fb71687c9eDA129Fb94F` | deployed with `forge create`, then `vault.addPool` `0x1b6f09a112072662a4af03d0cba1e3c17e09cd1999879d0cd4dc76718512112e` | 61445192 |
| `DecisionRequester` | Base | `0xCfc59C513752A10Cd024B4B655B829D7e7cCec80` | `0xaaa3eec3b6261a67c4907965849fa1fbdaaac73cebd647d9d65678bdead01400` | 61444881 |
| `AIVerdictRegistry` | Base | `0x6950F7B22bF1f7Ba720e6e92BE822407f16b4C8e` | `0x7a8fd3b9206372414060cf049cfcccc9ad438139e5c0102b76da8d620a7184e8` | 61444881 |
| `RoninVault` | Base | `0x60AA54822B790FdBe4985bb78c2Ce5D088d83627` | `0x79e663c42f6d14861a2868a503b5db7ff66b9c8e7aa6b0143411288667b47260` | 61444881 |
| `MockUSDC` | Unichain | `0xA16eB9a84985e245448000bBF8bB556dC563684d` | `0x45dfd2e315b04d6122da43661d01a7cde190a9dd59e3f1531dd0581aa3db7f89` | 68358429 |
| `MockLendingPool` A | Unichain | `0x54461F1C3622bc6e98216ED9A3a389be164a3D23` | `0xc0c9a69f46afc088890f273b8977d4d99a3edd514039a3889557d7de333ceb48` | 68358429 |
| `MockLendingPool` B | Unichain | `0xE098eaF9Bc39A44dfe14dC9B0ddcf37A146f7bF6` | `0x3370b40f3b036f388dc50ff149729c522510414352e47fac6a975aa74f9eabcd` | 68358429 |
| `DecisionRequester` | Unichain | `0x46E1dA14dfCA2795f3aFB4D0d378FA990F40aF1e` | `0x51f6de7ed1fb87d42ab2e5982a6597c73c4e093696f2f646a1b85cd213f5fe3d` | 68358429 |
| `AIVerdictRegistry` | Unichain | `0x69107baF143C38722744a09e3f27c3c076469d5f` | `0xbbca3843fedad05169a3868840f6cf5b146b99d7108bb5a47c3f14d95d7f80a9` | 68358429 |
| `RoninVault` | Unichain | `0x64E6FeC3bCdF9944B27d7419FB7d516bE24dA652` | `0x29ce481c5b28b466ac700d5fea57ac638119e1f29f1bc5ef6098a3fcb7ccc579` | 68358429 |

Wiring (Lasna): `configureChain(84532, …)` + `configureAave(…)` in `0x379f8164aab152885be421d4f58b7a4601ee4a2613183dae840762eb7e20646b`
and `configureChain(1301, …)` in `0xc69e258c7a7a5d77b228d10be3449c15c1b67bf8c97e01bb928edcb636cffa71` (both block 8842386/8842395).

Constructor: `minGapBps=50`, `breakerUtilBps=9500`, `spikeBps=150`, `staleAfter=900`, `requestCooldown=15`,
`rescoreEveryTicks=0` (deploy script default), funded with 0.5 lREACT, then topped up to 1.5 lREACT with
`depositTo` before the demo and 0.5 more during it. `MAX_PLANS_PER_TICK=3`, `MAX_RETRIES_PER_TICK=2`.

> The RSC address equals the *previous* Base vault address: both were the deployer's same-nonce CREATE on different
> chains. They are unrelated contracts and live on different networks.

### Demo window (2026-11-20, blocks 8842382–8845300)

| What | Evidence |
|---|---|
| Base vault funded | 1,000 USDC deposited (`0xd4b752b731d4…`), all allocated to the stress pool |
| AI loop (skipped) | verdict 1, `RebalanceSkipped` in Base tx `0xd7783e6d84aa…` (target already held the funds) |
| AI loop (moved) | verdict 2, `Rebalanced(2, 0x139a…b94F, 500 USDC, 500 USDC)` in `0xdcd85f31144ef70e54b27e3ddb0b120658b796665207710cfd9e20d39f221668`, `LoopClosed` on Lasna `0x3ed53a7c6500…` |
| Dynamic subscription | `addPool(0x139a…)` → `PoolAdded` → RSC `PoolWatched` (filters 27 → 28) with no owner tx to the RSC |
| 6 standing orders | plans #1–#3 `YIELD_ONLY`, #4–#6 `YIELD_THEN_PRINCIPAL`, 1 USDC every 120 s × 3; 18 payouts, `PlanScheduled` 6× and `CronEnabled`/`CronDisabled` around them |
| Three 20 USDC payouts | plans #7–#9 paid 20 USDC each, `PlanExecuted` txs `0xee7605ea…`, `0xfc70a744…`, `0xb7ef1e82…` |
| Missed ack → retry → stuck | verdict 3 callback never acked (`low confidence` at the vault, confidence 6000 < 7000): `ActionRetried` ×2 (`0xa92e5132…`, `0x4ee561f4…`) then `ActionStuck` (`0x0afe5dcdc7b8…`) |
| Second AI loop | after `setParams(5500, …)`, verdict 4 retried (`0x0d8a3aaa…`, `0xcb9e3c6f…`) then `Rebalanced` `0x5e8ce167bc4f…` + `LoopClosed` |
| Omnichain breaker | Base stress pool utilisation → 9700 bps: `BreakerTripped` `0x44e5c57584df…`, `ExitObserved`/`EmergencyExit` `0xe5eb89f83de7…`, `OmniPause(1301)` `0x30d7a3daa27f…`, Unichain vault `PausedByReactive` `0xae3afb1171c0…` |
| Self-heal | utilisation back to 4000 bps: `BreakerCleared` + `OmniHeal(1301)` `0x91ac9b97344a…`, Unichain `UnpausedByReactive` `0x6c0fe2c3da03…` |

`ai-service/PROOF.md` records 22 complete loops from this window (18 standing-order payouts, 4 AI verdict loops)
plus 4 `ActionRetried` and 1 `ActionStuck`.

### Reactive budget for the window

| Time | Reserves | Debt | Note |
|---|---|---|---|
| after deploy | 0.5 | 0 | constructor value; reserves need `depositTo` |
| +3 × 0.5 lREACT | 1.5 | 0 | before the demo |
| mid-demo | 1.945 → 1.55 | 0 | ~0.4 lREACT in ~4 min: cron ticks plus real Aave `ReserveDataUpdated` traffic (~1 event/3 s) |
| +2 × 0.5 lREACT | 1.98 | 0 | kept the demo alive |
| after the window | 0.273 → +0.5 → **0.678** | 0 | minimum-cost state set, one top-up left in place |

`get_rc_health` after the window: **HEALTHY**, debt 0, 28/28 subscriptions active, 0 reverts/hour.

### Minimum-cost state (left running)

`cronOn=false`, `needCron()=false`, `watchdog=false`, `rescoreEveryTicks=0`, `estimatedBurnPerHour()=0`,
no active plans, no in-flight actions. The RSC is still subscribed to the Aave `ReserveDataUpdated` feed, so it keeps
reacting to real protocol updates: measured with everything else idle, **0.0714 lREACT per 2 minutes (≈2.1 lREACT/h)**
at ~100 gwei, about 0.032 lREACT per reaction. That feed, not cron, is the remaining cost; the only way to stop it
without a code change is to let the reserve run out (which then accrues debt). A `disableFeed()`/`unsubscribeAave`
owner knob is the next thing to add.

### Open defect found in the demo

`yieldAvailable` does not fall as a `YIELD_ONLY` plan pays: `_withdraw` reduces `costBasis` in proportion to the
shares burned, which removes the same fraction of the unrealised gain, so the reported yield stays ~constant
(40 → 37 USDC after 25 USDC of payouts) while the pot shrinks. Consequence: a `YIELD_ONLY` plan keeps paying while
the vault silently erodes principal, and `YIELD_THEN_PRINCIPAL` never reports a principal component (all six
mode-1 payouts show `fromYield = amount`, `fromPrincipal = 0`). Fix: reduce cost basis by the principal component
only (`fromPrincipal`) instead of the proportional share, and add a test asserting that `yieldAvailable` drops by
the paid amount. Not changed here: it moves money semantics and needs its own redeploy.

## Networks

| Role | Network | Chain ID | RPC |
|---|---|---|---|
| Reactive (brain) | Reactive Lasna | 5318007 | `https://lasna-rpc.rnk.dev/` |
| Origin + destination | Base Sepolia | 84532 | `$BASE_SEPOLIA_RPC` |
| Origin + destination | Unichain Sepolia | 1301 | `$UNICHAIN_SEPOLIA_RPC` |

## Reactive contract (Lasna)

| Contract | Address | Tx | Block |
|---|---|---|---|
| `RoninReactive` | `0x8f52a476Ff46D070a4450Fb7283Cb1De6A886813` | `0x08679a6b70e3882dcfc046186129ac926fbc361333ff99c77a1d3e67929ac28f` | 8684076 |

Constructor parameters: `minGapBps=50`, `breakerUtilBps=9500`, `spikeBps=150`,
`staleAfter=900`, `requestCooldown=15`, `cronEvery=5`; funded with 3 lREACT at deploy.
`retryAfter=360s`, `maxVerdictAge=900s`, `MAX_ATTEMPTS=3`, `MAX_PLANS_PER_TICK=5`.

## Base Sepolia (84532)

Aave V3 mode: the vault holds the real Aave USDC reserve, with one mock stress pool for deterministic demos.

| Contract | Address | Tx | Block |
|---|---|---|---|
| `AaveV3Adapter` | `0x4384345dD2fCA2656A7E7105D74D313e0eF5A27B` | `0xff6a5bc5d44eadc0b2e26b2c67750089624444f767a195a6c49313573474f8b0` | 60586085 |
| `MockLendingPool` (stress, `POOL_B`) | `0xa8E0681Ca84A84CB971bcD8485d91e03DB96c740` | `0xef3847999fb6e882818137c667a59b2a73346d1e3e11a33204e76f6cc735c51a` | 60586085 |
| `DecisionRequester` | `0x2780a1a41e73859b06683D6da0d993Dae0b797f9` | `0xaa9b44b41354758cd5095147a8920aafd80b28a7a952fe920cbbbd4e8da37d67` | 60586085 |
| `AIVerdictRegistry` | `0x0fe0591be4eb54DE1Be6Ec53EBFaC05F86B9758D` | `0x7e1b80eb442f654cfdfb6f1d949ab03f0b13e57652f493a4488475a80bb4c0ca` | 60586085 |
| `RoninVault` | `0x1827b78aCEBb5085CFB7C6DCC474414983348Ec9` | `0x8fc9dea97a28528a1c3b81445b6c510da6c62dffc1a5c64cce12d60648608007` | 60586085 |
| `MockLendingPool` (stress D, added 2026-11-20) | `0x011121a7476Dcc6E342FAA64a0c03bd9A093d1f5` | `0x9c3da7dff750a2b9494022426833f7709467ec63453687ddee1782fb2d6164f0` | 61408207 |

External contracts:

| Contract | Address |
|---|---|
| Aave V3 Pool (Base Sepolia) | `0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27` |
| USDC reserve (asset) | `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` |
| Callback proxy (Base Sepolia) | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` |

## Unichain Sepolia (1301) — mock mode

`MockUSDC` plus two mock pools; deployed with callback proxy `0x775c9B990ADe401060B78D0e98684eEf8d2466C1`.

| Contract | Address | Tx | Block |
|---|---|---|---|
| `MockUSDC` | `0xeFBcde7Af346A2aCd1429941F6F53B4Ed5c4AD1A` | `0x5251469f52181a9b4ca131920bf75c79692fd7a5d461ecbdd4c0a552ae52f389` | 68186674 |
| `MockLendingPool` A | `0x20a6168e96a793e66733aFedd542DD6583eB7A53` | `0x95cdb09d355cfedb470a0d80955876a71a21bdb07ee33e18938eb7ab1bcbc17a` | 68186674 |
| `MockLendingPool` B | `0x75CFCe08ca24a68F51373f1643c5F273B6e0265f` | `0x5ea952204beb3d590038b6c9b3f3ca845081464562c2e3142a4aeeb92a266112` | 68186674 |
| `DecisionRequester` | `0xd62B60a3a9893B43f91CC5233B2B50b6E973732F` | `0xe59510580ac0bc7cf8b948dc82deb2ba7b8b6edbccd94cca6471eefac1a9084e` | 68186674 |
| `AIVerdictRegistry` | `0xd25d9bE29D617305Dc1F39600604C00DA3D99eC9` | `0x9a598d811b431d430fdc22f7d517a7114ac763ec98a2ed978c19a4e4f688b7c0` | 68186674 |
| `RoninVault` | `0x4384345dD2fCA2656A7E7105D74D313e0eF5A27B` | `0x8ef5f14c26d4a183481d0469d3ccd4fb740b518561fb28ee7bfe475743766667` | 68186674 |

## Wiring (Lasna)

| Call | Tx | Block |
|---|---|---|
| `configureChain(84532, vault, requester, registry, [stressPool])` | `0xb381ff8d98b08c2f5f3c7b922c7fa9442be3cb3796d9a27b8aa74caa864d38d7` | 8684153 |
| `configureAave(84532, aavePool, usdc, adapter)` | `0x6e552f32e7becd4161f9612c75f867e2d427ee7e7e578276747e49fea5d73cfd` | 8684153 |
| `configureChain(1301, vault, requester, registry, [poolA, poolB])` | `0x8a4ac0be0883e15c6bde42c3eeccd893c1834db5eb47a4428ee89e097f02893f` | 8684167 |

State after wiring: `chainCount=2`, `poolCount(84532)=2` (stress pool + Aave adapter),
`poolCount(1301)=2`; 27 subscriptions (14 per chain: CRON + 9 vault events + registry verdict +
requester request + 2 pool `RateUpdated`, plus the Aave `ReserveDataUpdated` filtered to the USDC
reserve on Base). Reactive MCP: `HEALTHY`, **27/27 active**, 0 debt, 0 reverts.

## Funding

| Purpose | Amount | Tx |
|---|---|---|
| RSC reserves at deploy | 3 lREACT | in `0x08679a6b…` |
| RSC Omni reserves (clears debt, ~92 reactions) | 1.5 lREACT | `0xa40ed6ca86834367e655c521953e99ca907bd310359fb1168468da89814c7dd8` |
| Base vault callback reserves at proxy | 0.002 ETH | `0xd2c6f99229b06be1ba12886579ff84fbeceed4afa84fa33303c746d8523421d8` |
| Unichain vault callback reserves at proxy | 0.002 ETH | `0xa524b41eb5ad34c52718c60fb78e2aa37612220d4988d6da559ddde43f775104` |

Callback fees are charged to the destination contract in the destination chain's native currency.
Prepaying reserves at the callback proxy (`depositTo(address)`) is what made deliveries land here;
with zero reserves the requests were accepted by the network but never delivered.

## Demo data (2026-11-19)

| Step | Chain | Tx |
|---|---|---|
| Mint + deposit 1,000 USDC | Base Sepolia | `0x63268a9a1d9448ea9ee18be10228a259c848f008bc22bcb57f2573db0cc5d554` |
| Mint + deposit 1,000 USDC | Unichain Sepolia | `0x133a46149009f4930da6ef5b987922a755de2b95324edae358033d0c29447ce4` |
| Accrue 5 USDC yield on Pool A (`accrue`) | Unichain Sepolia | `0x7a45684a45bc88d3b47a09618db63da039713547750134d82c3a6e54c4404b60` |
| `createPlan` id 5, YIELD_ONLY 1 USDC / 120s / 3 | Unichain Sepolia | `0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809` |
| `createPlan` id 6, YIELD_THEN_PRINCIPAL 2 USDC | Unichain Sepolia | `0xd2fa6e1dfb9039a60a73fbe041572f3f7228cf8fb3f4b80c431a21cce1141d21` |
| `createPlan` id 3, YIELD_ONLY 1 USDC | Base Sepolia | `0xbe07701e8b75bab31cbf738027eeaa85b6bd8045402250b9a3b60f9938cb13e3` |
| `createPlan` id 7, YIELD_ONLY 1 USDC | Unichain Sepolia | `0x74fb39c9210ac4378ca2aa71b17adcd4361989a8b722e0a55fd3eb56423ad9b0` |
| `createPlan` id 8, YIELD_THEN_PRINCIPAL 2 USDC | Unichain Sepolia | `0xf5f31ff9a64b024f9d00e8cbc49b7660f12b18f807aaa37518f8b7ae8d9e2cf7` |
| `createPlan` id 4, YIELD_ONLY 1 USDC | Base Sepolia | `0x9de2a582798e5920f8995633e53ca07772cd11756054e261b7655d723ebbe645` |
| CRON tick: executes Unichain plans | Lasna | `0xf90f9e41d46af8fa8a1738af789e2f84a713bf59bc3bdb50440f8683091b5518` (2 callbacks) |
| CRON tick: Base plan skip path | Lasna | `0x82b858172989bd04812399a6e367a3e358171bcc10decf4d0e4a42f9f8cf1469` (1 callback) |

Results after the CRON ticks:

| Plan | Mode | Outcome |
|---|---|---|
| Unichain 5 | YIELD_ONLY | 3/3 paid, `remaining=0`, RSC plan closed (`active=false`) |
| Unichain 6 | YIELD_THEN_PRINCIPAL | 3/3 paid, `remaining=0`, RSC plan closed |
| Unichain 7 | YIELD_ONLY | paid 2/3 so far, `remaining=1` |
| Unichain 8 | YIELD_THEN_PRINCIPAL | paid 2/3 so far, `remaining=1` |
| Base 3 | YIELD_ONLY | 3 periods skipped (`skips=3`), `remaining=3` — no yield on Base, principal untouched |
| Base 4 | YIELD_ONLY | 3 periods skipped, `remaining=3` |

Payee `0x33F693201E2fFEf0eD41f624Ec0502a0264a5368` received **15 USDC** on Unichain; the vault's
`totalAssets` moved from 1,005 to 990 USDC (1,000 principal + 5 yield − 15 paid out), and
`yieldAvailable` is 4.925 USDC.

The plans created before the destination proxies were funded were requested three times each
(`ActionRetried`), then marked `ActionStuck`; once the proxies had reserves the deliveries landed and
the `PlanExecuted` acks cleared the stuck flag and settled the plans. That is the retry/stuck path
working end to end.

## Reactive proxies used

Callback proxies are the `msg.sender` that destination contracts must trust. Checked against
<https://dev.reactive.network/origins-and-destinations> on 2026-11-19:

| Network | Chain ID | Callback proxy | Source |
|---|---|---|---|
| Base Sepolia | 84532 | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` | docs ✅ |
| Unichain Sepolia | 1301 | `0x775c9B990ADe401060B78D0e98684eEf8d2466C1` | docs ✅ |

Reactive-side system addresses used by the contract:

| Purpose | Address |
|---|---|
| Reactive system contract (Omni) | `0x8888888888888888888888888888888888888888` |
| Legacy system proxy | `0x0000000000000000000000000000000000fffFfF` |
| Cron100 event emitter (Lasna) | same system contract; `Cron100(uint256)` topic |

## Standing orders + ack/retry

Vault: `createPlan(payee, amount, period, count, mode)`, `cancelPlan(id)`, `executePlan(reactive_, id)`,
`plans(id)`, `planCount()`, `yieldAvailable(owner)`, `costBasis(owner)`, `setMinPeriod`, `setMaxSkips`.
Mode `0 = YIELD_ONLY`, `1 = YIELD_THEN_PRINCIPAL`.

RSC: `planCount()`, `planAt(i)`, `planInfo(chainId, id)`, `setRetryParams(retryAfter, maxVerdictAge)`.
`configureChain` subscribes to 6 more events (14 per chain instead of 8):

| Event | topic0 |
|---|---|
| `PlanCreated(uint256,address,address,uint128,uint32,uint64,uint16,uint8)` | `0x46e6829d23727a020a3f5bebd377fb20abd8af9811bc36638b0b8b9abc52b3ee` |
| `PlanExecuted(uint256,address,uint256,uint256,uint256,uint64,uint16)` | `0x0688fb1ba455142caf0e7daa5a3c730c6b99a781810bfbf4f6e043ba131d5d86` |
| `PlanSkipped(uint256,string)` | `0xdc1a465662400ff115a4bfde2d64a858ccb9ab0745c8be374e9c8693988ca76f` |
| `PlanCancelled(uint256)` | `0x09f4c2fd13cc57768b21af5847536074d3fab1d1dfe1e382d9259c516945ea6d` |
| `PlanExpired(uint256)` | `0x6df66e70340987de0626ea385e5a00454d17abef7a418c42e54c01a33cf3b3ed` |
| `RebalanceSkipped(uint256,uint256,uint256)` | `0xd06073484b9e22103737720d9821eefcaeac4131395f8c0402054a2c6ba3be4b` |

`MAX_PLANS_PER_TICK = 5`; a local cron tick with 5 due plans measures **746,897 gas**
(`test_gasCronTickWithMaxPlans`), under the 900k react cap.

## Verification shortcuts

```bash
export LASNA_RPC=https://lasna-rpc.rnk.dev/
RSC=0x8f52a476Ff46D070a4450Fb7283Cb1De6A886813
cast call $RSC "planCount()(uint256)" --rpc-url $LASNA_RPC              # 6 plans mirrored
cast call $RSC "planAt(uint256)(uint256,uint256,uint64,uint16,bool,uint8)" 3 --rpc-url $LASNA_RPC
cast call $RSC "ticks()(uint256)" --rpc-url $LASNA_RPC                 # CRON ticks processed
cast call 0x4384345dD2fCA2656A7E7105D74D313e0eF5A27B \
  "plans(uint256)(address,address,uint128,uint32,uint64,uint16,bool,uint8,uint16)" 7 \
  --rpc-url $UNICHAIN_SEPOLIA_RPC                                      # paid 2/3
```

## 2026-11-20: live demo run (budget, `PoolAdded` subscription, AI loop)

### Reactive budget (reserves / debt, in lREACT wei)

The RSC pays for every reaction from its reserve on the system contract. Measured that day:

| Time (UTC) | Reserves | Debt | What happened |
|---|---|---|---|
| ~19:14 | `0` | `4.7233e15` | found halted: CRON had spent the 3 lREACT deploy funding |
| ~19:20 | `0.4099e18` | `0` | topped up 0.5 lREACT, tx `0xd6268286a66ecd62ee6377be5c89a6cf261531b6b1dae3de59efb07360f09c7d` (block 8833200) |
| ~19:35 | `0` | `2.76e15` | drained again by CRON ticks |
| ~19:36 | `0.597e18` | `0` | topped up 0.6 lREACT, tx `0x8f9e34301ae6819ecb6404732e0da168056678d86014c2289c3176b0b996d35b` (block 8835355) |
| ~19:39 | — | — | CRON switched off: `setCron(false)`, tx `0x9922190826735aa7c0d5a0349775e61dee2b94741d77135046c453ab88ee4dbf` |
| ~19:52 | `0` | `6.825e15` | drained by event reactions (Aave rate updates arrive often) |
| ~19:55 | `0.0132e18` | `0` | topped up 0.02 lREACT, tx `0xcdbcf990b8b0dbae5617c26f478b80964009996667c9f0acec19ba27ba64b115` |
| ~20:05 | `0` | `2.76e15` | exhausted again |

Cost per unit of work, measured on this deployment:

- CRON tick with 5 due plans: **746,897 gas**; at 110 gwei that is **~0.08 lREACT per tick** (about 0.1 measured live), i.e. roughly 5 ticks per 0.5 lREACT.
- A single event reaction (one `RateObserved`) is much cheaper, but the Aave adapter emits rate updates every few minutes, so a long-running demo needs a budget sized in lREACT, not ETH.

Consequence: once the reserve is empty the system contract accrues **debt** and stops executing reactions. A `PoolAdded` event delivered in that state is dropped, not replayed — the pool stays unwatched until the owner calls `watchPool` again.

### `PoolAdded` → automatic subscription (no owner call to the RSC)

| Step | Evidence |
|---|---|
| Deploy stress pool C `0x54461F1C3622bc6e98216ED9A3a389be164a3D23`, `vault.addPool(C)` tx `0x3686a2bbec605268757daf7eb62b05f19694dc4a65879e4867f70dbae346f9b0` | `isWatched(84532, C) == false` — the RSC had no reserve at that moment, so the reaction never ran |
| Deploy stress pool D `0x011121a7476Dcc6E342FAA64a0c03bd9A093d1f5`, `vault.addPool(D)` tx `0xb838f991e2d1dfe5a3adb1c5cc608fb220f17fb1a9ed6af24e33bb6061ad1cfb` (block 61408249) | after funding: `isWatched(84532, D) == true` |
| `rnk_getFilters` before / after | Base Sepolia filters **13 → 14** (`{"1301":13,"84532":14}` after the CRON filter is removed); no transaction to the RSC from the owner |

### AI loop reached the destination hop but not the vault

- `DecisionRequested` on Base Sepolia: **11** since deploy (request ids 1–11); Unichain: **0**.
- The running AI service answered the request with `ACT target = 0xa8E0681Ca84A84CB971bcD8485d91e03DB96c740` (registry tx `0x72c93b1f97e7dbe8c82c76f26e6a17242f5c07eacb36a66d62dfc511f7ed7120`, `0xd4225b2a4a87d20b43269729bd1aee7f6fc0e98d4779f6924ce6f6a686e81a41`).
- RSC: `VerdictSeen` (verdict #1, `action=1 ACT`, 6s after the request) and `RebalanceRequested` (verdict #1, target `0xa8E0681Ca84A84CB971bcD8485d91e03DB96c740`, gap 895 bps) in the same Lasna tx `0x15d61588d7d07f9f1692e16c81b522a0c9f0b400b4099a92d491be38482ec9cb` (block 8835732), but **no destination tx**: the reserve hit zero before the callback was posted, so the vault never saw the rebalance. This is the same failure mode as the dropped `PoolAdded` above.
- `Rebalanced` / `RebalanceSkipped` / `PausedByVerdict` / `EmergencyExit` on both vaults: **0** events in the whole deployment.

The request backoff and hourly cap (`RequestGate`, `requestBackoff = 600`, `maxRequestsPerHour = 12`, `RequestSuppressed`) are implemented and tested in `src/RoninReactive.sol` but **not** in the deployed bytecode — the live RSC is the 2026-11-19 build. They take effect on the next authorized redeploy.
