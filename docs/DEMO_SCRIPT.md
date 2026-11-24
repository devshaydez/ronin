# Ronin live demo — 3 minutes

Current deployment: **2026-11-22** (see [`DEPLOYMENTS.md`](../DEPLOYMENTS.md)). This script is deliberately short:
one live safety cycle, one honest retry replay, and the measured latency proof. The 683 s retry is **not re-run
live**; it is replayed in the UI because waiting 11 minutes would not fit a 3-minute demo.

## Before the clock starts

Use three terminals from the repo root (`ronin/`).

**Terminal 1 — commands**

```bash
cd ronin
set -a; . ./.env; set +a

export POOL_U=0x79387679Eb59e5692b3FC566Dcc3fE484eBDB9F4
export BASE_STRESS=0x74815327b2650467eba2aF4D37e6D2Bd9467DbE0

# Read-only preflight: no lREACT is spent here.
cast call "$RSC" "pendingActions()(uint256)" --rpc-url "$LASNA_RPC"
cast call "$RSC" "feedOn()(bool)" --rpc-url "$LASNA_RPC"
cast call "$RSC" "estimatedBurnPerHour()(uint256)" --rpc-url "$LASNA_RPC"
cast call "$UNICHAIN_VAULT" "poolFrozen(address)(bool)" "$POOL_U" --rpc-url "$UNICHAIN_SEPOLIA_RPC"
cast call "$BASE_VAULT" "paused()(bool)" --rpc-url "$BASE_SEPOLIA_RPC"
```

Expected starting state: both vaults unpaused, `POOL_U` unfrozen, no pending actions, feed/cron off, burn 0.
If reserves are below **0.35 lREACT**, top up before presenting; the reserve target is **0.5 lREACT**.

**Terminal 2 — UI**

```bash
cd ronin/ui
cp .env.example .env.local
```

Set these values in `ui/.env.local` (the addresses are the current build):

```dotenv
VITE_VAULT_ADDRESS=0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66
VITE_UNICHAIN_VAULT_ADDRESS=0xce75a97917c8fd52eA30684F0988FAe4485D64cD
VITE_POOL_U_ADDRESS=0x79387679Eb59e5692b3FC566Dcc3fE484eBDB9F4
VITE_LASNA_RPC=https://lasna-rpc.rnk.dev/
```

```bash
npm run dev
```

Open **http://localhost:5173**.

**Terminal 3 — watch the live events**

```bash
cd ronin
set -a; . ./.env; set +a
export POOL_U=0x79387679Eb59e5692b3FC566Dcc3fE484eBDB9F4
export FROM=$(cast block-number --rpc-url "$LASNA_RPC")

# Run this after the trip/heal calls; it prints the RSC receipts.
cast logs --address "$RSC" --from-block "$FROM" --to-block latest \
  --rpc-url "$LASNA_RPC" \
  "BreakerTripped(uint256,address,uint256)"
```

## The 3-minute run

### 0:00–0:30 — Safety screen: pause is not freeze

**UI:** open `/app/safety`. Point at **Safety status** and the card **Pool freeze after a breaker exit**.

Say:

> The vaults can resume automatically. A pool that the breaker exited is different: it stays frozen until an
> admin reviews it. This flag is read from `poolFrozen(pool)` on the Unichain vault, not from a label.

If the card says **This pool is not frozen**, that is the expected post-B2 state: the admin already unfroze U.
The card still states the rule, and will turn red if the live read is `true`.

**Cost:** 0 lREACT (read-only).

### 0:30–1:15 — Trip the breaker on the current deployment

**UI:** keep `/app/safety` open. Optionally switch to `/app/pools` so the audience sees Pool U at the top of the
Unichain table after the trip.

Run the live spike (this is the only state-changing command in the first half):

```bash
cast send "$POOL_U" "setRate(uint256,uint256)" 2400 9700 \
  --private-key "$DEPLOYER_PK" --rpc-url "$UNICHAIN_SEPOLIA_RPC"
```

What should appear, in order:

1. `BreakerTripped(1301, POOL_U, 9700)` on Lasna.
2. `EmergencyExit(POOL_U, 500.000000 USDC)` on Unichain.
3. `ExitObserved` + `OmniPause(84532)` on Lasna.
4. Base vault `PausedByReactive(OMNI_BREAKER)`.
5. On `/app/safety`, the live read shows **This pool is frozen** (after refresh/next poll).

Say:

> Vaults paused automatically. The exited pool is frozen separately. The automatic heal can resume the vaults,
> but it cannot unfreeze this pool.

**Cost:** about **0.06–0.12 lREACT** for the rate, breaker, exit and cross-chain pause reactions, plus normal
Unichain gas. The estimate is based on the contract’s measured **~0.032 lREACT per Aave/rate reaction**
(`FEED_EVENT_GAS`); actual reserves are authoritative.

