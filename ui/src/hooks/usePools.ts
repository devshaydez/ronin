import { useReadContracts } from 'wagmi';
import { baseSepolia, unichainSepolia } from 'wagmi/chains';
import { parseAbi } from 'viem';
import { LIVE, envAddress, envAddresses } from '../lib/mode';

const ABI = parseAbi([
  'function name() view returns (string)',
  'function rateBps() view returns (uint256)',
  'function utilizationBps() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

const BASE_VAULT = envAddress(import.meta.env.VITE_VAULT_ADDRESS);
const UNI_VAULT = envAddress(import.meta.env.VITE_UNICHAIN_VAULT_ADDRESS);
const BASE_POOLS = envAddresses(import.meta.env.VITE_BASE_POOL_ADDRESSES);
const UNI_POOLS = envAddresses(import.meta.env.VITE_UNICHAIN_POOL_ADDRESSES);

export interface LivePool {
  name: string;
  chain: 'Base Sepolia' | 'Unichain Sepolia';
  address: string;
  rateBps: number;
  utilizationBps: number;
  vaultBalance: number;
}

function useChainPools(chain: 'Base Sepolia' | 'Unichain Sepolia', chainId: number, pools: `0x${string}`[], vault: `0x${string}` | undefined) {
  const contracts = pools.flatMap((address) => [
    { address, abi: ABI, functionName: 'name' as const, chainId },
    { address, abi: ABI, functionName: 'rateBps' as const, chainId },
    { address, abi: ABI, functionName: 'utilizationBps' as const, chainId },
    { address, abi: ABI, functionName: 'balanceOf' as const, args: [vault ?? '0x0000000000000000000000000000000000000000'] as const, chainId },
  ]);
  const read = useReadContracts({ contracts, query: { enabled: LIVE && pools.length > 0 && !!vault, refetchInterval: 15000 } });
  const rows: LivePool[] = [];
  pools.forEach((address, i) => {
    const name = read.data?.[i * 4]?.result;
    const rateBps = read.data?.[i * 4 + 1]?.result;
    const utilizationBps = read.data?.[i * 4 + 2]?.result;
    const vaultBalance = read.data?.[i * 4 + 3]?.result;
    if (name) rows.push({ name: String(name), chain, address, rateBps: Number(rateBps ?? 0), utilizationBps: Number(utilizationBps ?? 0), vaultBalance: Number(vaultBalance ?? 0) });
  });
  return { rows, loading: read.isLoading, error: read.error };
}

/** Live only: empty in demo mode so the demo dataset stays the single source. */
export function usePools() {
  const base = useChainPools('Base Sepolia', baseSepolia.id, BASE_POOLS, BASE_VAULT);
  const uni = useChainPools('Unichain Sepolia', unichainSepolia.id, UNI_POOLS, UNI_VAULT);
  const pools = [...base.rows, ...uni.rows];
  return {
    configured: LIVE && BASE_POOLS.length > 0 && UNI_POOLS.length > 0,
    pools,
    loading: base.loading || uni.loading,
    error: base.error ?? uni.error,
    best: pools.reduce<LivePool | undefined>((best, p) => (!best || p.rateBps > best.rateBps ? p : best), undefined),
    inUse: pools.reduce<LivePool | undefined>((best, p) => (!best || p.vaultBalance > best.vaultBalance ? p : best), undefined),
  };
}
