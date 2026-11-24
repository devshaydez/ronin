export const usdc = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** First 6 and last 4 characters. */
export const shortAddr = (a: string) => `${a.slice(0, 6)}\u2026${a.slice(-4)}`;

/** Timestamps, not block counts: Base Sepolia blocks are too fast for "blocks ago". */
export function rel(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

export function countdown(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((ts - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `in ${d} d ${h} h`;
  if (h) return `in ${h} h ${m} m`;
  return `in ${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Rates are stored in basis points. 700 bps is 7.00%. Two decimals so 0.07% stays readable. */
export const bps = (n: number) => `${(n / 100).toFixed(2)}%`;
