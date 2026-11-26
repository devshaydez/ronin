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
  /** Blockscout base URL used when the RPC cannot serve this range (or first, if asked). */
  explorer?: string;
  /** Skip the RPC scan entirely — used where the public RPC prunes history. */
  explorerFirst?: boolean;
}

interface ExplorerLog {
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  blockNumber: string;
  transactionHash: `0x${string}`;
  logIndex: string;
  timeStamp: string;
}

interface CacheEntry {
  logs: DecodedEvent[];
  lastBlock: bigint;
}

// In-memory per session. A page mount re-uses the scan and only fetches the new tail.
/** One request at a time per host: Blockscout answers a burst of parallel queries with 429. */
const hostQueue = new Map<string, Promise<unknown>>();
function serialise<T>(host: string, job: () => Promise<T>): Promise<T> {
  const previous = hostQueue.get(host) ?? Promise.resolve();
  const next = previous.then(job, job);
  hostQueue.set(
    host,
    next.catch(() => undefined),
  );
  return next;
}

const cache = new Map<string, CacheEntry>();
const limits = new Map<number, number>();
const pending = new Map<string, Promise<DecodedEvent[]>>();

const initialLimit = (chainId: number) => (chainId === 5318007 ? 25_000 : 50_000);

// Rough block time per chain, only used to extrapolate a timestamp inside one block window.
const BLOCK_SECONDS: Record<number, number> = { [baseSepolia.id]: 2, [unichainSepolia.id]: 1, 5318007: 1 };

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

/**
 * One filtered history query on Blockscout. Used when the public RPC either caps the block range or
 * has pruned the blocks the deployment lives in; it also gives us real block timestamps.
 */
async function scanExplorer(source: LogSource): Promise<DecodedEvent[]> {
  const base = source.explorer;
  if (!base) throw new Error(`${source.key}: no explorer configured`);
  const url = `${base}/api?module=logs&action=getLogs&address=${source.address}&fromBlock=${source.fromBlock}&toBlock=latest`;
  const res = await serialise(base, async () => {
    const first = await fetch(url);
    if (first.status !== 429) return first;
    await new Promise((r) => setTimeout(r, 1500));
    return fetch(url);
  });
  if (!res.ok) throw new Error(`${source.key}: explorer answered ${res.status}`);
  const json = (await res.json()) as { status?: string; result?: unknown };
  if (json.status !== '1' || !Array.isArray(json.result)) return [];

  const rows = json.result as ExplorerLog[];
  const logs = rows.map((row) => ({
    address: row.address,
    topics: row.topics,
    data: row.data,
    blockNumber: BigInt(row.blockNumber),
    transactionHash: row.transactionHash,
    logIndex: Number(row.logIndex),
    removed: false,
  })) as unknown as Log[];
  const stamps = new Map(rows.map((row) => [`${row.transactionHash}-${Number(row.logIndex)}`, Number(row.timeStamp) * 1000]));
  const decoded = decode(source, logs).map((log) => ({ ...log, ts: stamps.get(log.key) }));
  const merged = decoded.sort((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber),
  );
  cache.set(source.key, { logs: merged, lastBlock: merged[0]?.blockNumber ?? source.fromBlock });
  return merged;
}

async function scanRpc(source: LogSource): Promise<DecodedEvent[]> {
  const client = clients[source.chainId];
  if (!client) throw new Error(`No RPC client configured for chain ${source.chainId}`);
  const cached = cache.get(source.key);
  const latest = await client.getBlockNumber();
  let from = cached ? cached.lastBlock + 1n : source.fromBlock;
  if (from > latest) return cached?.logs ?? [];

  // Anchor relative times to the head block, not to the newest log: an event from days ago must
  // not read as if it just happened.
  const head = await client.getBlock({ blockNumber: latest }).catch(() => undefined);
  const headTs = head ? Number(head.timestamp) : undefined;

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
  const blockSeconds = BLOCK_SECONDS[source.chainId] ?? 2;
  const merged = [...seen.values()]
    .sort((a, b) =>
      a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber),
    )
    .map((log) => ({
      ...log,
      ts: headTs !== undefined ? (headTs - Number(latest - log.blockNumber) * blockSeconds) * 1000 : undefined,
    }));
  cache.set(source.key, { logs: merged, lastBlock: latest });
  return merged;
}

async function scanSource(source: LogSource): Promise<DecodedEvent[]> {
  if (source.explorerFirst && source.explorer) {
    try {
      return await scanExplorer(source);
    } catch {
      // fall through to the RPC scan below
    }
  }
  try {
    return await scanRpc(source);
  } catch (error) {
    // A public RPC that prunes history or rate-limits a long scan is common on testnets; the
    // explorer serves the same logs without a block-range limit.
    if (!source.explorer) throw error;
    try {
      return await scanExplorer(source);
    } catch {
      throw error;
    }
  }
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
