# Ronin UI

React 18, TypeScript, Vite, Tailwind, Framer Motion, wagmi and viem.

## Run

    npm install
    cp .env.example .env     # add the vault address from DEPLOYMENTS.md
    npm run dev

## Routes

| Route | Screen |
|---|---|
| `/` | Landing page: hero, stat curve, how it works, standing orders, safety, proof, limits, footer |
| `/app` | Vault dashboard (P0) |
| `/app/pipeline` | Live pipeline (P0) |
| `/app/orders` | Standing orders (P0) |
| `/app/ai` | AI decisions (P1) |
| `/app/pools` | Pools and rates (P1) |
| `/app/safety` | Safety status (P1) |
| `/app/reviewer` | Proof, operations health, demo controls (P2) |

## Layout

- `src/components` design system: Button, Card, Pill, Banner, Segmented, ConfidenceMeter, StepRow, NetworkMenu, Header, DepositCard.
- `src/state/AppState.tsx` shared state: preview mode, balances, orders, feed and the pipeline loop runner.
- `src/data` sample data and the loop step definitions.
- `src/index.css` tokens (light and dark), chrome ring and mockup animations.
- `prototype/` the original clickable HTML prototype, kept as the visual reference.

## Demo mode

With no `VITE_VAULT_ADDRESS` set, the app runs a built-in demo wallet, so every screen, state and flow is clickable
without a wallet extension. Set the variable to switch to real wagmi wallet and vault reads.

## Wiring to the chain

- `src/chains.ts`: Base Sepolia, Unichain Sepolia and Reactive Lasna. Confirm the Lasna RPC and explorer URLs.
- `src/hooks/useVault.ts` reads the ERC-4626 balance when `VITE_VAULT_ADDRESS` is set. Otherwise the UI shows labelled sample data.
- `src/hooks/usePoolFrozen.ts` reads `poolFrozen(pool)` from the Unichain vault on the Safety screen. Set `VITE_UNICHAIN_VAULT_ADDRESS` and `VITE_POOL_U_ADDRESS`; without them the card says the live read is not configured.
- Marked TODOs: deposit and withdraw in `DepositCard.tsx` use a timer, replace with `useWriteContract`
  and `useWaitForTransactionReceipt`. Rates, pools, decisions, orders and ops data are in `src/data/mock.ts`
  and should be replaced with event reads (activity feed, AI decisions, pipeline) and the status service (ops).
- Contract addresses come from env, never from source.

## Known gaps

Not built or run in the environment that produced this, so run `npm install && npm run build` first and fix any type errors.
Explorer links are placeholders (`#`). The preview and demo controls are testnet-only helpers.
