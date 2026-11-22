import { useAccount, useReadContract } from 'wagmi';
import { erc4626Abi, formatUnits } from 'viem';
import { mockVault } from '../data/mock';

const VAULT = import.meta.env.VITE_VAULT_ADDRESS as `0x${string}` | undefined;

/**
 * Reads the connected wallet's position from the vault (ERC-4626).
 * With no VITE_VAULT_ADDRESS set, `live` is false and the app uses labelled sample data.
 */
export function useVault() {
  const { address } = useAccount();
  const shares = useReadContract({
    abi: erc4626Abi, address: VAULT, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!VAULT && !!address, refetchInterval: 4000 },
  });
  const assets = useReadContract({
    abi: erc4626Abi, address: VAULT, functionName: 'convertToAssets',
    args: shares.data !== undefined ? [shares.data] : undefined,
    query: { enabled: shares.data !== undefined, refetchInterval: 4000 },
  });
  const live = !!VAULT && assets.data !== undefined;
  return { live, balance: live ? Number(formatUnits(assets.data!, 6)) : undefined, apy: mockVault.apy, deposited: mockVault.deposited };
}
