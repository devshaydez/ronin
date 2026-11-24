import { motion } from 'framer-motion';
import { Icon } from './Icon';

export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';
interface Props { index: number; title: string; detail: string; chain: string; lane: number; status: StepStatus; time?: string; txHash?: string; txUrl?: string; durationSec: number; movesFunds?: boolean }

export function StepRow({ index, title, detail, chain, lane, status, time, txHash, txUrl, durationSec, movesFunds }: Props) {
  return (
    <div style={{ marginLeft: `calc(${lane} * clamp(14px, 3.6vw, 52px))` }}
      className={`relative mb-2 grid grid-cols-[28px_1fr_auto] items-center gap-3.5 overflow-hidden rounded-2xl border bg-card px-4 py-3.5 transition ${movesFunds ? 'border-teal' : 'border-line'} ${status === 'waiting' ? 'opacity-55' : ''}`}>
      <div className={`grid h-6 w-6 place-items-center rounded-full border-[1.5px] ${status === 'done' ? 'border-teal bg-teal text-[#04201c]' : status === 'failed' ? 'border-red text-red' : 'border-mut text-mut'}`}>
        {status === 'done' && <Icon name="ok" size={14} />}
        {status === 'failed' && <Icon name="x" size={14} />}
        {status === 'running' && <span className="spinner" />}
      </div>
      <div>
        <b>{index} {title}</b><span className="ml-2 rounded-full border border-line px-2 text-xs text-mut">{chain}</span>
        <div className="text-[13px] text-mut">{detail}{movesFunds && '. The only step that moves funds'}</div>
      </div>
      <div className="text-right text-[13px]">
        <div className="text-mut">{status === 'waiting' ? 'Waiting' : status === 'running' ? 'Running' : status === 'failed' ? 'Needs attention' : 'Done'}{time && status !== 'waiting' ? `, ${time}` : ''}</div>
        {txHash && status === 'done' && (txUrl ? <a className="text-acc" href={txUrl} target="_blank" rel="noreferrer">{txHash}</a> : <span className="text-mut" title="Demo placeholder, not an on-chain transaction">{txHash}</span>)}
      </div>
      {status === 'running' && <motion.i className="absolute bottom-0 left-0 h-0.5 bg-teal" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: durationSec, ease: 'linear' }} />}
      {status === 'done' && <i className="absolute bottom-0 left-0 h-0.5 w-full bg-teal/25" />}
    </div>
  );
}
