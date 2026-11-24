export const LANES = ['Base Sepolia', 'Reactive Lasna', 'AI service', 'Unichain Sepolia'] as const;
export interface StepDef { title: string; lane: 0 | 1 | 2 | 3; detail: string; sec: number }
/** Unichain steps sit in the middle column so the stagger reads like the brief's diagram. */
export const indent = (lane: number) => (lane === 3 ? 1 : lane);

export const REB: StepDef[] = [
  { title: 'Pool rate changes', lane: 0, detail: 'A pool rate moved to 7.62%', sec: 1.1 },
  { title: 'Reactive scores it', lane: 1, detail: 'Gain is above the minimum', sec: 1.4 },
  { title: 'Decision requested', lane: 0, detail: 'Request posted for review', sec: 1.2 },
  { title: 'AI reviews request', lane: 2, detail: 'Request received', sec: 3.6 },
  { title: 'Verdict posted', lane: 0, detail: 'Verdict: move, confidence 87%', sec: 1.3 },
  { title: 'Reactive sees verdict', lane: 1, detail: 'Verdict matched to the request', sec: 1.2 },
  { title: 'Vault checks, moves', lane: 0, detail: 'Rules checked again, then funds moved', sec: 2.2 },
  { title: 'Loop closed, timed', lane: 1, detail: 'Latency recorded', sec: 0.8 },
];
export const SAF: StepDef[] = [
  { title: 'High utilisation seen', lane: 0, detail: 'Pool B utilisation passed 92%', sec: 1 },
  { title: 'Breaker trips', lane: 1, detail: 'Reactive pauses vaults on other chains', sec: 1.4 },
  { title: 'Other vaults paused', lane: 3, detail: 'Unichain Sepolia vault paused', sec: 1.2 },
  { title: 'Vault resumed', lane: 0, detail: 'Rates returned to normal, resumed automatically; the exited pool stays frozen', sec: 1.5 },
];
export const REC: StepDef[] = [
  { title: 'Vault paused by the AI', lane: 3, detail: 'Deposits stop; withdrawals and payouts keep working', sec: 1.1 },
  { title: 'Verdict 44: move requested', lane: 1, detail: 'ACT, confidence 70%, target Pool U', sec: 1.3 },
  { title: 'First callback hit the paused vault', lane: 3, detail: 'Reverted before moving funds; the action stays pending', sec: 1.2 },
  { title: 'Human review: admin unpauses', lane: 3, detail: 'Unpause clears the vault pause, not the pool freeze', sec: 1.3 },
  { title: 'Retrying (attempt 2 of 3)', lane: 1, detail: 'The RSC retries the same verdict; no new decision is needed', sec: 1.4 },
  { title: 'Rebalanced, then healed', lane: 3, detail: '498.76 USDC moved; recovery loop closed after 683 s', sec: 1.4 },
];
export const PAY: StepDef[] = [
  { title: 'Scheduled tick', lane: 1, detail: 'Standing order is due', sec: 1 },
  { title: 'Payout fired', lane: 1, detail: 'Reactive calls the vault', sec: 1.2 },
  { title: 'Vault pays', lane: 0, detail: '250.00 USDC from yield', sec: 1.6 },
  { title: 'Confirmation returned', lane: 1, detail: 'Payment confirmed', sec: 1 },
];
export const BRK: StepDef[] = [
  { title: 'High utilisation seen', lane: 0, detail: 'Pool E utilisation reached 94%', sec: 1 },
  { title: 'Breaker trips', lane: 1, detail: 'Reactive pauses vaults on other chains', sec: 1.4 },
  { title: 'Other vaults paused', lane: 3, detail: 'Unichain Sepolia vault paused', sec: 1.2 },
];
export const RES: StepDef[] = [
  { title: 'Rates return to normal', lane: 0, detail: 'Pool E utilisation back to 71%', sec: 1 },
  { title: 'Breaker clears', lane: 1, detail: 'Conditions held for 5 minutes', sec: 1.4 },
  { title: 'Vault resumed', lane: 0, detail: 'Resumed automatically', sec: 1.5 },
];
/** Origin, Reactive and destination rows for the proof table. */
export function proofRows(steps: StepDef[]) {
  let o = -1, r = -1, t = -1;
  steps.forEach((s, i) => { if (s.lane === 0 && o < 0) o = i; if (s.lane === 1 && r < 0) r = i; if (s.lane === 0 || s.lane === 3) t = i; });
  return ([['Origin', o], ['Reactive', r], ['Destination', t]] as [string, number][]).filter(([, i]) => i >= 0);
}