### 1:15–1:50 — Heal the vaults, keep the pool frozen

```bash
cast send "$POOL_U" "setRate(uint256,uint256)" 2400 3500 \
  --private-key "$DEPLOYER_PK" --rpc-url "$UNICHAIN_SEPOLIA_RPC"
```

Expected: `BreakerCleared` + `OmniHeal(84532)`, then Base `UnpausedByReactive(OMNI_BREAKER)`.

**UI:** refresh `/app/safety`. The vault status should be clear, but the **Pool freeze** card must still say
**This pool is frozen**. That contrast is the point of the screen.

Say:

> The vaults resumed automatically. This pool did not. It needs a human review before it gets funds again.

**Cost:** about **0.03–0.06 lREACT** (heal reaction), plus Unichain gas.

### 1:50–2:20 — Human review and the retry that heals

**UI:** `/app/pipeline` → **Run retry demo**. This replays the B2 verdict-44 path locally and shows
**Retrying (attempt 2 of 3)** and **Recovery, 683 s**; it does not spend lREACT or move funds.

After the review, clear the live freeze (this is the admin action, not an automatic heal):

```bash
cast send "$UNICHAIN_VAULT" "unfreeze(address)" "$POOL_U" \
  --private-key "$DEPLOYER_PK" --rpc-url "$UNICHAIN_SEPOLIA_RPC"
```

Expected: `PoolUnfrozen(POOL_U)`, and the Safety card returns to **This pool is not frozen**.

Say:

> Replaying the real retry: the first callback reverted because the vault was paused. An admin unpaused it, the
> RSC retried the same verdict on attempt 2, and the move completed. We label that 683 seconds as recovery time,
> not loop speed.

**Cost:** the live `unfreeze` is Unichain gas only (0 lREACT); the replay is **0 lREACT**.

### 2:20–2:50 — Orders and the feed show retries honestly

**UI:** `/app/orders` → the **Team stipend** order shows **Retrying (attempt 2 of 3)** and says recovery is not a
faster loop. `/app` → **Live activity** shows the failed first callback, the retry, and the heal.

Optional: `/app/reviewer` → **Demo controls** → **Replay the retry that healed** → **Run retry demo** for the
same path from the reviewer screen.

**Cost:** 0 lREACT (sample/local UI state).

### 2:50–3:00 — Proof: where the 22 seconds go

**UI:** `/app/reviewer` → **Proof**, or the landing page’s **Proof** section.

Show the breakdown:

| Stage | Median | What it measures |
|---|---:|---|
| Reactive reaction | 2.0 s | rate event → request posted |
| Request callback | 5.7 s | request posted → AI service receives it |
| AI inference (model call) | 12.0 s | the off-chain model hop |
| Verdict to rebalance | 2.0 s | verdict posted → funds moved |
| **Total** | **22 s** | median of 10 completed loops |

Say:

> The AI hop is a model call, and it is the largest single stage. The 683 s retry is excluded from these medians
> because it is recovery time.

**Cost:** 0 lREACT.

## Cost summary

| Step | lREACT estimate |
|---|---:|
| Preflight / Safety screen | 0 |
| Breaker trip (`setRate` 9700) | 0.06–0.12 |
| Heal (`setRate` 3500) | 0.03–0.06 |
| Retry replay + live `unfreeze` | 0 (replay) + Unichain gas |
| Orders / feed / proof | 0 |
| **Total** | **0.09–0.18 lREACT** |

Reserve **0.5 lREACT**; stop and top up if the reserve drops below **0.35**. The B2 evidence run itself consumed
3.8075081 lREACT because it repeated AI requests and retried against a frozen pool — do not use that as the demo
budget.

## After the demo

If you ran the live breaker step, the admin `unfreeze` above is required. Then verify the ending state:

```bash
cast call "$UNICHAIN_VAULT" "poolFrozen(address)(bool)" "$POOL_U" --rpc-url "$UNICHAIN_SEPOLIA_RPC"
cast call "$BASE_VAULT" "paused()(bool)" --rpc-url "$BASE_SEPOLIA_RPC"
cast call "$UNICHAIN_VAULT" "paused()(bool)" --rpc-url "$UNICHAIN_SEPOLIA_RPC"
cast call "$RSC" "pendingActions()(uint256)" --rpc-url "$LASNA_RPC"
cast call "$RSC" "estimatedBurnPerHour()(uint256)" --rpc-url "$LASNA_RPC"
```

Expected: `false`, `false`, `false`, `0`, `0`. The demo does not turn on feed, cron or the watchdog. Do not leave
the automation paying for a loop after the audience leaves.
