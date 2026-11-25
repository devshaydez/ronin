import { createPublicClient, http, parseEventLogs, type Abi, type Log, type PublicClient } from 'viem';
import { baseSepolia, unichainSepolia } from 'viem/chains';
import { BASE_RPC, LASNA_RPC, UNICHAIN_RPC } from './deployments';

export const lasnaChain = {
  id: 5318007,
  name: 'Reactive Lasna',
  nativeCurrency: { name: 'Reactive', symbol: 'REACT', decimals: 18 },
  rpcUrls: { default: { http: [LASNA_RPC] } },
  testnet: true,
} as const;

const clients: Record<number, PublicClient> = {
  [baseSepolia.id]: createPublicClient({ chain: baseSepolia, transport: http(BASE_RPC) }) as unknown as PublicClient,
  [unichainSepolia.id]: createPublicClient({ chain: unichainSepolia, transport: http(UNICHAIN_RPC) }) as unknown as PublicClient,
  5318007: createPublicClient({ chain: lasnaChain, transport: http(LASNA_RPC) }) as unknown as PublicClient,
};

export const publicClient = (chainId: number) => clients[chainId];

export interface DecodedEvent {
  key: string;
  chainId: number;
  address: `0x${string}`;
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  /** Wall-clock estimate, filled by the hook from the block timestamp when available. */
  ts?: number;
}

export interface LogSource {
  key: string;
  chainId: number;
  address: `0x${string}`;
  abi: Abi;
  fromBlock: bigint;
  rangeLimit?: number;
}

interface CacheEntry {
  logs: DecodedEvent[];
  lastBlock: bigint;
}

// In-memory per session. A page mount re-uses the scan and only fetches the new tail.
const cache = new Map<string, CacheEntry>();
const limits = new Map<number, number>();
const pending = new Map<string, Promise<DecodedEvent[]>>();

const initialLimit = (chainId: number) => (chainId === 5318007 ? 25_000 : 50_000);

function isRangeError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes('range') ||
    m.includes('exceed') ||
    m.includes('too many') ||
    m.includes('more than') ||
    m.includes('limit')
  );
}

function decode(source: LogSource, logs: Log[]): DecodedEvent[] {
  try {
    const parsed = parseEventLogs({ abi: source.abi, logs, strict: false });
    return parsed.map((log) => ({
      key: `${log.transactionHash}-${log.logIndex}`,
      chainId: source.chainId,
      address: source.address,
      eventName: log.eventName as string,
      args: (log.args ?? {}) as Record<string, unknown>,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash as `0x${string}`,
      logIndex: log.logIndex ?? 0,
    }));
  } catch {
    // A malformed/unknown log must never break the whole page: the raw hash is still useful.
    return [];
  }
}

async function scanSource(source: LogSource): Promise<DecodedEvent[]> {
  const client = clients[source.chainId];
  if (!client) throw new Error(`No RPC client configured for chain ${source.chainId}`);
  const cached = cache.get(source.key);
  const latest = await client.getBlockNumber();
  let from = cached ? cached.lastBlock + 1n : source.fromBlock;
  if (from > latest) return cached?.logs ?? [];

  let limit = limits.get(source.chainId) ?? source.rangeLimit ?? initialLimit(source.chainId);
  const out: DecodedEvent[] = cached ? [...cached.logs] : [];
  let requests = 0;

  while (from <= latest) {
    const to = from + BigInt(limit) - 1n > latest ? latest : from + BigInt(limit) - 1n;
    let logs: Log[];
    try {
      logs = await client.getLogs({ address: source.address, fromBlock: from, toBlock: to });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isRangeError(message) && limit > 500) {
        limit = Math.max(500, Math.floor(limit / 2));
        limits.set(source.chainId, limit);
        continue; // retry the same window with a smaller range
      }
      throw new Error(
        `Reading ${source.key} logs ${from}-${to} failed. The RPC refused the request: ${message.split('\n')[0]}`,
      );
    }
    out.push(...decode(source, logs));
    from = to + 1n;
    if (++requests > 600) throw new Error(`Reading ${source.key} logs needs too many RPC requests; narrow the range.`);
  }

  // Newest first for the UI, deduped by transaction + log index.
  const seen = new Map<string, DecodedEvent>();
  for (const log of out) seen.set(log.key, log);
  const merged = [...seen.values()].sort((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber),
  );
  cache.set(source.key, { logs: merged, lastBlock: latest });
  return merged;
}

/** Chunked eth_getLogs from the deployment block, with an RPC range-limit fallback and memory cache. */
export function fetchSourceLogs(source: LogSource): Promise<DecodedEvent[]> {
  const running = pending.get(source.key);
  if (running) return running;
  const job = scanSource(source)
    .catch((error) => {
      throw error;
    })
    .finally(() => pending.delete(source.key));
  pending.set(source.key, job);
  return job;
}

export function clearLogCache() {
  cache.clear();
  limits.clear();
}
