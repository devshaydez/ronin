import { useReadContract } from 'wagmi';
import { vaultAbi } from '../lib/abis';
import { BASE, UNICHAIN } from '../lib/deployments';
import { LIVE } from '../lib/mode';

/** Live vault pause state. The demo `mode` switch is intentionally ignored in live mode. */
export function useSafetyStatus() {
  const base = useReadContract({ abi: vaultAbi, address: BASE.vault, functionName: 'paused', chainId: BASE.chainId, query: { enabled: LIVE, refetchInterval: 5000 } });
  const uni = useReadContract({ abi: vaultAbi, address: UNICHAIN.vault, functionName: 'paused', chainId: UNICHAIN.chainId, query: { enabled: LIVE, refetchInterval: 5000 } });
  return {
    configured: LIVE,
    basePaused: base.data,
    unichainPaused: uni.data,
    paused: base.data === true || uni.data === true,
    loading: base.isLoading || uni.isLoading,
    error: base.error ?? uni.error,
  };
}
