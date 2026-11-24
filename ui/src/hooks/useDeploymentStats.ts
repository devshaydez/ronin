import { useReadContract } from 'wagmi';
import { baseSepolia, unichainSepolia } from 'wagmi/chains';
import { formatUnits, parseAbi } from 'viem';
import { LIVE, envAddress } from '../lib/mode';

const ABI = parseAbi(['function totalAssets() view returns (uint256)']);
const BASE = envAddress(import.meta.env.VITE_VAULT_ADDRESS);
const UNI = envAddress(import.meta.env.VITE_UNICHAIN_VAULT_ADDRESS);

/** Live headline figures. Demo mode keeps the labelled static marketing numbers. */
export function useDeploymentStats() {
  const base = useReadContract({ abi: ABI, address: BASE, functionName: 'totalAssets', chainId: baseSepolia.id, query: { enabled: LIVE && !!BASE, refetchInterval: 15000 } });
  const uni = useReadContract({ abi: ABI, address: UNI, functionName: 'totalAssets', chainId: unichainSepolia.id, query: { enabled: LIVE && !!UNI, refetchInterval: 15000 } });
  const configured = LIVE && !!BASE && !!UNI;
  return {
    configured,
    base: base.data !== undefined ? Number(formatUnits(base.data, 6)) : undefined,
    unichain: uni.data !== undefined ? Number(formatUnits(uni.data, 6)) : undefined,
    loading: base.isLoading || uni.isLoading,
    error: base.error ?? uni.error,
  };
}
