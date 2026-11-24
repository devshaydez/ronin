import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { SourceTag } from '../components/SourceTag';
import { makeHash } from '../data/mock';
import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import { usePoolFrozen } from '../hooks/usePoolFrozen';
import { useSafetyStatus } from '../hooks/useSafetyStatus';
import { rel, shortAddr } from '../lib/format';
import { LIVE, PROOF_URL } from '../lib/mode';
import { useApp } from '../state/AppState';

const PROTECTIONS = [
  { name: 'Omnichain breaker', trigger: 'Utilisation goes above 90% on any chain', ends: 'Utilisation stays below 85% for 5 minutes', last: '2 h ago' },
  { name: 'Stale-data guard', trigger: 'No rate update for 10 minutes', ends: 'A fresh rate arrives', last: '3 days ago' },
  { name: 'AI pause', trigger: 'The AI asks to pause with confidence above 80%', ends: 'Rates return to normal and the AI clears it', last: '6 h ago' },
];
const STATES = {
  clear: { title: 'All clear', icon: 'ok' as IconName, text: 'Rates and data look normal. Nothing is paused and your money is where it should be.', glow: 'rgb(63 224 197 / .2)', color: 'rgb(var(--acc))' },
  unknown: { title: 'Checking', icon: 'retry' as IconName, text: 'Reading paused() and poolFrozen() from the deployment. No status is claimed until those reads return.', glow: 'rgb(63 224 197 / .12)', color: 'rgb(var(--acc))' },
  protecting: { title: 'Protecting', icon: 'pause' as IconName, text: 'Deposits are off while the vault protects your money. Withdrawals and payouts keep working, and it resumes on its own.', glow: 'rgb(242 184 75 / .2)', color: 'rgb(var(--amb))' },
  recovering: { title: 'Recovering', icon: 'retry' as IconName, text: 'Rates are settling. The vault resumes by itself once they stay normal for 5 minutes.', glow: 'rgb(63 224 197 / .14)', color: 'rgb(var(--amb))' },
};

