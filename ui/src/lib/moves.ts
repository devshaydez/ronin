import { BASE, LASNA_CHAIN_ID, UNICHAIN, type ChainDeployment } from './deployments';
import type { DecodedEvent } from './logs';

const n = (v: unknown) => Number(v ?? 0);

export interface MoveRow {
  key: string;
  chain: ChainDeployment;
  verdictId: number;
  toPool: `0x${string}`;
  toPoolName?: string;
  moved: bigint;
  deployed: bigint;
  /** Event timestamp, already anchored to the head block by the log reader. */
  ts?: number;
  blockNumber: bigint;
  tx: `0x${string}`;
  verdict?: {
    confidenceBps: number;
    tx: `0x${string}`;
    ts?: number;
    reasoningHash: `0x${string}`;
    reasoning?: string;
  };
  /** Gap at decision time. Preferred source is the RSC's RebalanceRequested. */
  gapBps?: number;
  gapSource?: 'reactive' | 'request';
  reactiveTx?: `0x${string}`;
  latencySecs?: number;
  /** Demo-only fields. Live rows never get these because Rebalanced does not carry them. */
  sample?: boolean;
  fromPoolName?: string;
  beforeAlloc?: string;
  afterAlloc?: string;
  gate?: string;
}

/** Joins each Rebalanced event with the verdict, reasoning and RSC events for the same loop. */
export function buildMoves(logs: DecodedEvent[], pools: { address: string; name: string }[]): MoveRow[] {
  const nameOf = (address: string) => pools.find((p) => p.address.toLowerCase() === address.toLowerCase())?.name;
  const moveLogs = logs.filter(
    (l) => l.eventName === 'Rebalanced' && (l.chainId === BASE.chainId || l.chainId === UNICHAIN.chainId),
  );

  return moveLogs
    .map((log): MoveRow => {
      const chain = log.chainId === BASE.chainId ? BASE : UNICHAIN;
      const verdictId = n(log.args.verdictId);
      const verdict = logs.find(
        (l) => l.eventName === 'VerdictPosted' && l.chainId === log.chainId && n(l.args.id) === verdictId,
      );
      const reasoning = logs.find(
        (l) => l.eventName === 'VerdictReasoning' && l.chainId === log.chainId && n(l.args.id) === verdictId,
      );
      const request = verdict
        ? logs.find(
            (l) => l.eventName === 'DecisionRequested' && l.chainId === log.chainId && n(l.args.id) === n(verdict.args.requestId),
          )
        : undefined;
      const reactive = logs.find(
        (l) =>
          l.chainId === LASNA_CHAIN_ID &&
          l.eventName === 'RebalanceRequested' &&
          n(l.args.chainId) === log.chainId &&
          n(l.args.verdictId) === verdictId,
      );
      const loop = logs.find(
        (l) =>
          l.chainId === LASNA_CHAIN_ID &&
          l.eventName === 'LoopClosed' &&
          n(l.args.chainId) === log.chainId &&
          n(l.args.verdictId) === verdictId,
      );
      const toPool = String(log.args.toPool) as `0x${string}`;
      const gapBps = reactive ? n(reactive.args.gapBps) : request ? n(request.args.gapBps) : undefined;

      return {
        key: log.key,
        chain,
        verdictId,
        toPool,
        toPoolName: nameOf(toPool),
        moved: BigInt((log.args.moved as bigint | undefined) ?? 0n),
        deployed: BigInt((log.args.deployed as bigint | undefined) ?? 0n),
        ts: log.ts,
        blockNumber: log.blockNumber,
        tx: log.transactionHash,
        verdict: verdict
          ? {
              confidenceBps: n(verdict.args.confidenceBps),
              tx: verdict.transactionHash,
              ts: verdict.ts,
              reasoningHash: String(verdict.args.reasoningHash) as `0x${string}`,
              reasoning: reasoning ? String(reasoning.args.reasoning) : undefined,
            }
          : undefined,
        gapBps,
        gapSource: reactive ? 'reactive' : request ? 'request' : undefined,
        reactiveTx: reactive?.transactionHash,
        latencySecs: loop ? n(loop.args.requestToRebalanceSecs) : undefined,
      };
    })
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}

/** Explicitly labelled sample rows for demo mode; never merged into a live read. */
export const SAMPLE_MOVES: MoveRow[] = [
  {
    key: 'sample-46',
    chain: BASE,
    verdictId: 46,
    toPool: '0x00000000000000000000000000000000000000B2',
    toPoolName: 'Pool B',
    moved: 620_000_000n,
    deployed: 640_000_000n,
    ts: Date.now() - 2 * 60_000,
    blockNumber: 62_701_204n,
    tx: '0x5a4d5d9c9c3d9c1d0e3a1c7f5b1e8f7a9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
    verdict: {
      confidenceBps: 9100,
      tx: '0x1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01',
      ts: Date.now() - 2 * 60_000 - 18_000,
      reasoningHash: '0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999',
      reasoning: 'Pool B pays 3.3 points more on the same asset and its utilisation is still below the risk cap.',
    },
    gapBps: 332,
    gapSource: 'reactive',
    reactiveTx: '0x2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012',
    latencySecs: 19,
    sample: true,
    fromPoolName: 'Pool A',
    beforeAlloc: '40% Pool A · 60% Pool B',
    afterAlloc: '0% Pool A · 100% Pool B',
    gate: 'Passed (sample)',
  },
  {
    key: 'sample-45',
    chain: UNICHAIN,
    verdictId: 45,
    toPool: '0x00000000000000000000000000000000000000D4',
    toPoolName: 'Pool D',
    moved: 210_000_000n,
    deployed: 220_000_000n,
    ts: Date.now() - 9 * 60_000,
    blockNumber: 68_620_331n,
    tx: '0x6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4',
    verdict: {
      confidenceBps: 8400,
      tx: '0x7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5',
      ts: Date.now() - 9 * 60_000 - 24_000,
      reasoningHash: '0xbbbbccccddddeeeeffff0000111122223333444455556666777788889999aaaa',
      reasoning: 'Pool E utilisation is above its cap and its rate has fallen below the cross-chain best.',
    },
    gapBps: 210,
    gapSource: 'reactive',
    reactiveTx: '0x8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6',
    latencySecs: 26,
    sample: true,
    fromPoolName: 'Pool E',
    beforeAlloc: '30% Pool D · 70% Pool E',
    afterAlloc: '55% Pool D · 45% Pool E',
    gate: 'Passed (sample)',
  },
];

export const SAMPLE_MOVE_POOLS: { address: string; name: string; chain: 'Base Sepolia' | 'Unichain Sepolia'; vaultBalance: number }[] = [
  { address: '0x00000000000000000000000000000000000000A1', name: 'Pool A', chain: 'Base Sepolia', vaultBalance: 180 },
  { address: '0x00000000000000000000000000000000000000B2', name: 'Pool B', chain: 'Base Sepolia', vaultBalance: 620 },
  { address: '0x00000000000000000000000000000000000000D4', name: 'Pool D', chain: 'Unichain Sepolia', vaultBalance: 220 },
];
