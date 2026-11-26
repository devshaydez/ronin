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
  /** Prefer the explorer for a cold read; a warm cache is always completed over the RPC. */
  explorerFirst?: boolean;
}

/** What one source could deliver, and whether any of its history is still missing. */
export interface SourceResult {
  logs: DecodedEvent[];
  partial: boolean;
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

interface RawRpcLog {
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  blockNumber: string;
  transactionHash: `0x${string}`;
  logIndex: string;
}

interface CacheEntry {
  logs: DecodedEvent[];
  lastBlock: bigint;
  /** True when the scan reached the head of the chain, so only the tail is missing. */
  complete: boolean;
}

/**
 * Public RPCs only. They disagree: Unichain's own node caps a range at 1,000 blocks,
 * thirdweb caps at 1,000, publicnode prunes old history, and dRPC's free plan allows 100.
 * Rotating between them keeps a scan alive when one starts answering 429.
 */
const RPC_ENDPOINTS: Record<number, string[]> = {
  [baseSepolia.id]: uniq([BASE_RPC, 'https://base-sepolia-rpc.publicnode.com']),
  [unichainSepolia.id]: uniq([
    UNICHAIN_RPC,
    'https://1301.rpc.thirdweb.com',
    'https://unichain-sepolia-rpc.publicnode.com',
    'https://unichain-sepolia.drpc.org',
  ]),
  5318007: uniq([LASNA_RPC]),
};

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/** One request at a time per host: Blockscout answers a burst of parallel queries with 429. */
const hostQueue = new Map<string, Promise<unknown>>();
function serialise<T>(host: string, job: () => Promise<T>): Promise<T> {
  const previous = hostQueue.get(host) ?? Promise.resolve();
  const next = previous.then(job, job);
  hostQueue.set(host, next.catch(() => undefined));
  return next;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<SourceResult>>();

// Rough block time per chain, used to place a log in time when the RPC has no timestamp.
const BLOCK_SECONDS: Record<number, number> = { [baseSepolia.id]: 2, [unichainSepolia.id]: 1, 5318007: 1 };

// Base's publicnode accepts 50,000 blocks per call; Unichain's nodes cap at 1,000 (from sources.ts).
const initialLimit = (source: LogSource) => source.rangeLimit ?? (source.chainId === 5318007 ? 25_000 : 50_000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (ms: number) => ms + Math.random() * ms * 0.4;

type FailureKind = 'rate' | 'range' | 'pruned' | 'other';

class RpcFailure extends Error {
  kind: FailureKind;
  constructor(message: string, kind: FailureKind) {
    super(message);
    this.kind = kind;
  }
}

function classify(message: string, status?: number): FailureKind {
  if (status === 429 || /rate limit|too many requests|exceeded its request|request rate/i.test(message)) return 'rate';
  if (/pruned|missing trie node|cannot query|history unavailable/i.test(message)) return 'pruned';
  if (/range|maximum allowed number of requested blocks|exceeded maximum|response size|block limit|more than \d+ blocks/i.test(message)) return 'range';
  return 'other';
}

/** Minimal JSON-RPC call. Keeping the transport visible lets us tell 429 apart from a bad range. */
async function rpc(url: string, method: string, params: unknown[], timeoutMs = 20_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: { result?: unknown; error?: { message?: string; code?: number } };
    try {
      json = JSON.parse(text);
    } catch {
      throw new RpcFailure(`${method}: HTTP ${res.status}`, classify(text, res.status));
    }
    if (json.error) {
      const message = json.error.message ?? `RPC error ${json.error.code ?? ''}`.trim();
      throw new RpcFailure(message, classify(message, res.status));
    }
    if (!res.ok) throw new RpcFailure(`${method}: HTTP ${res.status}`, classify(text, res.status));
    return json.result;
  } catch (error) {
    if (error instanceof RpcFailure) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new RpcFailure(/abort/i.test(message) ? `${method}: timed out` : message, 'other');
  } finally {
    clearTimeout(timer);
  }
}

interface EndpointState { failures: number; coolUntil: number }
const endpointState = new Map<string, EndpointState>();

function availableEndpoint(chainId: number): string | undefined {
  const now = Date.now();
  return (RPC_ENDPOINTS[chainId] ?? []).find((url) => (endpointState.get(url)?.coolUntil ?? 0) <= now);
}

function coolDown(url: string) {
  const state = endpointState.get(url) ?? { failures: 0, coolUntil: 0 };
  state.failures += 1;
  state.coolUntil = Date.now() + Math.min(20_000, jitter(750 * 2 ** Math.min(state.failures, 4)));
  endpointState.set(url, state);
}

function warm(url: string) {
  const state = endpointState.get(url);
  if (state) {
    state.failures = 0;
    state.coolUntil = 0;
  }
}

async function headBlock(chainId: number): Promise<bigint | undefined> {
  for (const url of RPC_ENDPOINTS[chainId] ?? []) {
    try {
      const value = await rpc(url, 'eth_blockNumber', [], 10_000);
      warm(url);
      return BigInt(value as string);
    } catch {
      coolDown(url);
    }
  }
  return undefined;
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
    // A malformed/unknown log must never break the whole page.
    return [];
  }
}

function toLog(row: RawRpcLog | ExplorerLog): Log {
  return {
    address: row.address,
    topics: row.topics,
    data: row.data,
    blockNumber: BigInt(row.blockNumber),
    transactionHash: row.transactionHash,
    logIndex: Number(row.logIndex),
    removed: false,
  } as unknown as Log;
}

function newestFirst(a: DecodedEvent, b: DecodedEvent) {
  return a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber);
}

