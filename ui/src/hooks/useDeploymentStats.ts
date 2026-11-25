import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { vaultAbi } from '../lib/abis';
import { BASE, UNICHAIN } from '../lib/deployments';
import { LIVE } from '../lib/mode';

/** Live headline figures. Demo mode keeps the labelled static marketing numbers. */
export function useDeploymentStats() {
  const base = useReadContract({ abi: vaultAbi, address: BASE.vault, functionName: 'totalAssets', chainId: BASE.chainId, query: { enabled: LIVE, refetchInterval: 15000 } });
  const uni = useReadContract({ abi: vaultAbi, address: UNICHAIN.vault, functionName: 'totalAssets', chainId: UNICHAIN.chainId, query: { enabled: LIVE, refetchInterval: 15000 } });
  return {
    configured: LIVE,
    base: base.data !== undefined ? Number(formatUnits(base.data, 6)) : undefined,
    unichain: uni.data !== undefined ? Number(formatUnits(uni.data, 6)) : undefined,
    loading: base.isLoading || uni.isLoading,
    error: base.error ?? uni.error,
  };
}
