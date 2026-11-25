import { useState } from 'react';
import { Banner } from '../components/Banner';
import { Card } from '../components/Card';
import { ConfidenceMeter } from '../components/ConfidenceMeter';
import { Icon, type IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { Segmented } from '../components/Segmented';
import { SourceTag } from '../components/SourceTag';
import { decisions, type Outcome } from '../data/mock';
import { ACTION_NAMES } from '../lib/derive';
import { explorerTx } from '../lib/deployments';
import { LIVE, PROOF_URL } from '../lib/mode';
import { useLiveDecisions } from '../hooks/useLiveEvents';
import { useNow } from '../hooks/useNow';
import { rel, shortAddr, usdc } from '../lib/format';

const OUT: Record<Outcome, { tone: 'ok' | 'mute'; icon: IconName; text: string }> = {
  executed: { tone: 'ok', icon: 'ok', text: 'Executed' },
  ignored: { tone: 'mute', icon: 'ok', text: 'No move needed' },
  'skipped-gain': { tone: 'mute', icon: 'pause', text: 'Skipped by the vault: gain too small' },
  'skipped-cooldown': { tone: 'mute', icon: 'pause', text: 'Skipped by the vault: cooldown' },
  expired: { tone: 'mute', icon: 'x', text: 'Expired' },
};
type Filter = 'all' | 'executed' | 'not';

const LIVE_OUT: Record<string, { tone: 'ok' | 'mute' | 'bad'; icon: IconName; text: string }> = {
  executed: { tone: 'ok', icon: 'ok', text: 'Executed' },
  skipped: { tone: 'mute', icon: 'pause', text: 'Skipped by the vault' },
  paused: { tone: 'bad', icon: 'pause', text: 'Vault paused' },
  pending: { tone: 'mute', icon: 'pause', text: 'No vault result yet' },
};

export default function AiDecisions() {
  const now = useNow();
  const [f, setF] = useState<Filter>('all');
  const live = useLiveDecisions();
  const list = decisions.filter((d) => f === 'all' || (f === 'executed' ? d.outcome === 'executed' : d.outcome !== 'executed'));
  const liveList = live.decisions.filter((d) => f === 'all' || (f === 'executed' ? d.outcome === 'executed' : d.outcome !== 'executed'));

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">AI decisions</h1>
        <Segmented id="aif" value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'executed', label: 'Executed' }, { value: 'not', label: 'Not executed' }]} />
      </div>
      <Banner><b>The AI suggests. The vault double-checks the rules on-chain before moving anything.</b></Banner>
      <div className="mt-3">{LIVE ? <SourceTag kind="live" source="registry VerdictPosted + VerdictReasoning · both chains" /> : <SourceTag kind="sample" reason="seeded demo decisions" />}</div>
      {LIVE && live.loading && <Card className="mt-4"><p className="text-[13px] text-mut">Reading verdicts and reasoning from both registries…</p></Card>}
      {LIVE && live.error && <Card className="mt-4"><p className="text-[13px] text-red">Could not read decisions: {live.error}</p></Card>}
      {LIVE && !live.loading && !live.error && liveList.length === 0 && <Card className="mt-4"><h3 className="text-lg font-medium tracking-tight">No verdicts yet</h3><p className="mt-2 max-w-[700px] text-[13px] text-mut">When the AI service posts a verdict, it appears here with its on-chain reasoning hash and the vault's response. The measured deployment proof is in the Reviewer proof tab and <a href={PROOF_URL} target="_blank" rel="noreferrer" className="text-acc hover:underline">PROOF.md</a>.</p></Card>}
      {LIVE && liveList.map((d) => {
        const o = LIVE_OUT[d.outcome] ?? LIVE_OUT.pending;
        return (
          <Card key={`${d.chain.chainId}-${d.id}`} className="mt-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><b className="text-xl font-medium">Verdict #{d.id} · {ACTION_NAMES[d.action] ?? d.action}</b><div className="text-[13px] text-mut">Target: {shortAddr(d.target)} · {d.chain.name}</div></div>
              <Pill tone={o.tone} icon={o.icon}>{o.text}</Pill>
            </div>
            <div className="mb-3 mt-5"><ConfidenceMeter value={d.confidenceBps / 100} /></div>
            <p className="max-w-[720px]">{d.reasoning ?? 'Only the reasoning hash was posted; the text is not stored on chain.'}</p>
            {d.request && <p className="mt-2 text-[13px] text-mut">Request #{d.requestId}: gap {(Number(d.request.args.gapBps ?? 0) / 100).toFixed(2)}%, risk {String(d.request.args.riskScore ?? '—')}, trigger {String(d.request.args.trigger ?? '—')}.</p>}
            {d.moved !== undefined && <p className="mt-1 text-[13px] text-acc">Vault moved {usdc(Number(d.moved) / 1e6)} USDC after its own rule check.</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 text-acc" title={`Reasoning hash ${d.reasoningHash}`}><Icon name="ok" size={14} />Verified on-chain <span className="text-mut">{shortAddr(d.reasoningHash)}</span></span>
              <span className="text-mut">{d.ts ? rel(d.ts, now) : ''}, <a className="text-acc" href={explorerTx(d.chain.chain, d.tx)} target="_blank" rel="noreferrer">{shortAddr(d.tx)}</a></span>
            </div>
          </Card>
        );
      })}
      {!LIVE && list.map((d) => {
        const o = OUT[d.outcome];
        return (
          <Card key={d.tx} className="mt-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><b className="text-xl font-medium">{d.action}</b><div className="text-[13px] text-mut">Target: {d.pool}</div></div>
              <Pill tone={o.tone} icon={o.icon}>{o.text}</Pill>
            </div>
            <div className="mb-3 mt-5"><ConfidenceMeter value={d.confidence} /></div>
            <p className="max-w-[720px]">{d.why}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 text-acc" title={`Reasoning hash ${d.reasoningHash}`}><Icon name="ok" size={14} />Verified on-chain <span className="text-mut">{d.reasoningHash}</span></span>
              <span className="text-mut">{rel(d.ts, now)}, <span title="Demo placeholder, not an on-chain transaction">{d.tx}</span></span>
            </div>
          </Card>
        );
      })}
    </main>
  );
}
