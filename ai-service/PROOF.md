# Ronin: on-chain proof of the workflow

Generated 2026-11-20T20:43:37.506Z from Lasna blocks 8684076..8839181.
Reactive contract (RSC): `0x8f52a476Ff46D070a4450Fb7283Cb1De6A886813` on Reactive Lasna (5318007).

Each row is one **complete loop**: the **origin** transaction that emitted the event, the **Reactive** transaction on Lasna that handled it, and the **destination** transaction the callback produced, with the end-to-end latency. Lasna does not post callback results back (`getCallbacks` is empty on this network), so the destination tx is the vault transaction that answered the callback, matched by verdict id. A standing-order payout counts as a loop too: the origin tx is the vault's `PlanCreated`, the Reactive tx is `PlanScheduled`, and the destination is the vault's `PlanExecuted`.

| Reaction | Origin tx | Reactive tx (Lasna) | Destination tx | Origin→Reactive | Origin→Destination |
|---|---|---|---|---|---|
| PlanCreated → PlanExecuted | [0x3795dccb…a3e809](https://sepolia.uniscan.xyz/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) | `0x73297b41e5753de9ec741b5042254b7e846420aa8375767fdea8576881157023` | [0xf36d0aa5…635c59](https://sepolia.uniscan.xyz/tx/0xf36d0aa560fa9ce887235b9a1dc838a5a2659c3b751c19d145db779103635c59) (PlanExecuted) | 0s | 2972s |
| PlanCreated → PlanExecuted | [0xd2fa6e1d…141d21](https://sepolia.uniscan.xyz/tx/0xd2fa6e1dfb9039a60a73fbe041572f3f7228cf8fb3f4b80c431a21cce1141d21) | `0x03250269e7b5f66c5d34e6299879b430e1f70cddf9afe0d59883b343779a6878` | [0x47a684db…0f309e](https://sepolia.uniscan.xyz/tx/0x47a684db7f79ccaa89dfe357a347312118897cdfcc65bd139274d052420f309e) (PlanExecuted) | 0s | 2968s |
| PlanCreated → PlanExecuted | [0x3795dccb…a3e809](https://sepolia.uniscan.xyz/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) | `0x73297b41e5753de9ec741b5042254b7e846420aa8375767fdea8576881157023` | [0x51c5fad8…343413](https://sepolia.uniscan.xyz/tx/0x51c5fad8235d388dc3a3c4cece002247592cfe5a2bf8eac514f09e6a13343413) (PlanExecuted) | 0s | 3006s |
| PlanCreated → PlanExecuted | [0xd2fa6e1d…141d21](https://sepolia.uniscan.xyz/tx/0xd2fa6e1dfb9039a60a73fbe041572f3f7228cf8fb3f4b80c431a21cce1141d21) | `0x03250269e7b5f66c5d34e6299879b430e1f70cddf9afe0d59883b343779a6878` | [0x9d48bb9f…c49314](https://sepolia.uniscan.xyz/tx/0x9d48bb9f7d099572b51163edb9cec1c11c5b6c6d97b10e1605859ae371c49314) (PlanExecuted) | 0s | 3002s |
| PlanCreated → PlanExecuted | [0x3795dccb…a3e809](https://sepolia.uniscan.xyz/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) | `0x73297b41e5753de9ec741b5042254b7e846420aa8375767fdea8576881157023` | [0xa4343e62…8454e3](https://sepolia.uniscan.xyz/tx/0xa4343e6237efa99e78b4586b4e119995da19d20cf79da9c1a04d500d228454e3) (PlanExecuted) | 0s | 3029s |
| PlanCreated → PlanExecuted | [0xd2fa6e1d…141d21](https://sepolia.uniscan.xyz/tx/0xd2fa6e1dfb9039a60a73fbe041572f3f7228cf8fb3f4b80c431a21cce1141d21) | `0x03250269e7b5f66c5d34e6299879b430e1f70cddf9afe0d59883b343779a6878` | [0xa79f0e1c…be9546](https://sepolia.uniscan.xyz/tx/0xa79f0e1c19284ff3f8639d8e1bbbf01b03d1f7a1770c6ad85460288d93be9546) (PlanExecuted) | 0s | 3025s |
| PlanCreated → PlanExecuted | [0x74fb39c9…3ad9b0](https://sepolia.uniscan.xyz/tx/0x74fb39c9210ac4378ca2aa71b17adcd4361989a8b722e0a55fd3eb56423ad9b0) | `0xd69c37db7c3c20637bb5e49c7caccbc0cc41af576b85a824a1ebff2cedb292c6` | [0xd2c7ba80…a4ffb4](https://sepolia.uniscan.xyz/tx/0xd2c7ba8009ce9b3455777251cb6372bc21574b754c43d702ac47537c51a4ffb4) (PlanExecuted) | 0s | 294s |
| PlanCreated → PlanExecuted | [0xf5f31ff9…9e2cf7](https://sepolia.uniscan.xyz/tx/0xf5f31ff9a64b024f9d00e8cbc49b7660f12b18f807aaa37518f8b7ae8d9e2cf7) | `0xb955532658cc0f64ea68eb5e32cdbab81b2089c39308ad8da21248c46fa49784` | [0x6753e2ed…e595fd](https://sepolia.uniscan.xyz/tx/0x6753e2ed990542ce4b4f32a0588c86f6680ab8da18ff0921c9c194d2a6e595fd) (PlanExecuted) | 0s | 398s |
| PlanCreated → PlanExecuted | [0x74fb39c9…3ad9b0](https://sepolia.uniscan.xyz/tx/0x74fb39c9210ac4378ca2aa71b17adcd4361989a8b722e0a55fd3eb56423ad9b0) | `0xd69c37db7c3c20637bb5e49c7caccbc0cc41af576b85a824a1ebff2cedb292c6` | [0x779307b7…677950](https://sepolia.uniscan.xyz/tx/0x779307b72f0113e2752105a99cc08a3ad35ee82f12fa96c8878bda190a677950) (PlanExecuted) | 0s | 511s |
| PlanCreated → PlanExecuted | [0xf5f31ff9…9e2cf7](https://sepolia.uniscan.xyz/tx/0xf5f31ff9a64b024f9d00e8cbc49b7660f12b18f807aaa37518f8b7ae8d9e2cf7) | `0xb955532658cc0f64ea68eb5e32cdbab81b2089c39308ad8da21248c46fa49784` | [0xd9922754…d1e5bb](https://sepolia.uniscan.xyz/tx/0xd992275489137b8dab85df5f97fa423a74766407ac1a2dc6eaf75975dbd1e5bb) (PlanExecuted) | 0s | 507s |
| PlanCreated → PlanExecuted | [0x74fb39c9…3ad9b0](https://sepolia.uniscan.xyz/tx/0x74fb39c9210ac4378ca2aa71b17adcd4361989a8b722e0a55fd3eb56423ad9b0) | `0xd69c37db7c3c20637bb5e49c7caccbc0cc41af576b85a824a1ebff2cedb292c6` | [0x82df5e2a…3270b0](https://sepolia.uniscan.xyz/tx/0x82df5e2af040b51a207f5d2f41a5481d80fc935e74935e37cd080cbf6e3270b0) (PlanExecuted) | 0s | 80560s |
| PlanCreated → PlanExecuted | [0xf5f31ff9…9e2cf7](https://sepolia.uniscan.xyz/tx/0xf5f31ff9a64b024f9d00e8cbc49b7660f12b18f807aaa37518f8b7ae8d9e2cf7) | `0xb955532658cc0f64ea68eb5e32cdbab81b2089c39308ad8da21248c46fa49784` | [0xe455c990…0f8186](https://sepolia.uniscan.xyz/tx/0xe455c990bf0216aaa6c77268e7a265bc7e54e9bd0345c2e7dc1c7e7b660f8186) (PlanExecuted) | 0s | 80557s |

**12** complete loops, of which **12** are standing-order payouts and **0** are AI verdict loops.

Refused or ignored: **0** (one line, not one row each: AI `IGNORE` or a verdict the RSC skipped, so there is no destination tx). The AI path in this window: **11** `DecisionRequestSent`, **1** `VerdictSeen`, **1** `RebalanceRequested`, **0** verdict destination txs; **0** `RequestSuppressed` (backoff / cooldown / hourly cap; the deployed build predates them).

Ack/retry in this window: **6** `ActionRetried`, **3** `ActionStuck`.

## Standing orders (`Plan*` events on the origin vaults)
Every payout above appears in the main table as a complete loop (`PlanCreated` → `PlanScheduled` → `PlanExecuted`). This table is the raw event stream behind those loops.

| Chain | Event | Plan | Detail | Destination tx |
|---|---|---|---|---|
| Base Sepolia | PlanCreated | #1 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x2391fa53…1f4ee0](https://sepolia.basescan.org/tx/0x2391fa53cf7cc51c926d3423a1deb9e3f1eb8402d2b4ad3d129863cd851f4ee0) |
| Base Sepolia | PlanCreated | #2 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x3f311b38…7993b8](https://sepolia.basescan.org/tx/0x3f311b3881e817bf25f61d108de2f54efd70a478058bd2c8a514be1d317993b8) |
| Base Sepolia | PlanCreated | #3 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0xbe07701e…cb13e3](https://sepolia.basescan.org/tx/0xbe07701e8b75bab31cbf738027eeaa85b6bd8045402250b9a3b60f9938cb13e3) |
| Base Sepolia | PlanCreated | #4 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x9de2a582…bbe645](https://sepolia.basescan.org/tx/0x9de2a582798e5920f8995633e53ca07772cd11756054e261b7655d723ebbe645) |
| Base Sepolia | PlanSkipped | #3 | no yield yet | [0x800da359…bb24ca](https://sepolia.basescan.org/tx/0x800da359fbdb0641967d3cb78434a238e36f21ecb76ec00041fd7eaf21bb24ca) |
| Base Sepolia | PlanSkipped | #3 | no yield yet | [0x89acccb4…4cc568](https://sepolia.basescan.org/tx/0x89acccb460da6317912d760969df925532a8253bd3329fefd7e77f4cb44cc568) |
| Base Sepolia | PlanSkipped | #3 | no yield yet | [0x79f5f92c…1d86f3](https://sepolia.basescan.org/tx/0x79f5f92c18fe30fc6c7d4eb4c0eb25487d1765cb53ad4ed339bccdde141d86f3) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0xdac811e8…5069d5](https://sepolia.basescan.org/tx/0xdac811e808f990c02994de9a0d32a07faef8ab64974781b2ae3856c63d5069d5) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x162aa2d0…8cf624](https://sepolia.basescan.org/tx/0x162aa2d0d49213f986994f1532f926d60f8e714a7df6666ec2826cf2528cf624) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x3faffd90…bec251](https://sepolia.basescan.org/tx/0x3faffd903d5836d2b2863c2bc348c895632e3a96250589cdb17b1eed2fbec251) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0xac2fe2ae…48bf78](https://sepolia.basescan.org/tx/0xac2fe2ae795bfbf1d70581681490efb0829d78e6d79f5c87cf3f0cfe8f48bf78) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0xe88b274b…3d8f71](https://sepolia.basescan.org/tx/0xe88b274b9094b6788d207a1af4aec8736c6d0931eb24c3eb95c98352bd3d8f71) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x1b64be20…74e402](https://sepolia.basescan.org/tx/0x1b64be208a47e2d5c4531fd42188d7804d8a1c2ed166e824cfc509964874e402) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x551293ff…dbaf7b](https://sepolia.basescan.org/tx/0x551293ff49735354becff6779f27a129634137e4b14a5b3dccdc427a37dbaf7b) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x8e72ad13…a3e99a](https://sepolia.basescan.org/tx/0x8e72ad139fd2ef8c1565d33151802a34343d52b15ed27a7366c84cd27ca3e99a) |
| Unichain Sepolia | PlanCreated | #1 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x0486eaaf…4119e2](https://sepolia.uniscan.xyz/tx/0x0486eaaf9e65628a8f0e5a8f74171bae559969b9df3389d643a8de10f94119e2) |
| Unichain Sepolia | PlanCreated | #2 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_THEN_PRINCIPAL, 3 left | [0xd494ea58…54b491](https://sepolia.uniscan.xyz/tx/0xd494ea58135487d864c28d8f6a50dab33b464505bead0538b1314e94d354b491) |
| Unichain Sepolia | PlanCreated | #3 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x3a38c03f…c6fa44](https://sepolia.uniscan.xyz/tx/0x3a38c03fed2a092d83812fb294f6005cb7da6d64efa3ffa45a7eb84609c6fa44) |
| Unichain Sepolia | PlanCreated | #4 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_THEN_PRINCIPAL, 3 left | [0xba4a2dbf…e03fbd](https://sepolia.uniscan.xyz/tx/0xba4a2dbfc6b41aa9a1b538c6cfc3be50469304cd37d934c4e0d233c8d7e03fbd) |
| Unichain Sepolia | PlanCreated | #5 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x3795dccb…a3e809](https://sepolia.uniscan.xyz/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) |
| Unichain Sepolia | PlanCreated | #6 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 2 USDC / 120s, YIELD_THEN_PRINCIPAL, 3 left | [0xd2fa6e1d…141d21](https://sepolia.uniscan.xyz/tx/0xd2fa6e1dfb9039a60a73fbe041572f3f7228cf8fb3f4b80c431a21cce1141d21) |
| Unichain Sepolia | PlanCreated | #7 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x74fb39c9…3ad9b0](https://sepolia.uniscan.xyz/tx/0x74fb39c9210ac4378ca2aa71b17adcd4361989a8b722e0a55fd3eb56423ad9b0) |
| Unichain Sepolia | PlanCreated | #8 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 2 USDC / 120s, YIELD_THEN_PRINCIPAL, 3 left | [0xf5f31ff9…9e2cf7](https://sepolia.uniscan.xyz/tx/0xf5f31ff9a64b024f9d00e8cbc49b7660f12b18f807aaa37518f8b7ae8d9e2cf7) |
| Unichain Sepolia | PlanExecuted | #5 | 1 USDC (yield 1 / principal 0), 2 left | [0xf36d0aa5…635c59](https://sepolia.uniscan.xyz/tx/0xf36d0aa560fa9ce887235b9a1dc838a5a2659c3b751c19d145db779103635c59) |
| Unichain Sepolia | PlanExecuted | #6 | 2 USDC (yield 2 / principal 0), 2 left | [0x47a684db…0f309e](https://sepolia.uniscan.xyz/tx/0x47a684db7f79ccaa89dfe357a347312118897cdfcc65bd139274d052420f309e) |
| Unichain Sepolia | PlanExecuted | #5 | 1 USDC (yield 1 / principal 0), 1 left | [0x51c5fad8…343413](https://sepolia.uniscan.xyz/tx/0x51c5fad8235d388dc3a3c4cece002247592cfe5a2bf8eac514f09e6a13343413) |
| Unichain Sepolia | PlanExecuted | #6 | 2 USDC (yield 2 / principal 0), 1 left | [0x9d48bb9f…c49314](https://sepolia.uniscan.xyz/tx/0x9d48bb9f7d099572b51163edb9cec1c11c5b6c6d97b10e1605859ae371c49314) |
| Unichain Sepolia | PlanExecuted | #5 | 1 USDC (yield 1 / principal 0), 0 left | [0xa4343e62…8454e3](https://sepolia.uniscan.xyz/tx/0xa4343e6237efa99e78b4586b4e119995da19d20cf79da9c1a04d500d228454e3) |
| Unichain Sepolia | PlanExecuted | #6 | 2 USDC (yield 2 / principal 0), 0 left | [0xa79f0e1c…be9546](https://sepolia.uniscan.xyz/tx/0xa79f0e1c19284ff3f8639d8e1bbbf01b03d1f7a1770c6ad85460288d93be9546) |
| Unichain Sepolia | PlanExecuted | #7 | 1 USDC (yield 1 / principal 0), 2 left | [0xd2c7ba80…a4ffb4](https://sepolia.uniscan.xyz/tx/0xd2c7ba8009ce9b3455777251cb6372bc21574b754c43d702ac47537c51a4ffb4) |
| Unichain Sepolia | PlanExecuted | #8 | 2 USDC (yield 2 / principal 0), 2 left | [0x6753e2ed…e595fd](https://sepolia.uniscan.xyz/tx/0x6753e2ed990542ce4b4f32a0588c86f6680ab8da18ff0921c9c194d2a6e595fd) |
| Unichain Sepolia | PlanExecuted | #7 | 1 USDC (yield 1 / principal 0), 1 left | [0x779307b7…677950](https://sepolia.uniscan.xyz/tx/0x779307b72f0113e2752105a99cc08a3ad35ee82f12fa96c8878bda190a677950) |
| Unichain Sepolia | PlanExecuted | #8 | 2 USDC (yield 2 / principal 0), 1 left | [0xd9922754…d1e5bb](https://sepolia.uniscan.xyz/tx/0xd992275489137b8dab85df5f97fa423a74766407ac1a2dc6eaf75975dbd1e5bb) |
| Unichain Sepolia | PlanExecuted | #7 | 1 USDC (yield 1 / principal 0), 0 left | [0x82df5e2a…3270b0](https://sepolia.uniscan.xyz/tx/0x82df5e2af040b51a207f5d2f41a5481d80fc935e74935e37cd080cbf6e3270b0) |
| Unichain Sepolia | PlanExecuted | #8 | 2 USDC (yield 2 / principal 0), 0 left | [0xe455c990…0f8186](https://sepolia.uniscan.xyz/tx/0xe455c990bf0216aaa6c77268e7a265bc7e54e9bd0345c2e7dc1c7e7b660f8186) |

## Live subscriptions (Reactive RPC `rnk_getFilters`)
Filters version 9255; 27 active filters belong to the RSC: {"1301":13,"84532":14}. Re-run after calling `addPool` on a vault to show the count grow with no owner call.

Timestamps have 1-second granularity (Reactive Omni blocks are about 1s with instant finality), so latencies are accurate to ±1s.
