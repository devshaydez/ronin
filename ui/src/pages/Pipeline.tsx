import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HistoryNote } from '../components/HistoryNote';
import { Pill } from '../components/Pill';
import { SourceTag } from '../components/SourceTag';
import { StepRow } from '../components/StepRow';
import { indent, LANES, REB, REC } from '../data/pipeline';
import { RECOVERY_CASE } from '../data/latency';
import { useLiveLoops } from '../hooks/useLiveEvents';
import { useNow } from '../hooks/useNow';
import { explorerTx } from '../lib/deployments';
import { rel, shortAddr } from '../lib/format';
import { LIVE, PROOF_URL } from '../lib/mode';
import { SPEED, useApp } from '../state/AppState';
import type { LiveLoop } from '../lib/derive';

function laneOf(chain: string) {
  if (chain === 'Reactive Lasna') return 1;
  if (chain.includes('Unichain')) return 3;
  return 0;
}

function LivePipeline() {
  const live = useLiveLoops();
  const now = useNow(1000);
  const [selected, setSelected] = useState<string>();
  const loop: LiveLoop | undefined = live.loops.find((l) => l.id === selected) ?? live.loops[0];

  if (!loop) {
    return (
      <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Pipeline</h1>
        <p className="mt-1.5 max-w-[620px] text-mut">Every decision request, AI verdict, vault outcome and LoopClosed receipt, read from Base Sepolia, Unichain Sepolia and Reactive Lasna.</p>
        <div className="mt-3"><SourceTag kind="live" source="eth_getLogs · cached 60 s" /></div>
        {live.loading && <Card className="mt-4"><p className="text-[13px] text-mut">Reading decision requests and verdicts from all three chains…</p></Card>}
        {live.error && <Card className="mt-4"><p className="text-[13px] text-red">Could not read the pipeline: {live.error}</p></Card>}
        {live.note && <div className="mt-3 px-1"><HistoryNote note={live.note} className="" /></div>}
        {!live.loading && !live.error && (
          <Card className="mt-4"><h3 className="text-lg font-medium tracking-tight">No loop yet</h3><p className="mt-2 max-w-[680px] text-[13px] text-mut">No decision request has a matching verdict and vault result since these contracts were deployed. The measured deployment receipts are in <a href={PROOF_URL} target="_blank" rel="noreferrer" className="text-acc hover:underline">ai-service/PROOF.md</a>.</p></Card>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Pipeline</h1>
      <div className="mt-1.5 flex flex-wrap items-center gap-3"><p className="max-w-[620px] text-mut">Real loop receipts: the request, the AI verdict, the vault's own check, and Reactive's measured close.</p><SourceTag kind="live" source="requester + registry + vault + RSC events" /></div>
      <HistoryNote note={live.note} />
      <div className="mt-5 grid items-start gap-4 md:grid-cols-[300px_1fr]">
        <div className="grid gap-2">
          {live.loops.map((l) => (
            <button key={l.id} onClick={() => setSelected(l.id)} className={`rounded-2xl border px-4 py-3.5 text-left transition ${l.id === loop.id ? 'border-teal bg-c2' : 'border-line bg-card'}`}>
              <b>{l.name}</b>
              <div className="text-[13px] text-mut">{l.kind === 'recovery' ? 'Recovery' : 'Done'}{l.latency !== undefined ? `, ${l.latency} s` : ''}, {l.ts ? rel(l.ts, now) : l.chain.name}</div>
            </button>
          ))}
        </div>
        <div>
          <Card className="mb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] text-mut">{loop.kind === 'recovery' ? 'Recovery time, request to healed' : 'Loop latency, request to rebalance'}</div>
              <div className="flex items-center gap-2"><Pill tone={loop.kind === 'recovery' ? 'warn' : 'ok'}>{loop.kind === 'recovery' ? 'Recovery, not speed' : 'Normal loop'}</Pill><Pill tone="mute">{loop.chain.name}</Pill></div>
            </div>
            <div className="text-[44px] leading-none tracking-[-0.045em] sm:text-[56px]">{loop.latency !== undefined ? loop.latency : '—'}<span className="text-[22px] text-mut"> s</span></div>
            {loop.latency === undefined && <p className="mt-2 text-[13px] text-mut">The loop is still open; no LoopClosed receipt exists yet.</p>}
            {loop.kind === 'recovery' && <p className="mt-2 max-w-[560px] text-[13px] text-mut">This verdict first hit a paused vault, was retried by the RSC and then moved funds. Recovery time is excluded from normal-loop latency.</p>}
          </Card>
          {loop.steps.map((s, i) => (
            <StepRow key={i} index={i + 1} title={s.title} chain={s.chain} lane={indent(laneOf(s.chain))} status={s.status} durationSec={1}
              detail={s.detail}
              time={s.ts ? new Date(s.ts).toLocaleTimeString([], { hour12: false }) : undefined}
              txHash={s.tx ? shortAddr(s.tx) : undefined}
              txUrl={s.tx ? explorerTx(s.explorer, s.tx) : undefined}
              movesFunds={s.movesFunds} />
          ))}
        </div>
      </div>
    </main>
  );
}

function DemoPipeline() {
  const { loops, selected, setSelected, running, runLoop } = useApp();
  const now = useNow(100);
  const L = loops.find((l) => l.id === selected) ?? loops[0];
  if (!L) return null;
  const recovery = L.kind === 'recovery';
  const latency = recovery ? RECOVERY_CASE.seconds : L.running ? (now - L.startedAt) / 1000 : L.latency;
  const isAi = L.steps === REB;

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Demo pipeline</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={running} onClick={() => runLoop(REC, 'Retry that healed (verdict 44)', undefined, 'recovery')}>Run retry demo</Button>
          <Button disabled={running} onClick={() => runLoop(REB, 'AI-gated rebalance')}>Run a live loop</Button>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3"><p className="max-w-[620px] text-mut">A seeded replay, not on-chain receipts. Each step names the chain it would run on.</p><SourceTag kind="sample" reason="demo replay; hashes are not transactions" /></div>
      <div className="mt-5 grid items-start gap-4 md:grid-cols-[300px_1fr]">
        <div className="grid gap-2">
          {loops.map((l) => (
            <button key={l.id} onClick={() => setSelected(l.id)} className={`rounded-2xl border px-4 py-3.5 text-left transition ${l.id === L.id ? 'border-teal bg-c2' : 'border-line bg-card'}`}>
              <b>{l.name}</b>
              <div className="text-[13px] text-mut">{l.running ? 'Running now' : `${l.kind === 'recovery' ? 'Recovery' : 'Done'}, ${l.latency.toFixed(1)} s, ${rel(l.startedAt, now)}`}</div>
            </button>
          ))}
        </div>
        <div>
          <Card className="mb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] text-mut">{recovery ? 'Recovery time, trigger to healed' : 'Loop latency, trigger to result'}</div>
              {recovery && <Pill tone="warn">Recovery, not speed</Pill>}
            </div>
            <div className="text-[44px] leading-none tracking-[-0.045em] sm:text-[56px]">{latency.toFixed(1)}<span className="text-[22px] text-mut"> s</span></div>
            {recovery && <p className="mt-2 max-w-[560px] text-[13px] text-mut">Verdict 44 waited for a paused vault to be unpaused, then healed on attempt 2 of 3. This time is excluded from the normal-loop median.</p>}
          </Card>
          {L.steps.map((s, i) => (
            <StepRow key={i} index={i + 1} title={s.title} chain={LANES[s.lane]} lane={indent(s.lane)} status={L.status[i]} durationSec={s.sec * SPEED}
              detail={isAi && i === 3 && L.status[i] === 'running' ? `AI is reviewing, ${Math.round((now - (L.aiStart ?? now)) / 1000)} s` : s.detail}
              time={L.ts[i] ? new Date(L.ts[i]).toLocaleTimeString([], { hour12: false }) : undefined} txHash={L.hashes[i]} movesFunds={isAi && i === 6} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function Pipeline() {
  return LIVE ? <LivePipeline /> : <DemoPipeline />;
}
