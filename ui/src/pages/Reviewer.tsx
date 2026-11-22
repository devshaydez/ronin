import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { Segmented } from '../components/Segmented';
import { Sparkline } from '../components/Sparkline';
import { BRK, LANES, proofRows, REB, RES } from '../data/pipeline';
import { useNow } from '../hooks/useNow';
import { rel } from '../lib/format';
import { useApp } from '../state/AppState';

type Tab = 'proof' | 'ops' | 'demo';

function Proof() {
  const { loops, toast } = useApp();
  const now = useNow();
  const done = loops.filter((l) => !l.running);
  function copy() {
    const md = done.map((l) => `### ${l.name} (${l.latency.toFixed(1)} s)\n\n| Step | Chain | Time | Transaction |\n|---|---|---|---|\n` +
      proofRows(l.steps).map(([label, i]) => `| ${label} | ${LANES[l.steps[i].lane]} | ${new Date(l.ts[i]).toISOString()} | ${l.hashes[i]} |`).join('\n')).join('\n\n');
    navigator.clipboard?.writeText(md); toast('Proof copied as Markdown');
  }
  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-lg font-medium tracking-tight">Every loop, with its receipts</h3><Button small onClick={copy}>Copy as Markdown</Button></div>
      {done.map((l) => (
        <Card key={l.id} className="mt-3.5">
          <div className="flex items-center justify-between"><b className="text-lg font-medium">{l.name}</b><Pill icon="ok">{l.latency.toFixed(1)} s</Pill></div>
          <div className="mt-2">
            {proofRows(l.steps).map(([label, i]) => {
              const lane = l.steps[i].lane;
              return (
                <div key={label} className="grid grid-cols-2 items-center gap-3 border-t border-line py-3 text-sm first:border-0 sm:grid-cols-[110px_1.2fr_1fr_auto]">
                  <span className="text-mut">{label}</span><span>{LANES[lane]}</span>
                  <span className="text-mut" title={new Date(l.ts[i]).toLocaleString()}>{rel(l.ts[i], now)}</span>
                  <a href="#" className="text-acc">{l.hashes[i]} View on {lane === 1 ? 'Reactscan' : 'explorer'}</a>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
}

function Stat({ label, source, value, sub, extra }: { label: string; source: string; value: ReactNode; sub: ReactNode; extra?: ReactNode }) {
  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between"><span className="text-[13px] text-mut">{label}</span><Pill tone="mute">{source}</Pill></div>
      <div className="my-2 text-4xl tracking-[-0.045em]">{value}</div>
      <div className="flex items-center justify-between gap-2 text-[13px]"><span className="text-mut">{sub}</span>{extra}</div>
    </Card>
  );
}

function Ops() {
  const { debt, toggleDebt } = useApp();
  const now = useNow();
  const under = debt > 0;
  const tick = Date.now() - 38e3;
  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-lg font-medium tracking-tight">Is the automation funded and running?</h3><Button small variant="outline" onClick={toggleDebt}>{under ? 'Restore funding' : 'Simulate underfunded'}</Button></div>
      {under && <Banner tone="error"><b>Automation is paused until funded.</b> Debt is 0.35 REACT. Payouts and rebalances wait until it is cleared. Reviewer view only.</Banner>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Stat label="Automation funding" source="On-chain" value={<>{under ? '0.00' : '4.20'} <span className="text-base text-mut">REACT</span></>} sub={`Debt ${under ? '0.35' : '0.00'} REACT`} extra={under ? <Pill tone="bad" icon="x">Underfunded</Pill> : <Pill icon="ok">Funded</Pill>} />
        <Stat label="Last scheduled tick" source="On-chain" value={rel(tick, now)} sub="Runs every 60 seconds" extra={under ? <Pill tone="warn" icon="pause">Waiting</Pill> : <Pill icon="ok">On time</Pill>} />
        <Stat label="Subscriptions" source="On-chain" value={`${under ? 0 : 6} of 6 active`} sub="Vault, requester, registry on 2 chains" />
        <Stat label="Pending actions" source="On-chain" value={under ? 4 : 1} sub="Stuck: 0" extra={<Pill icon="ok">None stuck</Pill>} />
        <Stat label="AI service" source="Status service" value="Running" sub="Last answer 3.4 s" extra={<Pill icon="ok">Reachable</Pill>} />
        <Stat label="Recent AI latency" source="Status service" value={<>3.4 <span className="text-base text-mut">s median</span></>} sub="Last 7 answers" extra={<div className="w-24"><Sparkline data={[2.9, 3.4, 3.1, 3.8, 3.4, 3.2, 3.4]} /></div>} />
      </div>
    </>
  );
}

function Demo() {
  const { demoFlag, setDemoFlag, adjustWallet, toast, setMode, runLoop } = useApp();
  const go = useNavigate();
  const items = [
    { t: 'Mint test USDC', d: '1,000 test USDC arrives in your wallet.', note: 'You stay on this screen.', b: 'Mint 1,000 test USDC', f: () => { adjustWallet(1000); toast('Minted 1,000 test USDC'); } },
    { t: 'Spike a pool rate', d: 'Pool A jumps to 9.10%. Ronin scores it, the AI reviews it, and the vault moves your money.', note: 'You go to Pipeline and watch it run.', b: 'Spike Pool A rate', f: () => { go('/app/pipeline'); runLoop(REB, 'AI-gated rebalance'); } },
    { t: 'Push utilisation to breaker level', d: 'Pool E utilisation goes to 94%. The breaker trips and vaults on the other chain pause.', note: 'You go to Pipeline and watch it run.', b: 'Trip the breaker', f: () => { setMode('paused'); go('/app/pipeline'); runLoop(BRK, 'Safety: breaker trips'); } },
    { t: 'Restore normal', d: 'Rates and utilisation return to normal and the paused vault resumes by itself.', note: 'You go to Pipeline and watch it run.', b: 'Restore normal', f: () => { setMode('rec'); go('/app/pipeline'); runLoop(RES, 'Safety: back to normal', () => setMode('ok')); } },
  ];
  return (
    <>
      <Banner action={<Segmented id="flag" value={demoFlag ? 'on' : 'off'} onChange={(v) => setDemoFlag(v === 'on')} options={[{ value: 'on', label: 'Flag on' }, { value: 'off', label: 'Flag off' }]} />}><b>Testnet only.</b> These controls exist for the demo and stay behind a flag.</Banner>
      {demoFlag ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {items.map((x) => <Card key={x.t}><h3 className="text-lg font-medium tracking-tight">{x.t}</h3><p className="my-2 text-mut">{x.d}</p><p className="mb-4 text-[13px] text-mut">{x.note}</p><Button onClick={x.f}>{x.b}</Button></Card>)}
        </div>
      ) : <Card className="mt-3.5"><b>Demo controls are hidden.</b><p className="mt-1.5 text-mut">Turn the demo flag on to use them. They never appear on a live deployment.</p></Card>}
    </>
  );
}

export default function Reviewer() {
  const [tab, setTab] = useState<Tab>('proof');
  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Reviewer tools</h1>
        <Segmented id="rv" value={tab} onChange={setTab} options={[{ value: 'proof', label: 'Proof' }, { value: 'ops', label: 'Operations health' }, { value: 'demo', label: 'Demo controls' }]} />
      </div>
      <p className="mt-1.5 max-w-[620px] text-mut">For builders and judges. Addresses, hashes and health data.</p>
      {tab === 'proof' && <Proof />}{tab === 'ops' && <Ops />}{tab === 'demo' && <Demo />}
    </main>
  );
}
