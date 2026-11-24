const env = import.meta.env;

/**
 * A configured vault address means this is a live build. Demo mode is the
 * default so the prototype is clickable without a wallet or an RPC.
 */
export const LIVE = Boolean(env.VITE_VAULT_ADDRESS);
export const DEMO = !LIVE;

export const GITHUB_URL = env.VITE_GITHUB_URL || 'https://github.com/devshaydez/ronin';
export const PROOF_URL = env.VITE_PROOF_URL || `${GITHUB_URL}/blob/main/ai-service/PROOF.md`;
export const DEMO_SCRIPT_URL = `${GITHUB_URL}/blob/main/docs/DEMO_SCRIPT.md`;

// Blockscout accepts automated reads; the official Uniscan/Basescan front ends
// often answer bots with a Cloudflare challenge even though the tx exists.
export const EXPLORERS = {
  base: 'https://base-sepolia.blockscout.com',
  unichain: 'https://unichain-sepolia.blockscout.com',
  lasna: 'https://lasna.reactscan.net',
} as const;

export type ExplorerChain = keyof typeof EXPLORERS;
export const explorerTx = (chain: ExplorerChain, hash: string) => `${EXPLORERS[chain]}/tx/${hash}`;
export const explorerAddress = (chain: ExplorerChain, address: string) => `${EXPLORERS[chain]}/address/${address}`;

export const envAddress = (value: string | undefined) => value as `0x${string}` | undefined;
export const envAddresses = (value: string | undefined) =>
  (value ?? '').split(',').map((s) => s.trim()).filter(Boolean) as `0x${string}`[];
