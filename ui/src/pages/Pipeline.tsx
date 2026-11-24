import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { StepRow } from '../components/StepRow';
import { indent, LANES, REB, REC } from '../data/pipeline';
import { RECOVERY_CASE } from '../data/latency';
import { useNow } from '../hooks/useNow';
import { rel } from '../lib/format';
import { SPEED, useApp } from '../state/AppState';

export default function Pipeline() {
  const { loops, selected, setSelected, running, runLoop } = useApp();
  const now = useNow(100);
  const L = loops.find((l) => l.id === selected) ?? loops[0];
  const recovery = L.kind === 'recovery';
  const latency = recovery ? RECOVERY_CASE.seconds : L.running ? (now - L.startedAt) / 1000 : L.latency;
  const isAi = L.steps === REB;

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Live pipeline</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={running} onClick={() => runLoop(REC, 'Retry that healed (verdict 44)', undefined, 'recovery')}>Run retry demo</Button>
          <Button disabled={running} onClick={() => runLoop(REB, 'AI-gated rebalance')}>Run a live loop</Button>
        </div>
      </div>
      <p className="mt-1.5 max-w-[620px] text-mut">One automated loop, step by step. Each step runs on its own chain and has its own transaction.</p>
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
