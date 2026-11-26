import { useQuery } from '@tanstack/react-query';
import { LIVE } from '../lib/mode';
import { fetchSourceLogs, type DecodedEvent } from '../lib/logs';
import { SOURCES, type SourceKey } from '../lib/sources';

const NOTE = 'Some history is unavailable right now. Showing what loaded; retrying automatically.';

/**
 * Reads contract events from the deployment block, chunked, cached in memory and in
 * localStorage, and shared between every component that asks for the same source. A failed
 * source only becomes an error when nothing at all loaded; otherwise `partial` is set.
 */
export function useLogs(...keys: SourceKey[]) {
  const query = useQuery({
    queryKey: ['chain-logs', keys.join(',')],
    enabled: LIVE && keys.length > 0,
    staleTime: 30_000,
    refetchInterval: LIVE ? 45_000 : false,
    retry: 1,
    queryFn: async () => {
      const results = await Promise.allSettled(keys.map((key) => fetchSourceLogs(SOURCES[key])));
      const groups = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSourceLogs>>> => r.status === 'fulfilled');
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (groups.length === 0) {
        throw new Error(failures[0]?.reason instanceof Error ? failures[0].reason.message : 'No event source could be read.');
      }
      return {
        logs: groups
          .flatMap((group) => group.value.logs)
          .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
          .reverse(),
        partial: failures.length > 0 || groups.some((group) => group.value.partial),
      };
    },
  });

  const data = query.data;
  const logs = data?.logs ?? [];
  const failed = LIVE && !!query.error && logs.length === 0;
  const partial = LIVE && logs.length > 0 && (!!query.error || !!data?.partial);

  return {
    logs,
    loading: LIVE && query.isLoading,
    error: failed ? (query.error as Error).message : undefined,
    partial,
    note: partial ? NOTE : undefined,
    isLive: LIVE && query.isSuccess && !query.error,
    refresh: query.refetch,
  };
}

/** Filter decoded events by name while keeping the union typed loosely on purpose. */
export function byEvent(logs: DecodedEvent[], ...names: string[]) {
  const set = new Set(names);
  return logs.filter((log) => set.has(log.eventName));
}
