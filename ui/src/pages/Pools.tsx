import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { SourceTag } from '../components/SourceTag';
import { Sparkline } from '../components/Sparkline';
import { chains, type Pool } from '../data/mock';
import { useNow } from '../hooks/useNow';
import { usePools, type LivePool } from '../hooks/usePools';
import { rel, usdc } from '../lib/format';
import { LIVE } from '../lib/mode';

const COLS = 'md:grid-cols-[1.6fr_.8fr_.9fr_.9fr_.9fr_1fr_110px]';
function risk(r: number): { tone: 'ok' | 'warn' | 'bad'; icon: IconName; text: string } {
  return r < 0.3 ? { tone: 'ok', icon: 'ok', text: 'Low risk' } : r < 0.6 ? { tone: 'warn', icon: 'pause', text: 'Medium risk' } : { tone: 'bad', icon: 'x', text: 'High risk' };
}

function Row({ p, now }: { p: Pool; now: number }) {
  const stale = p.ageSec > 300, use = p.flag === 'use', rk = risk(p.risk), ts = Date.now() - p.ageSec * 1000;
  return (
    <div className={`grid grid-cols-2 items-center gap-3.5 py-4 ${COLS} ${use ? '-mx-6 rounded-2xl bg-gradient-to-r from-teal/10 to-transparent px-6' : 'border-t border-line'}`}>
      <div><b>{p.name}</b>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill tone="mute">{p.badge}</Pill>
          {use && <Pill>Vault uses this</Pill>}
          {p.flag === 'frozen' && <Pill tone="bad" icon="pause">Frozen</Pill>}
          {p.flag === 'tripped' && <Pill tone="bad" icon="x">Tripped</Pill>}
          {stale && <Pill tone="mute">Stale</Pill>}
        </div></div>
      <div className={`text-2xl tracking-tight ${stale ? 'text-mut' : ''}`} title={`${p.apy.toFixed(4)}%`}>{p.apy.toFixed(2)}%{use && <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-acc"><Icon name="ok" size={12} />Best</span>}</div>
      <div>{p.util ? `${p.util}%${p.badge === 'Live Aave data' ? ' approx.' : ''}` : 'None'}</div>
      <div>{p.avg.toFixed(2)}%</div>
      <div><Pill tone={rk.tone} icon={rk.icon}>{rk.text}</Pill></div>
      <div className="text-[13px] text-mut">{stale && 'Last known, '}{rel(ts, now)}</div>
      <div><Sparkline data={p.series} /></div>
    </div>
  );
}

function LiveRow({ p }: { p: LivePool }) {
  return (
    <div className={`grid grid-cols-2 items-center gap-3.5 py-4 ${COLS} ${p.vaultBalance > 0 ? '-mx-6 rounded-2xl bg-gradient-to-r from-teal/10 to-transparent px-6' : 'border-t border-line'}`}>
      <div><b>{p.name}</b><div className="mt-1.5 flex flex-wrap gap-1.5"><Pill tone="mute">{p.chain}</Pill>{p.vaultBalance > 0 && <Pill>Vault uses this</Pill>}</div></div>
      <div className="text-2xl tracking-tight">{(p.rateBps / 100).toFixed(2)}%</div>
      <div>{p.utilizationBps ? `${(p.utilizationBps / 100).toFixed(0)}%` : 'None'}</div>
      <div className="text-mut">not computed</div>
      <div className="text-mut">not computed</div>
      <div className="text-[13px] text-mut">read now</div>
      <div className="text-[13px] text-mut">{p.vaultBalance > 0 ? `${usdc(p.vaultBalance / 1e6)} USDC` : 'No history'}</div>
    </div>
  );
}

function LivePools() {
  const live = usePools();
  return (
    <>
      <div className="mt-3"><SourceTag kind="live" source="pool.name(), rateBps(), utilizationBps(), balanceOf(vault)" /></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card><div className="text-[13px] text-mut">Best rate across both chains</div><div className="my-2 text-[54px] leading-none tracking-[-0.045em]">{live.best ? `${(live.best.rateBps / 100).toFixed(2)}%` : live.loading ? 'Reading…' : '—'}</div><div className="text-[13px] text-mut">{live.best ? `${live.best.name} on ${live.best.chain}` : 'No live pool read'}</div></Card>
        <Card><div className="text-[13px] text-mut">Your vault uses</div><div className="my-2 text-[54px] leading-none tracking-[-0.045em]">{live.inUse && live.inUse.vaultBalance > 0 ? live.inUse.name : '—'}</div><div className="text-[13px] text-mut">{live.inUse && live.inUse.vaultBalance > 0 ? `${usdc(live.inUse.vaultBalance / 1e6)} USDC read from the pool` : 'No pool balance is indexed'}</div></Card>
      </div>
      {live.error && <Card className="mt-4 text-red">Pool read failed. No fallback sample rates are shown.</Card>}
      {['Base Sepolia', 'Unichain Sepolia'].map((chain) => {
        const rows = live.pools.filter((p) => p.chain === chain);
        return <Card key={chain} className="mt-4">
          <div className="flex items-center justify-between"><h3 className="text-lg font-medium tracking-tight">{chain}</h3><span className="text-[13px] text-mut">{rows.length} pools</span></div>
          <div className={`hidden gap-3.5 pb-1 pt-2 text-[13px] text-mut md:grid ${COLS}`}><span>Pool</span><span>Rate</span><span>Utilisation</span><span>Smoothed rate</span><span>Risk</span><span>Updated</span><span>Vault balance</span></div>
          {rows.map((p) => <LiveRow key={p.address} p={p} />)}
          {rows.length === 0 && <p className="border-t border-line py-4 text-[13px] text-mut">No pool addresses configured for this chain.</p>}
        </Card>;
      })}
    </>
  );
}

export default function Pools() {
  const now = useNow();
  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Pools and rates</h1>
      <p className="mt-1.5 max-w-[620px] text-mut">Rates are annual. Every figure says where it comes from, and old numbers are never shown as live.</p>
      {LIVE ? <LivePools /> : <>
      <div className="mt-3"><SourceTag kind="sample" reason="the live pool reader is disabled without a configured vault" /></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card><div className="text-[13px] text-mut">Best rate across both chains</div><div className="my-2 text-[54px] leading-none tracking-[-0.045em]">7.42%</div><div className="text-[13px] text-mut">Pool B on Base Sepolia, a mock pool for the demo</div></Card>
        <Card><div className="text-[13px] text-mut">Your vault uses</div><div className="my-2 text-[54px] leading-none tracking-[-0.045em]">Pool B</div><div className="text-[13px] text-mut">It already holds the best rate, so no move is needed.</div></Card>
      </div>
      {chains.map((c) => (
        <Card key={c.name} className="mt-4">
          <div className="flex items-center justify-between"><h3 className="text-lg font-medium tracking-tight">{c.name}</h3><span className="text-[13px] text-mut">{c.pools.length} pools</span></div>
          <div className={`hidden gap-3.5 pb-1 pt-2 text-[13px] text-mut md:grid ${COLS}`}><span>Pool</span><span>Rate</span><span>Utilisation</span><span>Smoothed rate</span><span>Risk</span><span>Updated</span><span>Recent rates</span></div>
          {c.pools.map((p) => <Row key={p.name} p={p} now={now} />)}
        </Card>
      ))}
      </>}
    </main>
  );
}