/**
 * One filtered history query on Blockscout. It serves the whole range in one call and gives
 * real block timestamps. A 429 is retried with backoff, then reported as a rate failure so
 * the caller can fall back to the RPCs instead of showing a red error.
 */
async function scanExplorer(source: LogSource): Promise<DecodedEvent[]> {
  const base = source.explorer;
  if (!base) throw new RpcFailure(`${source.key}: no explorer configured`, 'other');
  const url = `${base}/api?module=logs&action=getLogs&address=${source.address}&fromBlock=${source.fromBlock}&toBlock=latest`;

  const response = await serialise(base, async () => {
    let last = { status: 0, text: '' };
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      last = { status: res.status, text: await res.text() };
      if (last.status !== 429 && !/rate limit|too many requests/i.test(last.text)) return last;
      if (attempt < 2) await sleep(jitter(800 * 2 ** attempt));
    }
    return last;
  });

  if (response.status === 429) throw new RpcFailure('explorer rate limit', 'rate');
  if (!response.status || response.status >= 400) throw new RpcFailure(`explorer HTTP ${response.status}`, 'other');

  let json: { status?: string; message?: string; result?: unknown };
  try {
    json = JSON.parse(response.text);
  } catch {
    throw new RpcFailure('explorer returned a non-JSON answer', 'other');
  }

  const result = json.result;
  if (!Array.isArray(result)) {
    const text = typeof result === 'string' ? result : json.message ?? '';
    if (/rate limit|too many requests/i.test(text)) throw new RpcFailure(text, 'rate');
    if (/no (logs|records|result)|not found/i.test(text)) return [];
    throw new RpcFailure(`explorer: ${text || 'unexpected answer'}`, 'other');
  }
  if (json.status !== '1' && result.length === 0) return [];

  const rows = result as ExplorerLog[];
  const stamps = new Map(rows.map((row) => [`${row.transactionHash}-${Number(row.logIndex)}`, Number(row.timeStamp) * 1000]));
  const decoded = decode(source, rows.map(toLog)).map((log) => ({ ...log, ts: stamps.get(log.key) }));
  const merged = decoded.sort(newestFirst);
  const head = await headBlock(source.chainId);
  cache.set(source.key, {
    logs: merged,
    lastBlock: head ?? merged[0]?.blockNumber ?? source.fromBlock,
    complete: true,
  });
  persist(source);
  return merged;
}

/**
 * Chunked eth_getLogs from the deployment block with adaptive chunks, endpoint rotation and
 * backoff. It stops early (and reports `partial`) when every endpoint is cooling down or a
 * request budget is spent, so the UI can show what loaded and retry the rest later.
 */
async function scanRpc(source: LogSource, cached: CacheEntry | undefined, budgetMs = 25_000): Promise<SourceResult> {
  const latest = await headBlock(source.chainId);
  if (latest === undefined) {
    if (cached) return { logs: cached.logs, partial: true };
    throw new RpcFailure('No Unichain or Base RPC answered.', 'rate');
  }

  let from = cached ? cached.lastBlock + 1n : source.fromBlock;
  if (from > latest) {
    const entry: CacheEntry = { logs: cached?.logs ?? [], lastBlock: latest, complete: true };
    cache.set(source.key, entry);
    persist(source);
    return { logs: entry.logs, partial: false };
  }

  const out = new Map<string, DecodedEvent>();
  for (const log of cached?.logs ?? []) out.set(log.key, log);

  const started = Date.now();
  const headTs = Date.now();
  const blockSeconds = BLOCK_SECONDS[source.chainId] ?? 2;
  let chunk = BigInt(initialLimit(source));
  let lastOk = cached?.lastBlock ?? source.fromBlock - 1n;
  let requests = 0;
  let savedAt = 0;
  let windowFailures = 0;
  let partial = false;

  const remember = () => {
    const merged = [...out.values()].map((log) => ({
      ...log,
      ts: log.ts ?? (headTs - Number(latest - log.blockNumber) * blockSeconds * 1000),
    })).sort(newestFirst);
    cache.set(source.key, { logs: merged, lastBlock: lastOk, complete: lastOk >= latest });
    return merged;
  };

  while (from <= latest) {
    if (Date.now() - started > budgetMs || requests >= 140) { partial = true; break; }
    const url = availableEndpoint(source.chainId);
    if (!url) { partial = true; break; }

    const to = from + chunk - 1n > latest ? latest : from + chunk - 1n;
    try {
      const rows = (await rpc(url, 'eth_getLogs', [{
        address: source.address,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
      }])) as RawRpcLog[] | undefined;
      warm(url);
      for (const log of decode(source, (rows ?? []).map(toLog))) out.set(log.key, log);
      lastOk = to;
      from = to + 1n;
      requests += 1;
      windowFailures = 0;
      if (requests - savedAt >= 20) {
        const merged = remember();
        save(source, merged);
        savedAt = requests;
      }
    } catch (error) {
      const failure = error instanceof RpcFailure ? error : new RpcFailure(String(error), 'other');
      if (failure.kind === 'range' && chunk > 100n) {
        chunk = chunk / 2n;
        continue; // same window, smaller range
      }
      coolDown(url);
      windowFailures += 1;
      if (windowFailures >= 8) { partial = true; break; }
      await sleep(jitter(250));
      // Rotate to the next endpoint and retry this window.
    }
  }

  const merged = remember();
  save(source, merged);
  if (lastOk >= latest) return { logs: merged, partial: false };
  return { logs: merged, partial: partial || lastOk < latest };
}

