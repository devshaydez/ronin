import { useMemo } from 'react';
import { BASE, UNICHAIN } from '../lib/deployments';
import { buildActivity, buildDecisions, buildLoops, buildSafetyEvents, type DecisionRow } from '../lib/derive';
import { useLogs } from './useLogs';

const VAULT_KEYS = ['baseVault', 'uniVault'] as const;
const DECISION_KEYS = ['baseVault', 'uniVault', 'baseRegistry', 'uniRegistry', 'baseRequester', 'uniRequester', 'rsc'] as const;
const SAFETY_KEYS = ['baseVault', 'uniVault', 'rsc'] as const;

const CHAIN_OF = { '84532': BASE, '1301': UNICHAIN } as const;

export function useLiveActivity(limit = 12) {
  const { logs, loading, error, partial, note, refresh } = useLogs(...VAULT_KEYS);
  const items = useMemo(() => buildActivity(logs, CHAIN_OF), [logs]);
  return { items: items.slice(0, limit), total: items.length, loading, error, partial, note, refresh };
}

export function useLiveDecisions() {
  const { logs, loading, error, partial, note, refresh } = useLogs(...DECISION_KEYS);
  const decisions = useMemo(() => {
    const pick = (address: string) => logs.filter((l) => l.address.toLowerCase() === address.toLowerCase());
    const base = buildDecisions(BASE, pick(BASE.registry), pick(BASE.requester), pick(BASE.vault));
    const uni = buildDecisions(UNICHAIN, pick(UNICHAIN.registry), pick(UNICHAIN.requester), pick(UNICHAIN.vault));
    return [...base, ...uni].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  }, [logs]);
  return { decisions, loading, error, partial, note, refresh };
}

export function useLiveLoops() {
  const { logs, loading, error, partial, note, refresh } = useLogs(...DECISION_KEYS);
  const loops = useMemo(() => {
    const pick = (address: string) => logs.filter((l) => l.address.toLowerCase() === address.toLowerCase());
    const rsc = logs.filter((l) => l.chainId === 5318007);
    const baseDecisions = buildDecisions(BASE, pick(BASE.registry), pick(BASE.requester), pick(BASE.vault));
    const uniDecisions = buildDecisions(UNICHAIN, pick(UNICHAIN.registry), pick(UNICHAIN.requester), pick(UNICHAIN.vault));
    return [
      ...buildLoops(BASE, baseDecisions, pick(BASE.vault), rsc),
      ...buildLoops(UNICHAIN, uniDecisions, pick(UNICHAIN.vault), rsc),
    ].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  }, [logs]);
  return { loops, loading, error, partial, note, refresh };
}

export function useLiveSafety() {
  const { logs, loading, error, partial, note, refresh } = useLogs(...SAFETY_KEYS);
  const events = useMemo(
    () => buildSafetyEvents(logs.filter((l) => l.chainId !== 5318007), logs.filter((l) => l.chainId === 5318007)),
    [logs],
  );
  return { events, loading, error, partial, note, refresh };
}

export type { DecisionRow };
