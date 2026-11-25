import { useReadContract } from 'wagmi';
import { vaultAbi } from '../lib/abis';
import { POOL_U, UNICHAIN } from '../lib/deployments';
import { LIVE } from '../lib/mode';

/**
 * Reads the breaker's freeze flag directly from the Unichain vault.
 * A frozen pool is not the same as a paused vault: the vault can resume while the
 * exited pool stays frozen until an admin calls `unfreeze(pool)`.
 */
export function usePoolFrozen() {
  const read = useReadContract({
    abi: vaultAbi,
    address: UNICHAIN.vault,
    functionName: 'poolFrozen',
    args: [POOL_U],
    chainId: UNICHAIN.chainId,
    query: { enabled: LIVE, refetchInterval: 5000 },
  });

  return {
    configured: LIVE,
    pool: POOL_U,
    frozen: read.data,
    loading: read.isLoading,
    error: read.error,
  };
}
