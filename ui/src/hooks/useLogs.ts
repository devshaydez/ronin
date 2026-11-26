import { useQuery } from '@tanstack/react-query';
import { LIVE } from '../lib/mode';
import { fetchSourceLogs, type DecodedEvent } from '../lib/logs';
import { SOURCES, type SourceKey } from '../lib/sources';

/**
 * Reads a contract's events from the deployment block, chunked, cached in memory and refreshed
 * on a timer. Demo mode never fetches: the sample labels stay visible.
 */
export function useLogs(...keys: SourceKey[]) {
  const query = useQuery({
    queryKey: ['chain-logs', keys.join(',')],
    enabled: LIVE && keys.length > 0,
    staleTime: 30_000,
    refetchInterval: LIVE ? 60_000 : false,
    retry: 1,
    queryFn: async () => {
      // The reader already fills `ts` from the head block; just merge the sources here.
      const groups = await Promise.all(keys.map((key) => fetchSourceLogs(SOURCES[key])));
      return groups.flat().sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).reverse();
    },
  });

  const logs = query.data ?? [];
  return {
    logs,
    loading: LIVE && query.isLoading,
    error: LIVE && query.error ? (query.error as Error).message : undefined,
    isLive: LIVE && query.isSuccess && !query.error,
    refresh: query.refetch,
  };
}

/** Filter decoded events by name while keeping the union typed loosely on purpose. */
export function byEvent(logs: DecodedEvent[], ...names: string[]) {
  const set = new Set(names);
  return logs.filter((log) => set.has(log.eventName));
}
