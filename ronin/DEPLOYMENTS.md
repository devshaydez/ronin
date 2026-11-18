# Deployments

Live testnet deployment of Ronin. All transactions below have receipt status `1`.
Deployed **2026-11-18** with Foundry 1.9.0 (solc 0.8.29, `evm_version = cancun`, `via_ir = true`).

## Networks

| Role | Network | Chain ID | RPC |
|---|---|---|---|
| Reactive (brain) | Reactive Lasna | 5318007 | `https://lasna-rpc.rnk.dev/` |
| Origin + destination | Base Sepolia | 84532 | `$BASE_SEPOLIA_RPC` |
| Origin + destination | Unichain Sepolia | 1301 | `$UNICHAIN_SEPOLIA_RPC` |

## Reactive contract (Lasna)

| Contract | Address | Tx | Block |
|---|---|---|---|
| `RoninReactive` | `0x38661a70826bbf26c7e3d50e0952229d0b3ace13` | `0x12bc86b6bd14ffc01f83398b77f5eb6460e465db6afe05804821c9e1e5056e12` | 8590491 |

Constructor parameters: `minGapBps=50`, `breakerUtilBps=9500`, `spikeBps=150`,
`staleAfter=900`, `requestCooldown=15`, `cronEvery=5`; funded with 5 lREACT.

## Base Sepolia (84532)

Aave V3 mode: the vault holds the real Aave USDC reserve, with one mock stress pool for deterministic demos.

| Contract | Address | Tx | Block |
|---|---|---|---|
| `AaveV3Adapter` | `0x38661a70826Bbf26c7e3d50E0952229D0B3AcE13` | `0x865c69f935f039369b07d646cadf98ac1b5ac1c51471d480c88d746fa8f4e869` | 60090347 |
| `MockLendingPool` (stress, `POOL_B`) | `0xb56be38E6fdb9a4c8a791d90906901509393b819` | `0xea1ee0850100aad8b48296c84c6b1366df7573159e8431b669c11986792e064c` | 60090347 |
| `DecisionRequester` | `0x5171b5432F63Fc2f853E7fe20ACDB6b916487ABE` | `0x66776d8fd3c2f93034907104d7fe06991384f3245f5d6163bc52eec6492f0f81` | 60090347 |
| `AIVerdictRegistry` | `0x2951854273295De243A05aeB9E60BCC98F6df9E1` | `0x82322145a292b7a207abe3dcde543d696fb3ee647c8e26bc4ac752b3f467e04a` | 60090347 |
| `RoninVault` | `0x27e5251fb16e4E8446e4E6FA20F830EA145D18FC` | `0xad662c350a79cb5ab58a60e4323c5471ce5cb0723ced920fda66ff00fc4744a6` | 60090347 |

External contracts:

