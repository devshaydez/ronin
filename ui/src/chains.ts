import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { baseSepolia, unichainSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import { BASE_RPC, UNICHAIN_RPC } from './lib/deployments';

// Reactive Lasna is read-only for the UI. Confirm the RPC and explorer URLs with the developer.
export const reactiveLasna = defineChain({
  id: 5318007,
  name: 'Reactive Lasna',
  nativeCurrency: { name: 'Reactive', symbol: 'REACT', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_LASNA_RPC ?? 'https://lasna-rpc.rnk.dev/'] } },
  testnet: true,
});

// Both writable chains are registered with their own transport, so a switch request
// always has a target chain to name and a working RPC to read receipts from.
export const wagmiConfig = createConfig({
  chains: [baseSepolia, unichainSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(BASE_RPC),
    [unichainSepolia.id]: http(UNICHAIN_RPC),
  },
});

export const NETWORKS = [
  { chain: baseSepolia, sub: 'Testnet · deposits and orders', tx: 'https://sepolia.basescan.org/tx/' },
  { chain: unichainSepolia, sub: 'Testnet · cross-chain vault', tx: 'https://sepolia.uniscan.xyz/tx/' },
] as const;
