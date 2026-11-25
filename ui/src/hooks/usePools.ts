import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, parseAbi } from 'viem';
import { BASE, UNICHAIN, type ChainDeployment } from '../lib/deployments';
import { LIVE } from '../lib/mode';

const vaultAbi = parseAbi([
  'function poolsLength() view returns (uint256)',
  'function pools(uint256) view returns (address)',
]);

const POOL_ABI = parseAbi([
  'function name() view returns (string)',
  'function rateBps() view returns (uint256)',
  'function utilizationBps() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

export interface LivePool {
  name: string;
  chain: 'Base Sepolia' | 'Unichain Sepolia';
  address: string;
  rateBps: number;
  utilizationBps: number;
  vaultBalance: number;
}

/** Reads the vault's own pool registry, then each pool's name, rate, utilisation and vault balance. */
function useChainPools(chain: ChainDeployment) {
  const count = useReadContract({
    abi: vaultAbi,
    address: chain.vault,
    functionName: 'poolsLength',
    chainId: chain.chainId,
    query: { enabled: LIVE, refetchInterval: 20_000 },
  });
  const total = Number(count.data ?? 0);
  const ids = Array.from({ length: total }, (_, i) => BigInt(i));
  const addresses = useReadContracts({
    contracts: ids.map((id) => ({ abi: vaultAbi, address: chain.vault, functionName: 'pools' as const, args: [id], chainId: chain.chainId })),
    query: { enabled: LIVE && total > 0, refetchInterval: 20_000 },
  });
  const pools = (addresses.data ?? []).map((r) => r.result as `0x${string}` | undefined).filter((a): a is `0x${string}` => !!a);
  const details = useReadContracts({
    contracts: pools.flatMap((address) => [
      { address, abi: POOL_ABI, functionName: 'name' as const, chainId: chain.chainId },
      { address, abi: POOL_ABI, functionName: 'rateBps' as const, chainId: chain.chainId },
      { address, abi: POOL_ABI, functionName: 'utilizationBps' as const, chainId: chain.chainId },
      { address, abi: POOL_ABI, functionName: 'balanceOf' as const, args: [chain.vault] as const, chainId: chain.chainId },
    ]),
    query: { enabled: LIVE && pools.length > 0, refetchInterval: 20_000 },
  });
  const rows: LivePool[] = [];
  pools.forEach((address, i) => {
    const name = details.data?.[i * 4]?.result;
    if (!name) return;
    rows.push({
      name: String(name),
      chain: chain.name,
      address,
      rateBps: Number(details.data?.[i * 4 + 1]?.result ?? 0),
      utilizationBps: Number(details.data?.[i * 4 + 2]?.result ?? 0),
      vaultBalance: Number(formatUnits(BigInt((details.data?.[i * 4 + 3]?.result as bigint | undefined) ?? 0n), 6)),
    });
  });
  return { rows, loading: count.isLoading || addresses.isLoading || details.isLoading, error: count.error ?? addresses.error ?? details.error };
}

/** Live only: empty in demo mode so the demo dataset stays the single source. */
export function usePools() {
  const base = useChainPools(BASE);
  const uni = useChainPools(UNICHAIN);
  const pools = [...base.rows, ...uni.rows];
  return {
    configured: LIVE,
    pools,
    loading: base.loading || uni.loading,
    error: base.error ?? uni.error,
    best: pools.reduce<LivePool | undefined>((best, p) => (!best || p.rateBps > best.rateBps ? p : best), undefined),
    inUse: pools.reduce<LivePool | undefined>((best, p) => (!best || p.vaultBalance > best.vaultBalance ? p : best), undefined),
  };
}
