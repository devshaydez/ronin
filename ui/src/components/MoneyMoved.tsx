import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { Card } from './Card';
import { Pill } from './Pill';
import { SourceTag } from './SourceTag';
import { useNow } from '../hooks/useNow';
import type { LivePool } from '../hooks/usePools';
import { bps, rel, shortAddr, usdc } from '../lib/format';
import { explorerTx } from '../lib/deployments';
import type { MoveRow } from '../lib/moves';

const COLORS = ['#38d6c4', '#8b7cf6', '#f0b35b', '#5aa9e6', '#e879a6', '#9fd356'];

const amount = (v: bigint) => usdc(Number(formatUnits(v, 6)));

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <div className="text-mut">{label}</div>
      <div className="mt-0.5 break-words">{value}</div>
    </div>
  );
}

/**
 * Live rows only show fields the events carry. Rebalanced has verdictId, toPool,
 * moved and deployed; everything else is marked "not recorded" rather than inferred.
 * Demo rows are explicitly labelled SAMPLE and never borrow live receipt links.
 */
export function MoneyMoved({
  moves,
  pools,
  loading,
  error,
  note,
  demo = false,
  limit = 3,
}: {
  moves: MoveRow[];
  pools: Pick<LivePool, 'address' | 'name' | 'chain' | 'vaultBalance'>[];
  loading?: boolean;
  error?: string;
  note?: string;
  demo?: boolean;
  limit?: number;
}) {
  const now = useNow();
  const shown = moves.slice(0, limit);
  const latest = shown[0];
  const highlight = latest?.toPool;
  const deployed = pools.reduce((sum, p) => sum + p.vaultBalance, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium tracking-tight">Money moved</h3>
        {demo ? (
          <SourceTag kind="sample" reason="labelled sample moves; the live event reader is off" />
        ) : (
          <SourceTag kind="live" source="Rebalanced · VerdictPosted · RebalanceRequested" />
        )}
      </div>
      <p className="mt-1 max-w-[720px] text-[13px] text-mut">
        In live mode each move is read from the vault&apos;s <code>Rebalanced</code> event and joined to the verdict
        that allowed it. Fields the event does not carry are marked <b>not recorded</b>; nothing is estimated.
        Sample rows are labelled and are not chain data.
      </p>

      {!demo && loading && shown.length === 0 && <p className="mt-3 text-[13px] text-mut">Reading vault, registry and Reactive events…</p>}
      {!demo && error && shown.length === 0 && <p className="mt-3 text-[13px] text-red">Could not read moves: {error}</p>}
      {!demo && note && <p className="mt-2 text-[13px] text-amb">{note}</p>}
      {!demo && !loading && !error && shown.length === 0 && (
        <p className="mt-3 text-[13px] text-mut">
          No <code>Rebalanced</code> event since deployment yet. When the AI and the vault complete a move, it appears here.
        </p>
      )}

      {shown.map((m) => (
        <div key={m.key} className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <b className="font-medium">Verdict #{m.verdictId}</b>
              <Pill tone="mute">{m.chain.name}</Pill>
              {m.sample && <Pill tone="mute">SAMPLE</Pill>}
            </div>
            <span className="text-[13px] text-mut" title={m.ts ? new Date(m.ts).toLocaleString() : 'event timestamp not recorded'}>
              {m.ts ? rel(m.ts, now) : 'time not recorded'}
            </span>
          </div>

          <div className="mt-3 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl border border-line bg-c2/40 px-3 py-2">
              <div className="text-[12px] uppercase tracking-wide text-mut">From</div>
              <div className="mt-0.5">{m.fromPoolName ?? <span className="text-mut">not recorded</span>}</div>
              <div className="text-[12px] text-mut">{m.fromPoolName ? 'Sample source pool' : 'Rebalanced names only the destination'}</div>
            </div>
            <div className="grid place-items-center text-mut" aria-hidden>→</div>
            <div className="rounded-xl border border-teal/40 bg-teal/10 px-3 py-2">
              <div className="text-[12px] uppercase tracking-wide text-mut">To</div>
              <div className="mt-0.5">{m.toPoolName ?? shortAddr(m.toPool)}</div>
              <div className="text-[12px] text-mut">{shortAddr(m.toPool)}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            <span><span className="text-mut">Moved </span><b>{amount(m.moved)} USDC</b></span>
            <span><span className="text-mut">Deployed </span><b>{amount(m.deployed)} USDC</b></span>
            <span className="text-mut" title="Rebalanced only carries moved and deployed">Before/after allocation: {m.sample ? '' : 'not recorded'}{m.sample && <b className="text-ink">{m.beforeAlloc} → {m.afterAlloc}</b>}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line p-3 text-[13px] sm:grid-cols-4">
            <Fact
              label="Rate gap"
              value={m.gapBps === undefined ? 'not recorded' : `${m.gapBps} bps · ${bps(m.gapBps)} APY`}
              title={m.gapSource === 'reactive' ? 'From the RSC RebalanceRequested event' : m.gapSource === 'request' ? 'From DecisionRequested at verdict time' : 'No RebalanceRequested or DecisionRequested event was found'}
            />
            <Fact
              label="Verdict confidence"
              value={m.verdict ? `${(m.verdict.confidenceBps / 100).toFixed(0)}%` : 'not recorded'}
              title="VerdictPosted.confidenceBps"
            />
            <Fact
              label="Profit gate"
              value={m.sample ? (m.gate ?? 'sample') : 'not recorded'}
              title={m.sample ? 'Sample row' : 'Rebalanced does not carry a profit-gate result'}
            />
            <Fact
              label="Verdict age"
              value={m.verdict?.ts ? rel(m.verdict.ts, now) : 'not recorded'}
              title={m.verdict?.ts ? new Date(m.verdict.ts).toLocaleString() : undefined}
            />
          </div>

          <p className="mt-3 text-[13px]">
            <span className="text-mut">AI reason: </span>
            {m.verdict?.reasoning ?? (m.verdict ? `not recorded; only the reasoning hash ${shortAddr(m.verdict.reasoningHash)} was posted` : 'not recorded')}
          </p>

          {!m.sample && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <a href={explorerTx(m.chain.chain, m.tx)} target="_blank" rel="noreferrer" className="text-acc hover:underline">Rebalanced receipt · Blockscout</a>
              {m.verdict && <a href={explorerTx(m.chain.chain, m.verdict.tx)} target="_blank" rel="noreferrer" className="text-acc hover:underline">Verdict receipt · Blockscout</a>}
              {m.reactiveTx && <a href={explorerTx('lasna', m.reactiveTx)} target="_blank" rel="noreferrer" className="text-acc hover:underline">Reactive request · Reactscan</a>}
            </div>
          )}
          {m.sample && <p className="mt-3 text-[13px] text-mut">Sample receipt; no explorer link is fabricated for demo data.</p>}
        </div>
      ))}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[13px] text-mut">Current allocation across pools</div>
          <div className="text-[13px] text-mut">
            {demo ? 'Sample balances' : `${deployed > 0 && deployed < 0.01 ? 'less than 0.01' : usdc(deployed)} USDC deployed · pool.balanceOf(vault)`}
          </div>
        </div>
        <AllocationBar pools={pools} highlight={highlight} pulseKey={latest?.key ?? 'empty'} />
        <p className="mt-2 text-[12px] text-mut">
          {demo
            ? 'The bar is sample data; the highlighted pool is the sample destination.'
            : 'The bar animates only when a new Rebalanced event arrives. It shows the allocation that produced the move, not a reconstructed history.'}
        </p>
      </div>
    </Card>
  );
}

