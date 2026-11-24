import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LatencyBreakdown } from '../components/LatencyBreakdown';
import { Pill } from '../components/Pill';
import { Segmented } from '../components/Segmented';
import { SourceTag } from '../components/SourceTag';
import { Sparkline } from '../components/Sparkline';
import { MEASURED_PROOF } from '../data/proof';
import { BRK, LANES, proofRows, REB, REC, RES } from '../data/pipeline';
import { useNow } from '../hooks/useNow';
import { rel } from '../lib/format';
import { LIVE, PROOF_URL, explorerTx } from '../lib/mode';
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
      <div className="mt-5"><LatencyBreakdown compact /></div>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium tracking-tight">Measured deployment receipts</h3><SourceTag kind="proof" /></div>
        <p className="mt-2 max-w-[760px] text-[13px] text-mut">Phase B2 run on 2026-11-23. This block is a static evidence report, not a live refetch. The 683 s verdict-44 retry is recovery, not loop speed, and is excluded from the medians above.</p>
        <div className="mt-2">
          {MEASURED_PROOF.map((r) => (
            <div key={r.hash} className="grid grid-cols-2 items-center gap-3 border-t border-line py-3 text-sm first:border-0 sm:grid-cols-[1.3fr_1fr_auto]">
              <span>{r.label}</span><span className="text-mut">{r.chainName}{r.block ? `, block ${r.block}` : ''}</span>
              <a href={explorerTx(r.chain, r.hash)} target="_blank" rel="noreferrer" className="text-acc">{r.hash.slice(0, 8)}…{r.hash.slice(-6)}</a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-mut"><a href={PROOF_URL} target="_blank" rel="noreferrer" className="text-acc hover:underline">Open the full PROOF.md report.</a></p>
      </Card>
      {!LIVE && <>
        <div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-lg font-medium tracking-tight">Demo replay loops</h3><div className="flex items-center gap-2"><SourceTag kind="sample" reason="demo replay; hashes are not transactions" /><Button small onClick={copy}>Copy as Markdown</Button></div></div>
        {done.map((l) => (
          <Card key={l.id} className="mt-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-lg font-medium">{l.name}</b><Pill tone={l.kind === 'recovery' ? 'warn' : 'ok'}>{l.kind === 'recovery' ? `Recovery, ${l.latency.toFixed(1)} s` : `${l.latency.toFixed(1)} s`}</Pill></div>
            {l.kind === 'recovery' && <p className="mt-2 text-[13px] text-mut">Excluded from the normal-loop median above. Recovery includes the pause and the admin unpause, not just the automated loop.</p>}
            <div className="mt-2">
              {proofRows(l.steps).map(([label, i]) => {
                const lane = l.steps[i].lane;
                return (
                  <div key={label} className="grid grid-cols-2 items-center gap-3 border-t border-line py-3 text-sm first:border-0 sm:grid-cols-[110px_1.2fr_1fr_auto]">
                    <span className="text-mut">{label}</span><span>{LANES[lane]}</span>
                    <span className="text-mut" title={new Date(l.ts[i]).toLocaleString()}>{rel(l.ts[i], now)}</span>
                    <span className="text-mut" title="Demo placeholder, not an on-chain transaction">{l.hashes[i]}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </>}
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
  if (LIVE) {
    return <Card className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium tracking-tight">Operations health</h3><Pill tone="mute">Not connected</Pill></div><p className="mt-2 max-w-[700px] text-[13px] text-mut">No live status service is configured in this build, so no sample funding, subscription or model-latency figures are shown in live mode. The measured model-call median is in the proof block above and in <a href={PROOF_URL} target="_blank" rel="noreferrer" className="text-acc hover:underline">PROOF.md</a>.</p></Card>;
  }
  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-lg font-medium tracking-tight">Is the automation funded and running?</h3><Button small variant="outline" onClick={toggleDebt}>{under ? 'Restore funding' : 'Simulate underfunded'}</Button></div>
      <div className="mt-3"><SourceTag kind="sample" reason="operations status and funding are not read in this UI build" /></div>
      {under && <Banner tone="error"><b>Automation is paused until funded.</b> Debt is 0.35 REACT. Payouts and rebalances wait until it is cleared. Reviewer view only.</Banner>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Stat label="Automation funding" source="SAMPLE" value={<>{under ? '0.00' : '4.20'} <span className="text-base text-mut">REACT</span></>} sub={`Debt ${under ? '0.35' : '0.00'} REACT`} extra={under ? <Pill tone="bad" icon="x">Underfunded</Pill> : <Pill icon="ok">Funded</Pill>} />
        <Stat label="Last scheduled tick" source="SAMPLE" value={rel(tick, now)} sub="Runs every 60 seconds" extra={under ? <Pill tone="warn" icon="pause">Waiting</Pill> : <Pill icon="ok">On time</Pill>} />
        <Stat label="Subscriptions" source="SAMPLE" value={`${under ? 0 : 6} of 6 active`} sub="Vault, requester, registry on 2 chains" />
        <Stat label="Pending actions" source="SAMPLE" value={under ? 4 : 1} sub="Stuck: 0" extra={<Pill icon="ok">None stuck</Pill>} />
        <Stat label="AI service" source="SAMPLE" value="Running" sub="Last model call 12.0 s" extra={<Pill icon="ok">Reachable</Pill>} />
        <Stat label="AI model call" source="PROOF" value={<>12.0 <span className="text-base text-mut">s median</span></>} sub="Measured normal loops on 2026-11-22 deployment" extra={<div className="w-24"><Sparkline data={[11.2, 9.3, 13.6, 11.1, 13.3, 11.0, 12.0]} /></div>} />
      </div>
    </>
  );
}

function Demo() {
  const { demoFlag, setDemoFlag, adjustWallet, toast, setMode, runLoop } = useApp();
  const go = useNavigate();
  if (LIVE) return <Card className="mt-5"><b>Demo controls are disabled.</b><p className="mt-1.5 text-mut">Live mode never exposes seeded loops, minting or breaker replay.</p></Card>;
  const items = [
    { t: 'Mint test USDC', d: '1,000 test USDC arrives in your wallet.', note: 'You stay on this screen.', b: 'Mint 1,000 test USDC', f: () => { adjustWallet(1000); toast('Minted 1,000 test USDC'); } },
    { t: 'Spike a pool rate', d: 'Pool A jumps to 9.10%. Ronin scores it, the AI reviews it, and the vault moves your money.', note: 'You go to Pipeline and watch it run.', b: 'Spike Pool A rate', f: () => { go('/app/pipeline'); runLoop(REB, 'AI-gated rebalance'); } },
    { t: 'Push utilisation to breaker level', d: 'Pool E utilisation goes to 94%. The breaker trips and vaults on the other chain pause.', note: 'You go to Pipeline and watch it run.', b: 'Trip the breaker', f: () => { setMode('paused'); go('/app/pipeline'); runLoop(BRK, 'Safety: breaker trips'); } },
    { t: 'Restore normal', d: 'Rates and utilisation return to normal and the paused vault resumes by itself.', note: 'You go to Pipeline and watch it run.', b: 'Restore normal', f: () => { setMode('rec'); go('/app/pipeline'); runLoop(RES, 'Safety: back to normal', () => setMode('ok')); } },
    { t: 'Replay the retry that healed', d: 'The first callback hit a paused vault. An admin unpauses, then the RSC retries attempt 2 of 3 and the move completes.', note: 'You go to Pipeline. This is labelled recovery time, not speed.', b: 'Run retry demo', f: () => { go('/app/pipeline'); runLoop(REC, 'Retry that healed (verdict 44)', undefined, 'recovery'); } },
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
        <Segmented id="rv" value={tab} onChange={setTab} options={LIVE ? [{ value: 'proof', label: 'Proof' }, { value: 'ops', label: 'Operations health' }] : [{ value: 'proof', label: 'Proof' }, { value: 'ops', label: 'Operations health' }, { value: 'demo', label: 'Demo controls' }]} />
      </div>
      <p className="mt-1.5 max-w-[620px] text-mut">For builders and judges. Addresses, hashes and health data.</p>
      {tab === 'proof' && <Proof />}{tab === 'ops' && <Ops />}{!LIVE && tab === 'demo' && <Demo />}
    </main>
  );
}
