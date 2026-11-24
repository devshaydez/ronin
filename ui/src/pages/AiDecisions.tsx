import { useState } from 'react';
import { Banner } from '../components/Banner';
import { Card } from '../components/Card';
import { ConfidenceMeter } from '../components/ConfidenceMeter';
import { Icon, type IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { Segmented } from '../components/Segmented';
import { SourceTag } from '../components/SourceTag';
import { decisions, type Outcome } from '../data/mock';
import { LIVE, PROOF_URL } from '../lib/mode';
import { useNow } from '../hooks/useNow';
import { rel } from '../lib/format';

const OUT: Record<Outcome, { tone: 'ok' | 'mute'; icon: IconName; text: string }> = {
  executed: { tone: 'ok', icon: 'ok', text: 'Executed' },
  ignored: { tone: 'mute', icon: 'ok', text: 'No move needed' },
  'skipped-gain': { tone: 'mute', icon: 'pause', text: 'Skipped by the vault: gain too small' },
  'skipped-cooldown': { tone: 'mute', icon: 'pause', text: 'Skipped by the vault: cooldown' },
  expired: { tone: 'mute', icon: 'x', text: 'Expired' },
};
type Filter = 'all' | 'executed' | 'not';

export default function AiDecisions() {
  const now = useNow();
  const [f, setF] = useState<Filter>('all');
  const list = decisions.filter((d) => f === 'all' || (f === 'executed' ? d.outcome === 'executed' : d.outcome !== 'executed'));
  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">AI decisions</h1>
        <Segmented id="aif" value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'executed', label: 'Executed' }, { value: 'not', label: 'Not executed' }]} />
      </div>
      <Banner><b>The AI suggests. The vault double-checks the rules on-chain before moving anything.</b></Banner>
      <div className="mt-3">{LIVE ? <Pill tone="mute">Not indexed</Pill> : <SourceTag kind="sample" reason="AI registry and reasoning are not read in this UI build" />}</div>
      {LIVE && <Card className="mt-4"><h3 className="text-lg font-medium tracking-tight">No live decision indexer</h3><p className="mt-2 max-w-[700px] text-[13px] text-mut">Sample decisions and confidence scores are hidden in live mode. The measured deployment proof is in the Reviewer proof tab and <a href={PROOF_URL} target="_blank" rel="noreferrer" className="text-acc hover:underline">PROOF.md</a>.</p></Card>}
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