/** localStorage cache, keyed by chain and contract, so a reload only scans new blocks. */
const STORAGE_PREFIX = 'ronin.logs.v1';
const storageKey = (source: LogSource) => `${STORAGE_PREFIX}:${source.chainId}:${source.address.toLowerCase()}`;

type Encoded = { __b: string };

function encode(value: unknown): unknown {
  if (typeof value === 'bigint') return { __b: value.toString() } satisfies Encoded;
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.__b === 'string') return BigInt(record.__b);
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, decodeValue(v)]));
  }
  return value;
}

function save(source: LogSource, logs: DecodedEvent[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    const entry = cache.get(source.key);
    if (!entry) return;
    const payload = JSON.stringify({
      lastBlock: entry.lastBlock.toString(),
      complete: entry.complete,
      logs: logs.slice(0, 800).map((log) => ({
        ...log,
        blockNumber: log.blockNumber.toString(),
        args: encode(log.args),
      })),
    });
    if (payload.length > 1_500_000) return;
    localStorage.setItem(storageKey(source), payload);
  } catch {
    // Private mode or a full quota: the in-memory cache still works for this tab.
  }
}

function persist(source: LogSource) {
  const entry = cache.get(source.key);
  if (entry) save(source, entry.logs);
}

function loadStored(source: LogSource): CacheEntry | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(storageKey(source));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { lastBlock?: string; complete?: boolean; logs?: unknown[] };
    if (!parsed.lastBlock || !Array.isArray(parsed.logs)) return undefined;
    const logs = parsed.logs.map((row) => {
      const log = row as Record<string, unknown>;
      return {
        ...log,
        blockNumber: BigInt(log.blockNumber as string),
        args: (decodeValue(log.args) ?? {}) as Record<string, unknown>,
      } as DecodedEvent;
    });
    return { logs, lastBlock: BigInt(parsed.lastBlock), complete: !!parsed.complete };
  } catch {
    return undefined;
  }
}

function freshest(source: LogSource): CacheEntry | undefined {
  const memory = cache.get(source.key);
  const stored = loadStored(source);
  const cached = !stored ? memory : !memory ? stored : stored.lastBlock > memory.lastBlock ? stored : memory;
  if (cached) cache.set(source.key, cached);
  return cached;
}

async function scanSource(source: LogSource): Promise<SourceResult> {
  const cached = freshest(source);

  if (cached) {
    let tail: SourceResult | undefined;
    try {
      tail = await scanRpc(source, cached);
    } catch {
      tail = undefined;
    }
    if (tail && !tail.partial) return tail;

    // The RPCs could not finish the scan; the explorer may still serve the whole history.
    try {
      const logs = await scanExplorer(source);
      return { logs, partial: false };
    } catch {
      return tail ?? { logs: cached.logs, partial: true };
    }
  }

  // A cold read: one Blockscout call beats hundreds of chunked RPC calls.
  try {
    const logs = await scanExplorer(source);
    return { logs, partial: false };
  } catch {
    // Fall through to the RPCs.
  }

  const rpcResult = await scanRpc(source, undefined);
  if (rpcResult.logs.length > 0 || !rpcResult.partial) return rpcResult;

  const message = `Could not read ${source.key} events from the explorer or any RPC.`;
  throw new Error(message);
}

/** Shared, deduplicated read: every component that asks for this source joins one scan. */
export function fetchSourceLogs(source: LogSource): Promise<SourceResult> {
  const running = pending.get(source.key);
  if (running) return running;
  const job = scanSource(source).finally(() => pending.delete(source.key));
  pending.set(source.key, job);
  return job;
}

export function clearLogCache() {
  cache.clear();
  endpointState.clear();
}
