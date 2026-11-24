import { useReadContract } from 'wagmi';
import { baseSepolia, unichainSepolia } from 'wagmi/chains';
import { parseAbi } from 'viem';
import { LIVE, envAddress } from '../lib/mode';

const ABI = parseAbi(['function paused() view returns (bool)']);
const BASE = envAddress(import.meta.env.VITE_VAULT_ADDRESS);
const UNI = envAddress(import.meta.env.VITE_UNICHAIN_VAULT_ADDRESS);

/** Live vault pause state. The demo `mode` switch is intentionally ignored in live mode. */
export function useSafetyStatus() {
  const base = useReadContract({ abi: ABI, address: BASE, functionName: 'paused', chainId: baseSepolia.id, query: { enabled: LIVE && !!BASE, refetchInterval: 5000 } });
  const uni = useReadContract({ abi: ABI, address: UNI, functionName: 'paused', chainId: unichainSepolia.id, query: { enabled: LIVE && !!UNI, refetchInterval: 5000 } });
  return {
    configured: LIVE && !!BASE && !!UNI,
    basePaused: base.data,
    unichainPaused: uni.data,
    paused: base.data === true || uni.data === true,
    loading: base.isLoading || uni.isLoading,
    error: base.error ?? uni.error,
  };
}
