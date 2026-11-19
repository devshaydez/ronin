# Deployments

Live testnet deployment of Ronin, including standing orders (plans) and callback ack/retry.
Every transaction below has receipt status `1` unless noted.
Deployed **2026-11-19** with Foundry 1.9.0 (solc 0.8.29, `evm_version = cancun`, `via_ir = true`).

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
