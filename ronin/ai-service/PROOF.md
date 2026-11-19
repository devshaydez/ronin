# Ronin: on-chain proof of the workflow

Generated 2026-11-19T21:03:54.911Z from Lasna blocks 8747008..8759008.
Reactive contract (RSC): `0x8f52a476Ff46D070a4450Fb7283Cb1De6A886813` on Reactive Lasna (5318007).

Every row is one reaction: the **origin** transaction that emitted the event, the **Reactive** transaction on Lasna that handled it, and the **destination** transaction(s) the callback produced (read from the system contract's `getCallbacks`).

| Reaction | Origin tx | Reactive tx (Lasna) | Destination tx | Origin→Reactive | Origin→Destination |
|---|---|---|---|---|---|
| PlanScheduled | n/a (internal) | `0x73297b41e5753de9ec741b5042254b7e846420aa8375767fdea8576881157023` | none | n/a | n/a |
| PlanScheduled | n/a (internal) | `0x03250269e7b5f66c5d34e6299879b430e1f70cddf9afe0d59883b343779a6878` | none | n/a | n/a |
| PlanScheduled | n/a (internal) | `0xe286de1315c5917fbb1d9f6a03a660d96d2f77cea34f24e526cfbee824c394a8` | none | n/a | n/a |
| ActionRetried | [0x3795dccb…a3e809](https://sepolia.uniscan.xyz/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) | `0x078d764f26b09801035c53fbcdc2852b32d263ad2b66fdfe0687daaffba9de5c` | none | 1008s | n/a |
| DecisionRequestSent, ActionRetried | [0x3795dccb…a3e809](https://sepolia.basescan.org/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) | `0x7d611714f5354de602661cd1f1e7c3ff30a18e70a15248c8915c81e972fc919d` | none | n/a | n/a |
| ActionStuck | [0x3795dccb…a3e809](https://sepolia.uniscan.xyz/tx/0x3795dccbbf89c60a7402360b93ad3f461c58e995b90c9f76a843eede26a3e809) | `0xe070f66de992cc92d638dc9f74a5dea27dfd8135335e5e6e8eeb6bba03eaa92e` | none | 2062s | n/a |
| PlanScheduled | n/a (internal) | `0xd69c37db7c3c20637bb5e49c7caccbc0cc41af576b85a824a1ebff2cedb292c6` | none | n/a | n/a |
| PlanScheduled | n/a (internal) | `0xb955532658cc0f64ea68eb5e32cdbab81b2089c39308ad8da21248c46fa49784` | none | n/a | n/a |
| PlanScheduled | n/a (internal) | `0x57b296918459a6a08fb5782df31f1854bee2b10ffcb0e4bcf8f58b564a7b179c` | none | n/a | n/a |
| DecisionRequestSent | n/a (internal) | `0x82b858172989bd04812399a6e367a3e358171bcc10decf4d0e4a42f9f8cf1469` | none | n/a | n/a |
| RequestObserved | [0xa730bad0…001a33](https://sepolia.basescan.org/tx/0xa730bad087292a5cd1804a5e9af6bbb8e5b382a628fc1f12ffaab61048001a33) | `0xe9fc322ba2a2627b61720c1831fdf77baa96e8b563becce0fe5ed0424d72aadf` | none | -1s | n/a |
| RequestObserved | [0x30d1742f…6675ab](https://sepolia.basescan.org/tx/0x30d1742f217bfb9f870508dbcdccdb9e7d04a2798355d5894e6b9e690d6675ab) | `0x75a54b771304c571b79705e545104c12004b5939a369a0323f4a94d2899e29f2` | none | -1s | n/a |

Ack/retry in this window: **6** `ActionRetried`, **3** `ActionStuck`.

## Standing orders (`Plan*` events on the origin vaults)
| Chain | Event | Plan | Detail | Tx |
|---|---|---|---|---|
| Base Sepolia | PlanCreated | #4 | payee 0x33F693201E2fFEf0eD41f624Ec0502a0264a5368, 1 USDC / 120s, YIELD_ONLY, 3 left | [0x9de2a582…bbe645](https://sepolia.basescan.org/tx/0x9de2a582798e5920f8995633e53ca07772cd11756054e261b7655d723ebbe645) |
| Base Sepolia | PlanSkipped | #3 | no yield yet | [0x800da359…bb24ca](https://sepolia.basescan.org/tx/0x800da359fbdb0641967d3cb78434a238e36f21ecb76ec00041fd7eaf21bb24ca) |
| Base Sepolia | PlanSkipped | #3 | no yield yet | [0x89acccb4…4cc568](https://sepolia.basescan.org/tx/0x89acccb460da6317912d760969df925532a8253bd3329fefd7e77f4cb44cc568) |
| Base Sepolia | PlanSkipped | #3 | no yield yet | [0x79f5f92c…1d86f3](https://sepolia.basescan.org/tx/0x79f5f92c18fe30fc6c7d4eb4c0eb25487d1765cb53ad4ed339bccdde141d86f3) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0xdac811e8…5069d5](https://sepolia.basescan.org/tx/0xdac811e808f990c02994de9a0d32a07faef8ab64974781b2ae3856c63d5069d5) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x162aa2d0…8cf624](https://sepolia.basescan.org/tx/0x162aa2d0d49213f986994f1532f926d60f8e714a7df6666ec2826cf2528cf624) |
| Base Sepolia | PlanSkipped | #4 | no yield yet | [0x3faffd90…bec251](https://sepolia.basescan.org/tx/0x3faffd903d5836d2b2863c2bc348c895632e3a96250589cdb17b1eed2fbec251) |
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

## Live subscriptions (Reactive RPC `rnk_getFilters`)
Filters version 8742; 27 active filters belong to the RSC: {"1301":13,"84532":13,"5318007":1}. Re-run after calling `addPool` on a vault to show the count grow with no owner call.

Timestamps have 1-second granularity (Reactive Omni blocks are about 1s with instant finality), so latencies are accurate to ±1s.
