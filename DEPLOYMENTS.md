# Deployments

Live testnet deployment of Ronin, including standing orders (plans) and callback ack/retry.
Every transaction below has receipt status `1` unless noted.
Deployed **2026-11-22** with Foundry 1.9.0 (solc 0.8.29, `evm_version = cancun`, `via_ir = true`).

## CURRENT — 2026-11-22 deployment (Phase B2 evidence)

This is the live build. The 2026-11-20 deployment below is retained as **PREVIOUS**.

The core transactions are recovered from `broadcast/`; the 16 Unichain pools and the external contracts are
recovered from chain history. Address links open the address page; the deployment transaction hash links to the
receipt on that chain.

| Contract | Chain | Address | Deployment tx | Block |
|---|---|---|---|---:|
| `RoninReactive` | Lasna | [`0x6910…9d5f`](https://lasna.reactscan.net/address/0x69107baF143C38722744a09e3f27c3c076469d5f) | [`0xb7c1…3fa0`](https://lasna.reactscan.net/tx/0xb7c115b4f20044dfbe10395ed4f45adf384e7b543a55389c8792fd15f0373fa0) | 8,979,790 |
| `RoninVault` | Base Sepolia | [`0xCD50…ce66`](https://sepolia.basescan.org/address/0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66) | [`0x58ae…b1f0`](https://sepolia.basescan.org/tx/0x58ae6e7f9926b7b498ac58a88df48f7b6ce988db184902572cd459020800b1f0) | 62,173,781 |
| `DecisionRequester` | Base Sepolia | [`0xd3f0…0eBb`](https://sepolia.basescan.org/address/0xd3f0BD4a232AD8061DD119564AF64D8b6f340eBb) | [`0x373c…d22a1`](https://sepolia.basescan.org/tx/0x373c632e718ecb69fb81464860feb0638c1cac90002eb0e00b7b34e184cd22a1) | 62,173,780 |
| `AIVerdictRegistry` | Base Sepolia | [`0x1Ba4…2D34`](https://sepolia.basescan.org/address/0x1Ba4da5288751378c1813a256885c7e376592D34) | [`0xbfac…df15`](https://sepolia.basescan.org/tx/0xbfac60d5e373dbdbeb29d39ca984bb9d84f7b8af17bd9e65a67b76f94ff9df15) | 62,173,780 |
| `AaveV3Adapter` | Base Sepolia | [`0x6cE1…F568`](https://sepolia.basescan.org/address/0x6cE1f923B595Ade17FaF04fdE6700766DC7bF568) | [`0x3e2d…803d`](https://sepolia.basescan.org/tx/0x3e2df60a2ab0e540d144c0868b44b0512596694f4cc2f7bfe340a310a5f7803d) | 62,173,780 |
| `MockLendingPool` (stress) | Base Sepolia | [`0x7481…DbE0`](https://sepolia.basescan.org/address/0x74815327b2650467eba2aF4D37e6D2Bd9467DbE0) | [`0xbd25…3e72`](https://sepolia.basescan.org/tx/0xbd25d731bddc58e4c5d0c456c3764cf77e32a43830ce690662a9fd19e05c3e72) | 62,173,780 |
| USDC asset (external) | Base Sepolia | [`0xba50…4D5f`](https://sepolia.basescan.org/address/0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f) | [`0xcca4…d1ec`](https://sepolia.basescan.org/tx/0xcca4965da32a86ab3989c4dfa5de09113ee849ce7638a5b50f0c8776f51fd1ec) | 18,301,528 |
| Aave V3 Pool (external) | Base Sepolia | [`0x8bAB…aE27`](https://sepolia.basescan.org/address/0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27) | [`0xd0b1…5899`](https://sepolia.basescan.org/tx/0xd0b10976a3182e24b01c94f303b1668849b07e41a80c1fbdf50aa2b19b425899) | 18,385,222 |
| Callback proxy (external) | Base Sepolia | [`0x476F…3585`](https://sepolia.basescan.org/address/0x476F44b11F5C942c58f4c8E3d0300E5710743585) | [`0x0370…fb11`](https://sepolia.basescan.org/tx/0x037039b883813aeff2cdd163379051e7ac0d684085e3ad993121dd2306c1fb11) | 47,856,458 |
| `RoninVault` | Unichain Sepolia | [`0xce75…64cD`](https://sepolia.uniscan.xyz/address/0xce75a97917c8fd52eA30684F0988FAe4485D64cD) | [`0xb294…21dd`](https://sepolia.uniscan.xyz/tx/0xb29486aeeaca545020592abe0bb878fc9c3b9c5837670c5ad672f9b38ba721dd) | 68,504,321 |
| `DecisionRequester` | Unichain Sepolia | [`0xFcC6…A5B5`](https://sepolia.uniscan.xyz/address/0xFcC603B48675Ae138890BF4A155A13A378DAA5B5) | [`0x3bef…b6be`](https://sepolia.uniscan.xyz/tx/0x3bef12912682f5be83c8326371875da21f413fe0d39ec1181a2070d41f63b6be) | 68,504,321 |
| `AIVerdictRegistry` | Unichain Sepolia | [`0xA97D…007f`](https://sepolia.uniscan.xyz/address/0xA97D4F33F029928B8c0B54Ee47129Aa39F51007f) | [`0x6f78…e4f5`](https://sepolia.uniscan.xyz/tx/0x6f787a3c853fee204e423994aa9898a78625074d253905206f4c9dbce689e4f5) | 68,504,321 |
| `MockUSDC` | Unichain Sepolia | [`0x0Bd0…58F6`](https://sepolia.uniscan.xyz/address/0x0Bd0E5FDa3e21a23D0ef9B3267d1541c2AbE58F6) | [`0xc867…1f3e`](https://sepolia.uniscan.xyz/tx/0xc867a59f2f9bb8c6901fd13716d4e7c4031dd72687d030b0b0cb069221571f3e) | 68,504,320 |
| Callback proxy (external) | Unichain Sepolia | [`0x775c…66C1`](https://sepolia.uniscan.xyz/address/0x775c9B990ADe401060B78D0e98684eEf8d2466C1) | [`0xa2d7…c8b0`](https://sepolia.uniscan.xyz/tx/0xa2d7f55dd45a234f725ae16a5026a7117495bc5c149a26d794f48f6e4e35c8b0) | 64,628,832 |

### Verification

All contracts were built with solc **0.8.29**, `evm_version = cancun`, `via_ir = true`. Every contract below
has matching published source. Blockscout is the explorer linked here because it serves plain HTTP reads;
the official Basescan/Uniscan front ends sit behind a bot challenge.

| Contract | Chain | Explorer | Verified on |
|---|---|---|---|
| `RoninVault` | Base Sepolia | [Blockscout](https://base-sepolia.blockscout.com/address/0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66) | Blockscout |
| `AIVerdictRegistry` | Base Sepolia | [Blockscout](https://base-sepolia.blockscout.com/address/0x1Ba4da5288751378c1813a256885c7e376592D34) | Blockscout |
| `DecisionRequester` | Base Sepolia | [Blockscout](https://base-sepolia.blockscout.com/address/0xd3f0BD4a232AD8061DD119564AF64D8b6f340eBb) | Blockscout |
| `AaveV3Adapter` | Base Sepolia | [Blockscout](https://base-sepolia.blockscout.com/address/0x6cE1f923B595Ade17FaF04fdE6700766DC7bF568) | Blockscout + Sourcify |
| `MockLendingPool` (stress) | Base Sepolia | [Blockscout](https://base-sepolia.blockscout.com/address/0x74815327b2650467eba2aF4D37e6D2Bd9467DbE0) | Blockscout |
| `RoninVault` | Unichain Sepolia | [Blockscout](https://unichain-sepolia.blockscout.com/address/0xce75a97917c8fd52eA30684F0988FAe4485D64cD) | Blockscout |
| `DecisionRequester` | Unichain Sepolia | [Blockscout](https://unichain-sepolia.blockscout.com/address/0xFcC603B48675Ae138890BF4A155A13A378DAA5B5) | Blockscout |
| `AIVerdictRegistry` | Unichain Sepolia | [Blockscout](https://unichain-sepolia.blockscout.com/address/0xA97D4F33F029928B8c0B54Ee47129Aa39F51007f) | Blockscout |
| `MockUSDC` | Unichain Sepolia | [Blockscout](https://unichain-sepolia.blockscout.com/address/0x0Bd0E5FDa3e21a23D0ef9B3267d1541c2AbE58F6) | Blockscout |
| 16 `MockLendingPool` pools | Unichain Sepolia | [Blockscout](https://unichain-sepolia.blockscout.com/address/0x79387679Eb59e5692b3FC566Dcc3fE484eBDB9F4) | Sourcify (exact match, all 16) |
| `RoninReactive` | Lasna | [Reactscan](https://lasna.reactscan.net/address/0x69107baF143C38722744a09e3f27c3c076469d5f) | Sourcify (exact match) |

Sourcify record for the Reactive contract:
<https://sourcify.dev/server/repo-ui/5318007/0x69107baF143C38722744a09e3f27c3c076469d5f>.

**How to reproduce.** No API key is required for the public Blockscout API; the Reactive contract only
verifies through Sourcify, which is what Reactive Network documents.

```bash
# Base Sepolia and Unichain Sepolia (constructor args read from the creation tx)
forge verify-contract <ADDRESS> src/RoninVault.sol:RoninVault \
  --chain 84532 --rpc-url $BASE_SEPOLIA_RPC \
  --verifier blockscout --verifier-url https://base-sepolia.blockscout.com/api/ \
  --guess-constructor-args

# Unichain Sepolia uses --chain 1301 and https://unichain-sepolia.blockscout.com/api/

# Lasna (Reactive)
forge verify-contract 0x69107baF143C38722744a09e3f27c3c076469d5f \
  src/RoninReactive.sol:RoninReactive --chain 5318007 --verifier sourcify
```

If you verify against the official Basescan or Uniscan APIs instead, they need `ETHERSCAN_API_KEY` set in
your shell; that variable is never read by this repository.

### Unichain mock pools (all 16)

These are the `vault.pools(i)` entries in order. Pool U is the current target.

| Pool | Address | Deployment tx | Block |
|---|---|---|---:|
| A | [`0xCfc5…ec80`](https://sepolia.uniscan.xyz/address/0xCfc59C513752A10Cd024B4B655B829D7e7cCec80) | [`0x31c7…5e46`](https://sepolia.uniscan.xyz/tx/0x31c7f85dce82378533117f834da03ee12669c0353f3757e6a8ffee7894b85e46) | 68,504,320 |
| B | [`0x6950…4C8e`](https://sepolia.uniscan.xyz/address/0x6950F7B22bF1f7Ba720e6e92BE822407f16b4C8e) | [`0xcca0…c748`](https://sepolia.uniscan.xyz/tx/0xcca0338e2546301e487039583402b94621a47247fb4d09f4d2a72c7b6abfc748) | 68,504,321 |
| C | [`0xA245…3885`](https://sepolia.uniscan.xyz/address/0xA245F575e5D8FD814f89e22bd364713ba44D3885) | [`0xf2ac…9017`](https://sepolia.uniscan.xyz/tx/0xf2ac9a7ffeb93c5014378128ea295989381da463cdc74bf6a63777be24d49017) | 68,506,787 |
| D | [`0x8486…D91f`](https://sepolia.uniscan.xyz/address/0x8486013323497789D4Dcf6566042C6f58185D91f) | [`0xdaec…027e`](https://sepolia.uniscan.xyz/tx/0xdaec55c8dea23ffc4b6d2819c049d93b23ca4b80525fe10ab0ea345e322b027e) | 68,507,196 |
| E | [`0x4A22…7e73`](https://sepolia.uniscan.xyz/address/0x4A22E2A4e6fEFecFF1166D98Ce931Dabe9647e73) | [`0xda29…ae94`](https://sepolia.uniscan.xyz/tx/0xda29b2bcdfb0ffa66bc2a206cb7be882ccb321ab0036bcb53969003d4fecae94) | 68,507,254 |
| F | [`0x3228…779d`](https://sepolia.uniscan.xyz/address/0x3228717FadC69DB84ab61f7E8711BF8714a9779d) | [`0x922f…a2a3`](https://sepolia.uniscan.xyz/tx/0x922f59416ff44ba8c3c50eb4c505271f9cb940aa2fcd8789af394d3ff866a2a3) | 68,507,310 |
| G | [`0x3E50…7829`](https://sepolia.uniscan.xyz/address/0x3E50C8F0cf0c4A49A949296f79C3Eb480Dd27829) | [`0x43ad…5724`](https://sepolia.uniscan.xyz/tx/0x43ad200c4a342d8a024509515f88473a35af70e4d76710d590516051475e5724) | 68,519,010 |
| I | [`0x1e5D…3Eba`](https://sepolia.uniscan.xyz/address/0x1e5D6F9b87815eE6025d4f98248F3B09bB353Eba) | [`0x4ac8…d609`](https://sepolia.uniscan.xyz/tx/0x4ac8aeb23b680118314879711068ad5368552b01418d632b0fbecc03121ad609) | 68,519,178 |
| J | [`0xd21f…a335`](https://sepolia.uniscan.xyz/address/0xd21fF300daF7905cAcE77D8152F495A6df55a335) | [`0xc72c…6e4c`](https://sepolia.uniscan.xyz/tx/0xc72c9712a021d50e1202733fdc170c2d458696b1050ad70f6f8f0f2afe386e4c) | 68,519,216 |
| N | [`0x54FB…712B`](https://sepolia.uniscan.xyz/address/0x54FBd6F071dB95736bE7508bE2F6b888Dc32712B) | [`0xd3e4…806b`](https://sepolia.uniscan.xyz/tx/0xd3e4258c81096f4ca5dddcca03ff2ef15b61b0a80073a03b7e10d72bf06d806b) | 68,519,736 |
| O | [`0x73A4…CE2C`](https://sepolia.uniscan.xyz/address/0x73A4B61a23749C88765BdBf0843248BE5337CE2C) | [`0x3925…0207`](https://sepolia.uniscan.xyz/tx/0x39259bd289cb998c1cfe8993e86d017e7d5760cddf55c4ee1e9740209d2d0207) | 68,520,030 |
| Q | [`0xF717…a6e3`](https://sepolia.uniscan.xyz/address/0xF717b4980A3f81f01C680D27E29998Fc8767a6e3) | [`0x80a8…edb9`](https://sepolia.uniscan.xyz/tx/0x80a83dba85f2ad7bba42126366d75f2d4cd0d1b820f0fff4d9e825488f2fedb9) | 68,520,261 |
| R | [`0x1aB4…971F`](https://sepolia.uniscan.xyz/address/0x1aB4Fe4dc3c9a96fD18FAD2561215941e0F6971F) | [`0x72d0…0565`](https://sepolia.uniscan.xyz/tx/0x72d0c8b83f65689ddc61a26b7ba1f9ed3d3a689259576ee6834d093b78b30565) | 68,520,317 |
| S | [`0x63cA…a8F1`](https://sepolia.uniscan.xyz/address/0x63cA218b69a616b9c7802fe25334023900fda8F1) | [`0x9965…f6fb`](https://sepolia.uniscan.xyz/tx/0x9965ce080b3688bba3354aebdc3544c5fb420ef20b1733fcf3bc5dfa2177f6fb) | 68,520,376 |
| T | [`0xA935…bb4B`](https://sepolia.uniscan.xyz/address/0xA9355CF00b993D8B2ae69f03EeF2f05845C6bb4B) | [`0xcf10…1b54`](https://sepolia.uniscan.xyz/tx/0xcf108170f5407146a7601bd283c05421952ff92f449104f4fde61fe316491b54) | 68,520,541 |
| U | [`0x7938…B9F4`](https://sepolia.uniscan.xyz/address/0x79387679Eb59e5692b3FC566Dcc3fE484eBDB9F4) | [`0x4075…5ef0`](https://sepolia.uniscan.xyz/tx/0x40751af8078927bb7d8dedaffeae02d745b2794a73315ab8b57d9ff908cb5ef0) | 68,520,836 |

Every Phase B2 action hash is listed below and in `ai-service/PROOF.md`.

### Phase B2 evidence (2026-11-23 run)

**Stale-data self-heal**

| Event | Tx |
|---|---|
| Base stress `setRate(300,3500)` | `0x608868ad8cc4aa49c5f15930b8c7dc41b2f9f7f93948e82522aa8e2261972ff5` |
| Lasna `StaleHealed(84532)` | `0x2d5cb5f47e954b081c1cd932b19648a8ba65ccbe8c82376e2272ca82ea473c4e` |
| Base `UnpausedByReactive(STALE_DATA)` | `0x056c4b4a56a699a0d9ce1abe0e3a41b7b8324901e02465870ebd6c6056b71bb5` |

**Omnichain breaker + heal**

| Event | Tx |
|---|---|
| Unichain U `setRate(2400,9700)` | `0xfe66a1bb4d49350c74f0348159980a361166b800ad2cb10a8f30c6613934379b` |
| Lasna `BreakerTripped(1301,U,9700)` | `0x691e0c939e31a06f040bf39dea366bc38151c2cbbbfe04422bf941734c3aea64` |
| U `EmergencyExit` (500 USDC) | `0x58b4999a16631e27b6daac5273f969d8f26e0ef282ae7c9725b0c112c7a02bf0` |
| Lasna `ExitObserved` + `OmniPause(84532)` | `0x3a006972dcbb0e90560c7c56faa89a187400a899975720f472ee227e64eb64bb` |
| Base `PausedByReactive(OMNI_BREAKER)` | `0x97e7dd3be8a95acc252efa5073d19a6669f30bce0b3e89e7e25f3abd400647e9` |
| U `setRate(2400,3500)` heal | `0x44845c46081d0570645982135035319c98240c98fb607fceb39e871720cf89d6` |
| Lasna `BreakerCleared` + `OmniHeal(84532)` | `0xc2a51d4270dcb3a43f5fc07dea609ff65d23a15bee31b7224477dd82a9b1ab56` |
| Base `UnpausedByReactive(OMNI_BREAKER)` | `0x1bcddab6b02b99651e4e719c40e9076ea5cc4f3da6bad99f8f629e5e6073a723` |

**YIELD_ONLY / YIELD_THEN_PRINCIPAL**

| Event | Tx |
|---|---|
| Mint 5 yield USDC | `0x236d8063aa03da4e72de48b628c8e9df14b4cabd7cae86144acd373d63d1c4fb` |
| `accrue(vault,5e6)` | `0x4f15d987e19d75bfbcfa090266e72b55112b2cb5cbb57db15c9b640173cca2b2` |
| YIELD_ONLY plan 1 (1 USDC × 3) | `0x89ae2128313e1acf4fae478d42011516a1c9c89527d093f8297fb17efe5363f5` |
| Payouts 1/2/3, all `fromYield=1e6`, `fromPrincipal=0` | `0x05c46e…`, `0xc6150b…`, `0x89de8d…` (full hashes in `PROOF.md`) |
| YIELD_THEN_PRINCIPAL plan 2 (5 USDC) | `0xa5a827f9dafa2e8f6cf04f28e1849be6166903e9165a7ebb2f9fdda4a71f4ed6` |
| Executed: 1.999999 yield + 3.000001 principal | `0xbdedac6bfd0c82f619e0e635db842ccbe4cd284d109abead35809861b1a0f69e` |
| YIELD_ONLY plan 3 `PlanSkipped` (no yield) | `0x9d25fa33507fce94a6906959babab3b0f6e957bc744870050297e480e027e587` |

**Retry that heals**

| Event | Tx |
|---|---|
| AI `PAUSE` verdict 40 | `0x2d7cc90190193cbe98a199b96d05034f4422c2fdfd8279ac57cdf475e2e586f4` |
| `VerdictSeen` 44 (ACT, confidence 7000, target U) + `RebalanceRequested` | `0x3361c4be7390f78f8092d4b20b0abb9791b7876a897683995c85f38c16250cca` |
| Admin `unpause()` | `0x12b0575b35776d0d71a94dbef7c07f9e2ce77a127204aa341617ce8bd2c398be` |
| Retry callback for verdict 44 | `0x9e80c7d4e81944796819688f5404cb3dfd80f90231a9a69e903b5e5b3fceebfa` |
| `Rebalanced(44,U,498.762144,990.000000)` | `0xa71bcca7a280c61258e0050226b3287bcfdf5d416aa2cef386ce602a32b54ece` |
| Lasna `LoopClosed(1301,44,683s)` | `0x21032d303e9860d0b7c84e6a70aad5da9728766d3a81f78ed3a6c325a6a82dc1` |

**Reactive MCP**: full text in `docs/mcp-evidence/`. `get_rc_health` = **HEALTHY**, debt 0, reserves
0.4292435 lREACT, 39/39 subscriptions, 0 reverts/hour; `list_subscriptions` = 39 active, 0 inactive.

### Final minimum-cost state

`feedOn=false`, `cronOn=false`, `watchdog=false`, `activePlans=0`, `pendingActions=0`,
`estimatedBurnPerHour()=0`; Base vault unpaused 990.000000 USDC, Unichain vault unpaused 997.000000 USDC;
RSC reserves 0.4292435 lREACT, debt 0. This run consumed **3.8075081 lREACT** after three 1 lREACT top-ups,
above the 2.5 lREACT worst-case estimate (see `PROOF.md` for the breakdown and the frozen-pool retry history).

## PREVIOUS — 2026-11-20 redeploy (dynamic CRON, per-tick caps, backoff)

This was the live build before 2026-11-22; everything in this section is historical.

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
at ~100 gwei, about 0.032 lREACT per reaction. That feed, not cron, is the remaining cost. The deployed RSC
already has the owner knob: `disableFeed()` unsubscribes every configured Aave feed (with `enableFeed()` to
restore them), so `estimatedBurnPerHour()` reaches 0 without waiting for the reserve to run out. Verified by read-only `eth_call` against
`0x69107baF143C38722744a09e3f27c3c076469d5f`: `disableFeed()` reverts for a stranger with `only owner`, and
`feedOn()` currently returns `false`.

### Cost-basis defect in the 2026-11-20 build (fixed before the current deployment)

`yieldAvailable` did not fall as a `YIELD_ONLY` plan paid: `_withdraw` reduced `costBasis` in proportion to the
shares burned, which removed the same fraction of the unrealised gain, so the reported yield stayed ~constant
(40 → 37 USDC after 25 USDC of payouts) while the pot shrank. Consequence: a `YIELD_ONLY` plan kept paying after
the true yield was gone, silently eroding principal, and `YIELD_THEN_PRINCIPAL` never reported a principal
component here (all six mode-1 payouts show `fromYield = amount`, `fromPrincipal = 0`).

Fixed in `7fe5da3` ("Charge withdrawals only their principal to cost basis"): `_withdraw` measures yield first
and reduces `costBasis` only by `max(0, assets − yieldAvailable)`. The 2026-11-22 deployment includes the fix —
the verified source of both live vaults (`0xCD50…ce66` and `0xce75…64cD`) contains that `_withdraw`, and
`test_sixYieldOnlyPayoutsLeavePrincipalUntouched` / `test_withdrawingPartOfTheYieldLeavesBasisUnchanged` lock it
in. No redeploy is needed for it, and the Phase B2 run is unaffected (it created no `YIELD_ONLY` plan and paid no
yield; see `ai-service/PROOF.md`).

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

The request backoff and hourly cap (`RequestGate`, `requestBackoff = 600`, `maxRequestsPerHour = 12`, `RequestSuppressed`) are implemented and tested in `src/RoninReactive.sol`. At the time of that historical run they were **not** in the deployed bytecode (the RSC was the 2026-11-19 build); the current 2026-11-22 RSC includes them.
