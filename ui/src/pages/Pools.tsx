import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { Sparkline } from '../components/Sparkline';
import { chains, type Pool } from '../data/mock';
import { useNow } from '../hooks/useNow';
import { rel } from '../lib/format';

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

export default function Pools() {
  const now = useNow();
  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Pools and rates</h1>
      <p className="mt-1.5 max-w-[620px] text-mut">Rates are annual. Every figure says where it comes from, and old numbers are never shown as live.</p>
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
    </main>
  );
}
