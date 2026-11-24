/**
 * Measured from ten complete AI loops on the 2026-11-22 deployment (verdicts 9-28).
 * `seconds` are medians of the per-loop receipts; the headline total is the median
 * end-to-end loop, not the sum of the rounded medians.
 *
 * The 683 s verdict-44 retry is deliberately NOT in this sample: it includes an
 * ~11 minute pause plus an admin unpause, so it is recovery time, not loop speed.
 */
export const LATENCY_SAMPLE = {
  loops: 10,
  totalSeconds: 22,
  excludedRecoverySeconds: 683,
  window: 'verdicts 9–28',
};

export interface LatencyStage {
  key: 'reactive' | 'callback' | 'ai' | 'verdict';
  label: string;
  seconds: number;
  detail: string;
  color: string;
}

export const LATENCY_STAGES: LatencyStage[] = [
  { key: 'reactive', label: 'Reactive reaction', seconds: 2, detail: 'rate event → request posted', color: '#19c3ac' },
  { key: 'callback', label: 'Request callback', seconds: 5.684, detail: 'request posted → AI service receives it', color: '#5b4be0' },
  { key: 'ai', label: 'AI model call', seconds: 12.015, detail: 'the off-chain inference hop (median)', color: '#f2b84b' },
  { key: 'verdict', label: 'Verdict to rebalance', seconds: 2, detail: 'verdict posted → vault moves funds', color: '#98aaa6' },
];

export const LATENCY_PARTS_SECONDS = LATENCY_STAGES.reduce((sum, s) => sum + s.seconds, 0);
export const LATENCY_TOTAL_SECONDS = LATENCY_SAMPLE.totalSeconds;

/** Real B2 recovery, kept out of the normal-loop median above. */
export const RECOVERY_CASE = {
  verdict: 44,
  attempt: 2,
  maxAttempts: 3,
  seconds: 683,
  aiSeconds: 17.354,
  requestCallbackSeconds: 4.646,
  note: 'The first callback hit a paused vault. The admin unpaused it, the RSC retried, and the move completed. This is recovery time, not speed.',
};