export default function Safety() {
  const { mode } = useApp();
  const now = useNow();
  const poolState = usePoolFrozen();
  const safety = useSafetyStatus();
  const frozen = poolState.frozen === true;
  const livePaused = safety.paused === true;
  const liveUnknown = safety.loading || poolState.loading || !!safety.error || !!poolState.error;
  const S = LIVE ? (liveUnknown ? STATES.unknown : frozen || livePaused ? STATES.protecting : STATES.clear) : mode === 'paused' || mode === 'exit' ? STATES.protecting : mode === 'rec' ? STATES.recovering : STATES.clear;
  const triggered = LIVE ? -1 : mode === 'exit' || mode === 'rec' ? 0 : mode === 'paused' ? 2 : -1;
  const hashes = useMemo(() => Array.from({ length: 7 }, makeHash), []);
  const events: [IconName, string, number][] = LIVE ? [] : [
    ['ok', 'Rates returned to normal, vault resumed automatically', 54], ['pause', 'Breaker tripped: Pool E utilisation passed 92%', 61],
    ['pause', 'Vaults on other chains paused by the breaker', 61], ['ai', 'AI asked for a pause, confidence 93%', 360], ['ok', 'Fresh rate arrived, stale-data guard cleared', 4320],
  ];
  if (!LIVE && mode === 'paused') events.unshift(['pause', 'Vault paused by the AI: Pool E rate dropped 40% in one reading', 2]);
  if (!LIVE && mode === 'exit') events.unshift(['x', 'Funds moved out of Pool B to protect you', 6]);
  if (!LIVE && mode === 'rec') events.unshift(['retry', 'Rates are settling, resume check running', 1]);

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Safety status</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2"><SourceTag kind={LIVE ? 'live' : 'sample'} source={LIVE ? 'vault.paused(), vault.poolFrozen(pool)' : undefined} reason="preview state selected below; not a chain read" />{!LIVE && <span className="text-[13px] text-mut">The preview switches are demo-only and are hidden in live mode.</span>}</div>
      <div className="mt-4 flex flex-col items-start gap-7 rounded-[28px] border border-line p-8 sm:flex-row sm:items-center sm:p-9" style={{ background: `radial-gradient(640px 260px at 0 0, ${S.glow}, transparent 70%), rgb(var(--card))` }}>
        <div className="mx-3 grid h-[84px] w-[84px] flex-none place-items-center rounded-full border-[1.5px]" style={{ color: S.color, borderColor: S.color, boxShadow: `0 0 0 10px color-mix(in srgb, ${S.color} 12%, transparent), 0 0 0 22px color-mix(in srgb, ${S.color} 6%, transparent)` }}><Icon name={S.icon} size={38} /></div>
        <div><div className="text-[44px] font-normal leading-none tracking-[-0.045em] sm:text-[56px]">{S.title}</div><p className="mt-2 max-w-[520px] text-mut">{S.text}</p></div>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-medium tracking-tight">Pool freeze after a breaker exit</h3>
            <p className="mt-1 max-w-[720px] text-[13px] text-mut">Read from the Unichain vault's <code>poolFrozen(pool)</code> flag, not from a paused-vault label.</p>
          </div>
          <Pill tone={!poolState.configured ? 'mute' : frozen ? 'bad' : 'ok'} icon={frozen ? 'pause' : 'ok'}>
            {!poolState.configured ? 'Live read not configured' : poolState.loading ? 'Reading vault…' : frozen ? 'This pool is frozen' : 'This pool is not frozen'}
          </Pill>
        </div>
        <p className="mt-4 max-w-[820px] text-[15px]">
          {frozen
            ? 'Vaults resumed automatically; this pool needs a human review before it gets funds again.'
            : 'Vaults resume automatically when the breaker clears. A pool that the breaker exited does not: it stays frozen until an admin reviews it. The rule is: “Vaults resumed automatically; this pool needs a human review before it gets funds again.”'}
        </p>
        <p className="mt-2 text-[13px] text-mut">
          {poolState.configured
            ? <>Vault {shortAddr(poolState.pool!)} is checked live. {frozen ? 'Only an admin can clear this freeze; the automatic heal will not.' : 'If this pool is exited again, the freeze remains after the vault resumes.'}</>
            : <>Set <code>VITE_UNICHAIN_VAULT_ADDRESS</code> and <code>VITE_POOL_U_ADDRESS</code> to read the live flag. The rule is the same on-chain: only an admin <code>unfreeze(pool)</code> clears it.</>}
        </p>
      </Card>

      <div className="mt-3"><SourceTag kind="sample" reason="protections are protocol copy; last-fired times are sample" /></div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {PROTECTIONS.map((p, i) => (
          <Card key={p.name} className="!p-5">
            <div className="flex items-center justify-between gap-2"><b className="font-medium">{p.name}</b>
              {triggered === i ? (mode === 'rec' ? <Pill tone="mute" icon="retry">Clearing</Pill> : <Pill tone="warn" icon="pause">Triggered {mode === 'exit' ? 6 : 2} min ago</Pill>) : <Pill icon="ok">Standing by</Pill>}</div>
            <p className="mt-3 text-sm"><span className="text-mut">Triggers when</span><br />{p.trigger}</p>
            <p className="mt-3 text-sm"><span className="text-mut">Ends when</span><br />{p.ends}</p>
            <p className="mt-3 text-[13px] text-mut">Last fired {LIVE ? 'not indexed' : p.last}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="mb-1.5 text-lg font-medium tracking-tight">Recent safety events</h3>{LIVE ? <Pill tone="mute">Not indexed</Pill> : <SourceTag kind="sample" reason="seeded demo events" />}</div>
        {LIVE ? <p className="mt-3 text-[13px] text-mut">Live safety event indexing is not connected in this build. No seeded events are shown; the measured breaker and recovery receipts are in <a href={PROOF_URL} target="_blank" rel="noreferrer" className="text-acc hover:underline">ai-service/PROOF.md</a>.</p> : events.map(([k, text, min], i) => (
          <div key={text} className="flex flex-col justify-between gap-1 border-t border-line py-3.5 first:border-0 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3"><span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-xl bg-c2 text-acc"><Icon name={k} /></span>
              <div>{text}<div className="text-[13px] text-mut">{rel(now - min * 6e4, now)}</div></div></div>
            <span className="pl-[46px] text-mut sm:pl-0" title="Demo placeholder, not an on-chain transaction">{hashes[i]}</span>
          </div>
        ))}
      </Card>
    </main>
  );
}
