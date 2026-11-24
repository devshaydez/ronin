import { Card } from './Card';
import { Pill } from './Pill';
import { LATENCY_PARTS_SECONDS, LATENCY_SAMPLE, LATENCY_STAGES, LATENCY_TOTAL_SECONDS, RECOVERY_CASE } from '../data/latency';

const fmt = (n: number) => n.toFixed(1);

export function LatencyBreakdown({ compact = false }: { compact?: boolean }) {
  return (
    <Card className={compact ? '!p-5' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium tracking-tight">Where the {LATENCY_TOTAL_SECONDS} seconds go</h3>
          <p className="mt-1 text-[13px] text-mut">Median of {LATENCY_SAMPLE.loops} completed AI loops ({LATENCY_SAMPLE.window}).</p>
        </div>
        <Pill tone="mute">On-chain receipts</Pill>
      </div>

      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-c2" aria-hidden>
        {LATENCY_STAGES.map((s) => (
          <span key={s.key} style={{ width: `${(s.seconds / LATENCY_PARTS_SECONDS) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${fmt(s.seconds)} s`} />
        ))}
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {LATENCY_STAGES.map((s) => (
          <div key={s.key} className="flex items-start justify-between gap-3 border-t border-line py-2 first:border-0 sm:[&:nth-child(2)]:border-0">
            <div className="flex items-start gap-2">
              <i className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ backgroundColor: s.color }} />
              <div><b className="font-medium">{s.label}</b>{s.key === 'ai' && <span className="ml-2"><Pill tone="warn">model call</Pill></span>}<div className="text-[13px] text-mut">{s.detail}</div></div>
            </div>
            <span className="whitespace-nowrap tabular-nums">{fmt(s.seconds)} s</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
        <span className="text-sm text-mut">Median loop, trigger to result</span>
        <b className="text-2xl font-medium tracking-tight">{LATENCY_TOTAL_SECONDS} s</b>
      </div>

      <p className="mt-3 text-[13px] text-mut">
        Components are medians, so the rounded parts may not add exactly to the loop median. The {RECOVERY_CASE.seconds} s verdict-{RECOVERY_CASE.verdict} retry is a
        <b className="text-ink"> recovery time</b>, not loop speed, and is excluded from these medians. It paused for a human review, then healed on attempt {RECOVERY_CASE.attempt} of {RECOVERY_CASE.maxAttempts}.
      </p>
    </Card>
  );
}