| Contract | Address |
|---|---|
| Aave V3 Pool (Base Sepolia) | `0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27` |
| USDC reserve (asset) | `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` |
| Callback proxy (Base Sepolia) | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` |

> The adapter and the Reactive contract share the same address because both were the deployer's
> nonce-0 CREATE on their respective chains. They are independent contracts on different networks.

### Extra Base Sepolia pool (realistic-yield demo)

Deployed after the first demo attempt to give the AI a plausible (not 150x) opportunity.

| Contract | Address | Tx | Block |
|---|---|---|---|
| `MockLendingPool` (YieldPool, 150 bps / 10% util) | `0x20a6168e96a793e66733aFedd542DD6583eB7A53` | `0x4782dc5fed635934930a965e61c62be798fb2c55f3ac9a6bb5d59f929ac3ad4c` | 60548438 |

`vault.addPool(YieldPool)` — `0x4955ffa6e769f6be68d0cf592bd68c3be5ca3627819ce513142aa3ed5ff5a9f3` (block 60548487).
`rsc.watchPool(84532, YieldPool)` — `0x9ff9679546579881b18846a094d39050841df689e03c3f208d8f578ca267a8da` (Lasna).

## Unichain Sepolia (1301) — mock mode

`MockUSDC` plus two mock pools; deployed with callback proxy `0x775c9B990ADe401060B78D0e98684eEf8d2466C1`.

| Contract | Address | Tx | Block |
|---|---|---|---|
| `MockUSDC` | `0x38661a70826bbf26c7e3d50e0952229d0b3ace13` | `0x87d4ad3f5ef94d161513e82d4e1871d8edd36297005149e69b42607bb66950b1` | 68177453 |
| `MockLendingPool` A | `0xb56be38E6fdb9a4c8a791d90906901509393b819` | `0x68432b109e8477f34de9263c9bfba82be2a743b0863d78564b1b1865078b90c2` | 68177453 |
| `MockLendingPool` B | `0x5171b5432F63Fc2f853E7fe20ACDB6b916487ABE` | `0xd2680752a69ff3872a8261e6b2a1ef6ed541c6fcf44380b0b302e3977d41c3c5` | 68177453 |
| `DecisionRequester` | `0x27e5251fb16e4e8446e4e6fa20f830ea145d18fc` | `0x1f9450fac6852601aea2ec5a3775e8e5896b09c239b6d8dfaf3d1b3cd1818116` | 68177453 |
| `AIVerdictRegistry` | `0x3b9dd4661a81ad6ed169cb09c0d7669a644cd92d` | `0xbf7d631cbdba2298b5806aa7dfb9d81d93022564c5795e2359525c6f9b95a04a` | 68177453 |
| `RoninVault` | `0x071c632a690410fe2059484d6b1117df1ad6d2ca` | `0x90cd73cb299ed5922ece49452e283d32ff14fd200f6138d5c70b72c56342ad6c` | 68177453 |

Wiring: `configureChain(1301, ...)` — Lasna tx `0x07cd21e459175af49c36345ac60d7e1b6470ad83bbc1fbe2c89ccd523f300b78` (block 8675442).

## Wiring (Lasna, chain 84532)

| Call | Tx | Block |
|---|---|---|
| `configureChain(84532, vault, requester, registry, [stressPool])` | `0x3571cc99d97338d9e66d26f2d6d58ab562c82ceb78b52c22bfaf8a2ece7e8d6a` | 8590650 |
| `configureAave(84532, aavePool, usdc, adapter)` | `0x7419c8e6999d2e896c85a9889f3f552d9254f12c45028eb7c4d4a70167ea35cc` | 8590650 |

State after wiring: `poolCount(84532) = 2` (stress pool + adapter), then 3 after `watchPool` added YieldPool; 8 active subscriptions
(1 CRON + 3 vault events + registry verdict + requester request + stress `RateUpdated` +
Aave `ReserveDataUpdated` filtered to the USDC reserve). Reactive MCP: `HEALTHY`, 8/8 active,
0 debt, 0 reverts.

## Reactive proxies used

Callback proxies are the `msg.sender` that destination contracts must trust. Checked against
<https://dev.reactive.network/origins-and-destinations> on 2026-11-18:

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

## End-to-end demo transactions (2026-11-18)

| Step | Chain | Tx |
|---|---|---|
| Deposit 1,000 USDC (approve / deposit) | Base Sepolia | `0x69f508678e3ff19df352ab63cd84a5895cb606db25b3d70a8a6fdc3e8e229dde` / `0x4d2b6a213acfcc08fa5e0a919c89073095b351f97d8e666b3decb4974704d46b` |
| Stress pool 1 bps (send idle to Aave) | Base Sepolia | `0x7162b76e71b868122e1bb3261e84e72d203388245d5decc85af7e8404cd001f5` |
| Stress spike to 900 bps (AI refused, safety) | Base Sepolia | `0x1df987428b5354a04d3cd3a0ef3841e9de8a3037c6a47b9c6f1c4bed2c2064ca` |
| Realistic 150 bps rate on YieldPool (AI ACT) | Base Sepolia | `0xa09bd257f3bc36fc9e8c03ded9d9d3639390408da40e29296f5b4aa95a6cffbd` |
| Reactive reaction (RateObserved + DecisionRequestSent + OmniSignal) | Lasna | `0xbbb6e2e7e614fda51f13129c04a8b089e8a63afa545f7e529a6d30e3e77ae722` |
| AI verdict `ACT` 80% (`VerdictPosted`) | Base Sepolia | `0x02e95676e3801fd59367c0acaa02d39fe359de8c0e0d7f8ea291c5bb7503de68` |
| Reactive reaction (rebalance callback) | Lasna | `0x62654a81bdf5c161d584cd505fdf5ce3d354f26613ce05e45c0198df9b4c387c` |
| Vault `Rebalanced` (500 USDC to YieldPool) | Base Sepolia | `0x176f235ceafeded9f192a7b8a0a60a030d1c639127b7034f85ca21ea37a16e13` |
| `LoopClosed` (7s request→rebalance) | Lasna | `0x9c61ae16681e7a67b7ebcb12d01bccb7c9fb9a4fe7d68ac00302c8d241d3d92b` |
| Breaker origin: util 97% | Unichain Sepolia | `0x8f5607cbc65ce939654a6873b3c8d8ca5965de9dc91510ab96ec2225dfb282e7` |
| Reactive reaction (emergencyExit) | Lasna | `0xa4dc94903c4d439bbd1993ec28f4cade1053af782072c98d47bef062a3872431` |
| `EmergencyExit` (0 assets) | Unichain Sepolia | `0xd39619dad05eb9290c06ae535a1ae14928fbee78966815508572c7c1fb93059d` |
| `PausedByReactive` (omnichain pause) | Base Sepolia | `0x847545677ae92636098f2dff513c8c4a885ca293b1cd5bfafead4c3116b4b8a0` |
| Heal: util 40% | Unichain Sepolia | `0x7d27bb7505003b4aa559d45c2f107646cf6287dc3a5edbdf84079e15479b2ca5` |
| `UnpausedByReactive` (self-heal) | Base Sepolia | `0xf4c51c42748708e4c1f6b7e15859e6caa73c7a34e13bb6311e3f61e4d8e7ca57` |
| Watchdog: `staleAfter=60` | Lasna | `0x960440e78821409d834a4ec2db69c6c8e35b5f59d57821b26bc2c923edeef4ba` |
| Watchdog heal: rate update | Unichain Sepolia | `0xf081ed618ad21a24e897e095551ec91f5063d11dc391b4a63a4bdcf7b840da74` |
| Watchdog: restore `staleAfter=900` | Lasna | `0x4a1443d645dfb54e90f423c90cb97c5887257841b4956438c4d73e7b98d21a07` |

## Verification shortcuts

```bash
export LASNA_RPC=https://lasna-rpc.rnk.dev/
RSC=0x38661a70826bbf26c7e3d50e0952229d0b3ace13
cast call $RSC "poolCount(uint256)(uint256)" 84532 --rpc-url $LASNA_RPC   # 2
cast call $RSC "isWatched(uint256,address)(bool)" 84532 \
  0x38661a70826Bbf26c7e3d50E0952229D0B3AcE13 --rpc-url $LASNA_RPC       # true
cast call 0x38661a70826Bbf26c7e3d50E0952229D0B3AcE13 "rateBps()(uint256)" \
  --rpc-url $BASE_SEPOLIA_RPC                                            # Aave supply APR in bps
```
