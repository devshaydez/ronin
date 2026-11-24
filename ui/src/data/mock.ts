import type { IconName } from '../components/Icon';

export const makeHash = () => '0x' + Math.random().toString(16).slice(2, 6).padEnd(4, '0') + '\u2026' + Math.random().toString(16).slice(2, 6).padEnd(4, '0');
const now = Date.now();

export const mockVault = { balance: 1284.5, deposited: 1250, apy: 7.42, walletUsdc: 5000 };

export interface FeedEvent { id: string; kind: IconName; text: string; ts: number; hash: string }
export const mockFeed: FeedEvent[] = ([
  ['ok', 'Recovery complete in 683 s: vault unpaused, retry healed', 88],
  ['retry', 'Retrying (attempt 2 of 3): first callback hit a paused vault', 104],
  ['pause', 'Verdict 44 callback reverted: the vault was paused, so no funds moved', 128],
  ['pay', 'Paid 12.00 USDC to 0x9d05\u2026a2e3', 40], ['rate', 'Pool B rate moved to 7.42%', 95],
  ['move', 'Moved your money to a better pool', 210], ['ai', 'AI reviewed the move, confidence 87%', 224],
  ['rate', 'Pool A rate moved to 4.10%', 460], ['ok', 'Rates are normal, vault checked', 900],
] as [IconName, string, number][]).map(([kind, text, s], i) => ({ id: `seed${i}`, kind, text, ts: now - s * 1000, hash: makeHash() }));

export const liveEventPool: Array<[IconName, string]> = [
  ['rate', 'Pool B rate moved to 7.51%'], ['ai', 'AI reviewed the move: no move needed'],
  ['pay', 'Paid 12.00 USDC to 0x9d05\u2026a2e3'], ['rate', 'Pool A rate moved to 4.18%'], ['ok', 'Rates are normal, vault checked'],
];

export type OrderState = 'active' | 'retrying' | 'skipped' | 'stuck' | 'completed' | 'cancelled';
export interface Order { id: string; name: string; payee: string; amount: number; period: string; left: number; mode: 'yield' | 'yield-principal'; next: number; state: OrderState; why?: string; attempt?: number }
export const mockOrders: Order[] = [
  { id: '1', name: 'Rent', payee: '0x4f2a9b7c3d1e8f6a05b2c4d97e1a3f80b6c2c91e', amount: 250, period: 'Every 7 days', left: 6, mode: 'yield', next: now + 2.17 * 864e5, state: 'active' },
  { id: '2', name: 'Team stipend', payee: '0x9d05b1e3a77c4f20d8e6b9a1c35f7e2048d6a2e3', amount: 12, period: 'Every 2 min', left: 14, mode: 'yield-principal', next: now + 38e3, state: 'retrying', attempt: 2 },
  { id: '3', name: 'Hosting', payee: '0x37fa6c0d12b94e58a7c3f1e0b6d92a45c8e1a2d1', amount: 600, period: 'Every 30 days', left: 3, mode: 'yield', next: now + 9 * 864e5, state: 'skipped', why: 'No yield yet' },
];

export type Outcome = 'executed' | 'ignored' | 'skipped-gain' | 'skipped-cooldown' | 'expired';
export interface Decision { action: string; pool: string; confidence: number; why: string; outcome: Outcome; ts: number; tx: string; reasoningHash: string }
const rh = () => '0x' + Math.random().toString(16).slice(2, 8) + '\u2026' + Math.random().toString(16).slice(2, 6);
export const decisions: Decision[] = ([
  ['Move to a better pool', 'Pool B, Base Sepolia', 87, 'Pool B pays 7.62% and Pool A pays 4.10%. Utilisation is steady near 61% and the smoothed rate has stayed above 7% for 20 minutes.', 'executed', 190],
  ['Ignore', 'Pool A, Base Sepolia', 72, 'The rate difference is 0.30 points, which does not cover the cost of moving. Staying put is the better result.', 'ignored', 1100],
  ['Move to a better pool', 'Pool D, Unichain Sepolia', 58, 'Pool D rose to 6.40%, a small gain over the current pool. The AI leaned towards a move.', 'skipped-gain', 2100],
  ['Move to a better pool', 'Pool B, Base Sepolia', 81, 'Pool B pays more, but the vault had already moved funds a few minutes earlier.', 'skipped-cooldown', 3300],
  ['Pause', 'All pools', 93, 'Pool E utilisation reached 94% and its rate dropped 40% in one reading. Pausing protects deposits while it settles.', 'executed', 5400],
  ['Move to a better pool', 'Pool C, Base Sepolia', 66, 'Pool C looked better at the time of the request, but the rate changed before anyone acted on it.', 'expired', 8200],
] as [string, string, number, string, Outcome, number][]).map(([action, pool, confidence, why, outcome, s]) => ({ action, pool, confidence, why, outcome, ts: now - s * 1000, tx: makeHash(), reasoningHash: rh() }));

export interface Pool { name: string; badge: string; apy: number; util: number; avg: number; risk: number; series: number[]; ageSec: number; flag?: 'use' | 'frozen' | 'tripped' }
export const chains: { name: string; pools: Pool[] }[] = [
  { name: 'Base Sepolia', pools: [
    { name: 'Pool A', badge: 'Live Aave data', apy: 4.1, util: 58, avg: 4.02, risk: 0.12, series: [3.9, 4, 4.2, 4.1, 4, 4.2, 4.1], ageSec: 12 },
    { name: 'Pool B', badge: 'Mock pool (demo)', apy: 7.42, util: 61, avg: 7.18, risk: 0.21, series: [6.8, 6.9, 7.1, 7, 7.3, 7.5, 7.42], ageSec: 12, flag: 'use' },
    { name: 'Pool C', badge: 'Mock pool (demo)', apy: 0, util: 0, avg: 0, risk: 0.55, series: [5.1, 5, 4.2, 2.6, 1.1, 0.3, 0], ageSec: 95, flag: 'frozen' },
  ] },
  { name: 'Unichain Sepolia', pools: [
    { name: 'Pool D', badge: 'Mock pool (demo)', apy: 5.96, util: 49, avg: 5.8, risk: 0.18, series: [5.5, 5.6, 5.8, 5.7, 5.9, 6, 5.96], ageSec: 12 },
    { name: 'Pool E', badge: 'Mock pool (demo)', apy: 2.31, util: 93, avg: 3.6, risk: 0.88, series: [4.4, 4.1, 3.8, 3.2, 2.9, 2.5, 2.31], ageSec: 840, flag: 'tripped' },
  ] },
];
