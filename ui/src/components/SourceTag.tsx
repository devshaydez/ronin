import { PROOF_URL } from '../lib/mode';

type Props = { kind: 'live' | 'sample' | 'proof'; source?: string; reason?: string };

/**
 * Every figure on the app pages must say where it came from. This is deliberately
 * plain text, not a tooltip: a sample must never look like a chain read.
 */
export function SourceTag({ kind, source, reason }: Props) {
  if (kind === 'proof') {
    return (
      <a href={PROOF_URL} target="_blank" rel="noreferrer" className="inline-flex max-w-full rounded-full bg-amb/15 px-3 py-1 text-[12px] font-medium text-amb hover:underline">
        PROOF · measured on the 2026-11-22 deployment
      </a>
    );
  }
  if (kind === 'live') {
    return <span className="inline-flex max-w-full rounded-full bg-teal/15 px-3 py-1 text-[12px] font-medium text-acc">LIVE · {source ?? 'on-chain read'}</span>;
  }
  return <span className="inline-flex max-w-full rounded-full bg-c2 px-3 py-1 text-[12px] font-medium text-mut">SAMPLE · {reason ?? 'not connected'}</span>;
}
