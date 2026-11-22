import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { baseSepolia, unichainSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Reactive Lasna is read-only for the UI. Confirm the RPC and explorer URLs with the developer.
export const reactiveLasna = defineChain({
  id: 5318007,
  name: 'Reactive Lasna',
  nativeCurrency: { name: 'Reactive', symbol: 'REACT', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_LASNA_RPC ?? 'https://lasna-rpc.rnk.dev/'] } },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [baseSepolia, unichainSepolia],
  connectors: [injected()],
  transports: { [baseSepolia.id]: http(), [unichainSepolia.id]: http() },
});

export const NETWORKS = [
  { chain: baseSepolia, sub: 'Chain ID 84532', tx: 'https://sepolia.basescan.org/tx/' },
  { chain: unichainSepolia, sub: 'Chain ID 1301', tx: 'https://sepolia.uniscan.xyz/tx/' },
] as const;
