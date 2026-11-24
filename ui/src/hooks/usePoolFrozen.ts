import { useReadContract } from 'wagmi';
import { unichainSepolia } from 'wagmi/chains';
import { parseAbi } from 'viem';

const VAULT = import.meta.env.VITE_UNICHAIN_VAULT_ADDRESS as `0x${string}` | undefined;
const POOL = import.meta.env.VITE_POOL_U_ADDRESS as `0x${string}` | undefined;

const poolFrozenAbi = parseAbi(['function poolFrozen(address) view returns (bool)']);

/**
 * Reads the breaker's freeze flag directly from the Unichain vault.
 * A frozen pool is not the same as a paused vault: the vault can resume while the
 * exited pool stays frozen until an admin calls `unfreeze(pool)`.
 */
export function usePoolFrozen() {
  const read = useReadContract({
    abi: poolFrozenAbi,
    address: VAULT,
    functionName: 'poolFrozen',
    args: POOL ? [POOL] : undefined,
    chainId: unichainSepolia.id,
    query: { enabled: !!VAULT && !!POOL, refetchInterval: 5000 },
  });

  return {
    configured: !!VAULT && !!POOL,
    pool: POOL,
    frozen: read.data,
    loading: read.isLoading,
    error: read.error,
  };
}
