import { useMemo } from 'react';
import { buildMoves } from '../lib/moves';
import { useLogs } from './useLogs';
import type { LivePool } from './usePools';

const MOVE_KEYS = ['baseVault', 'uniVault', 'baseRegistry', 'uniRegistry', 'baseRequester', 'uniRequester', 'rsc'] as const;

/** Uses the same cached log query as the decisions and loops hooks. */
export function useMoves(pools: LivePool[]) {
  const { logs, loading, error, partial, note, refresh } = useLogs(...MOVE_KEYS);
  const moves = useMemo(() => buildMoves(logs, pools), [logs, pools]);
  return { moves, loading, error, partial, note, refresh };
}
