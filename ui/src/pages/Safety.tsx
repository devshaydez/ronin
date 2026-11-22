import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { makeHash } from '../data/mock';
import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import { rel } from '../lib/format';
import { useApp } from '../state/AppState';

const PROTECTIONS = [
  { name: 'Omnichain breaker', trigger: 'Utilisation goes above 90% on any chain', ends: 'Utilisation stays below 85% for 5 minutes', last: '2 h ago' },
  { name: 'Stale-data guard', trigger: 'No rate update for 10 minutes', ends: 'A fresh rate arrives', last: '3 days ago' },
  { name: 'AI pause', trigger: 'The AI asks to pause with confidence above 80%', ends: 'Rates return to normal and the AI clears it', last: '6 h ago' },
];
const STATES = {
  clear: { title: 'All clear', icon: 'ok' as IconName, text: 'Rates and data look normal. Nothing is paused and your money is where it should be.', glow: 'rgb(63 224 197 / .2)', color: 'rgb(var(--acc))' },
  protecting: { title: 'Protecting', icon: 'pause' as IconName, text: 'Deposits are off while the vault protects your money. Withdrawals and payouts keep working, and it resumes on its own.', glow: 'rgb(242 184 75 / .2)', color: 'rgb(var(--amb))' },
  recovering: { title: 'Recovering', icon: 'retry' as IconName, text: 'Rates are settling. The vault resumes by itself once they stay normal for 5 minutes.', glow: 'rgb(63 224 197 / .14)', color: 'rgb(var(--amb))' },
};

export default function Safety() {
  const { mode } = useApp();
  const now = useNow();
  const S = mode === 'paused' || mode === 'exit' ? STATES.protecting : mode === 'rec' ? STATES.recovering : STATES.clear;
  const triggered = mode === 'exit' || mode === 'rec' ? 0 : mode === 'paused' ? 2 : -1;
  const hashes = useMemo(() => Array.from({ length: 7 }, makeHash), []);
  const events: [IconName, string, number][] = [
    ['ok', 'Rates returned to normal, vault resumed automatically', 54], ['pause', 'Breaker tripped: Pool E utilisation passed 92%', 61],
    ['pause', 'Vaults on other chains paused by the breaker', 61], ['ai', 'AI asked for a pause, confidence 93%', 360], ['ok', 'Fresh rate arrived, stale-data guard cleared', 4320],
  ];
  if (mode === 'paused') events.unshift(['pause', 'Vault paused by the AI: Pool E rate dropped 40% in one reading', 2]);
  if (mode === 'exit') events.unshift(['x', 'Funds moved out of Pool B to protect you', 6]);
  if (mode === 'rec') events.unshift(['retry', 'Rates are settling, resume check running', 1]);

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Safety status</h1>
      <div className="mt-4 flex flex-col items-start gap-7 rounded-[28px] border border-line p-8 sm:flex-row sm:items-center sm:p-9" style={{ background: `radial-gradient(640px 260px at 0 0, ${S.glow}, transparent 70%), rgb(var(--card))` }}>
        <div className="mx-3 grid h-[84px] w-[84px] flex-none place-items-center rounded-full border-[1.5px]" style={{ color: S.color, borderColor: S.color, boxShadow: `0 0 0 10px color-mix(in srgb, ${S.color} 12%, transparent), 0 0 0 22px color-mix(in srgb, ${S.color} 6%, transparent)` }}><Icon name={S.icon} size={38} /></div>
        <div><div className="text-[44px] font-normal leading-none tracking-[-0.045em] sm:text-[56px]">{S.title}</div><p className="mt-2 max-w-[520px] text-mut">{S.text}</p></div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {PROTECTIONS.map((p, i) => (
          <Card key={p.name} className="!p-5">
            <div className="flex items-center justify-between gap-2"><b className="font-medium">{p.name}</b>
              {triggered === i ? (mode === 'rec' ? <Pill tone="mute" icon="retry">Clearing</Pill> : <Pill tone="warn" icon="pause">Triggered {mode === 'exit' ? 6 : 2} min ago</Pill>) : <Pill icon="ok">Standing by</Pill>}</div>
            <p className="mt-3 text-sm"><span className="text-mut">Triggers when</span><br />{p.trigger}</p>
            <p className="mt-3 text-sm"><span className="text-mut">Ends when</span><br />{p.ends}</p>
            <p className="mt-3 text-[13px] text-mut">Last fired {p.last}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <h3 className="mb-1.5 text-lg font-medium tracking-tight">Recent safety events</h3>
        {events.map(([k, text, min], i) => (
          <div key={text} className="flex flex-col justify-between gap-1 border-t border-line py-3.5 first:border-0 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3"><span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-xl bg-c2 text-acc"><Icon name={k} /></span>
              <div>{text}<div className="text-[13px] text-mut">{rel(now - min * 6e4, now)}</div></div></div>
            <a href="#" className="pl-[46px] text-acc sm:pl-0">{hashes[i]}</a>
          </div>
        ))}
      </Card>
    </main>
  );
}
