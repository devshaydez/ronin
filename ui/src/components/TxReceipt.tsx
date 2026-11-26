import type { TxState } from '../hooks/useWrites';
import { explorerTx } from '../lib/deployments';
import { Button } from './Button';
import { Icon } from './Icon';

const TONE = {
  'wrong-network': { box: 'border-amb/40 bg-amb/10', pill: 'bg-amb/15 text-amb', icon: 'pause' },
  signing: { box: 'border-teal/30 bg-teal/10', pill: 'bg-teal/15 text-acc', icon: 'retry' },
  pending: { box: 'border-teal/30 bg-teal/10', pill: 'bg-teal/15 text-acc', icon: 'retry' },
  confirmed: { box: 'border-teal/30 bg-teal/10', pill: 'bg-teal/15 text-acc', icon: 'ok' },
  failed: { box: 'border-red/40 bg-red/10', pill: 'bg-red/15 text-red', icon: 'x' },
} as const;

const STATUS = {
  'wrong-network': 'Wrong network',
  signing: 'Waiting for wallet',
  pending: 'Pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
} as const;

function HashLink({ hash, label, chain }: { hash: `0x${string}`; label?: string; chain: 'base' | 'unichain' | 'lasna' }) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      {label && <span className="text-mut">{label}</span>}
      <code className="max-w-full truncate rounded-md bg-bg/60 px-1.5 py-0.5 font-mono text-[12px]">{hash.slice(0, 10)}…{hash.slice(-6)}</code>
      <a href={explorerTx(chain, hash)} target="_blank" rel="noopener noreferrer" className="text-acc hover:underline">
        View on Blockscout
      </a>
    </span>
  );
}

/**
 * The receipt row for every write. It stays in place after the transaction resolves — including
 * failures that still have a hash — until the next action replaces it.
 */
export function TxReceipt({ tx, switchLabel, onSwitch }: { tx: TxState; switchLabel: string; onSwitch: () => void }) {
  if (tx.stage === 'idle') return null;
  const tone = TONE[tx.stage];
  const chain = tx.chain?.chain ?? 'base';
  const chainName = tx.chain?.name ?? 'the target network';
  const approve = tx.approveHash && tx.approveHash !== tx.hash ? tx.approveHash : undefined;

  return (
    <div className={`mt-3 rounded-2xl border px-4 py-3 text-[13px] ${tone.box}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-medium">
          {tx.stage === 'signing' || tx.stage === 'pending'
            ? <span className="spinner" aria-hidden />
            : <Icon name={tone.icon} size={15} />}
          {tx.label}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${tone.pill}`}>{STATUS[tx.stage]}</span>
      </div>

      {tx.stage === 'wrong-network' && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-mut">Your wallet is on a different network. Switch to {chainName} and this continues on its own.</span>
          <Button small onClick={onSwitch}>{switchLabel}</Button>
        </div>
      )}

      {tx.stage === 'signing' && <p className="mt-2 text-mut">Confirm the request in your wallet.</p>}

      {tx.stage === 'pending' && <p className="mt-2 text-mut">Waiting for the receipt. This usually takes a few seconds.</p>}

      {tx.stage === 'confirmed' && <p className="mt-2 text-mut">Confirmed on {chainName}. The transaction is final.</p>}

      {tx.stage === 'failed' && (
        <p className="mt-2 text-red">{tx.error ?? 'The transaction failed and nothing was moved.'}</p>
      )}

      {(tx.hash || approve) && (
        <div className="mt-2 flex flex-col gap-1.5">
          {tx.hash && <HashLink hash={tx.hash} chain={chain} label={approve ? 'Transaction' : undefined} />}
          {approve && <HashLink hash={approve} chain={chain} label="Approval" />}
        </div>
      )}
    </div>
  );
}