function AllocationBar({
  pools,
  highlight,
  pulseKey,
}: {
  pools: Pick<LivePool, 'address' | 'name' | 'chain' | 'vaultBalance'>[];
  highlight?: string;
  pulseKey: string;
}) {
  const shown = pools.filter((p) => p.vaultBalance > 0);
  const total = shown.reduce((sum, p) => sum + p.vaultBalance, 0);
  if (total <= 0) {
    return <p className="mt-3 text-[13px] text-mut">No pool holds this vault&apos;s USDC right now.</p>;
  }
  return (
    <div key={pulseKey}>
      <div className="mt-2 flex h-3.5 w-full overflow-hidden rounded-full bg-c2">
        {shown.map((p, i) => (
          <motion.div
            key={p.address}
            initial={{ width: 0 }}
            animate={{ width: `${(p.vaultBalance / total) * 100}%`, opacity: highlight === p.address ? 1 : 0.78 }}
            transition={{ duration: 0.8, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: COLORS[i % COLORS.length] }}
            title={`${p.name} on ${p.chain}: ${usdc(p.vaultBalance)} USDC`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {shown.map((p, i) => (
          <span key={p.address} className={highlight === p.address ? 'font-medium text-ink' : 'text-mut'}>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLORS[i % COLORS.length] }} />
            {p.name} · {((p.vaultBalance / total) * 100).toFixed(1)}%
            {highlight === p.address && <span className="ml-1.5 rounded-full bg-teal/15 px-2 py-0.5 text-[11px] text-acc">new move</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
