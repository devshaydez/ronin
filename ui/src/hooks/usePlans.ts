import { useReadContract, useReadContracts } from 'wagmi';
import { vaultAbi } from '../lib/abis';
import { BASE, UNICHAIN, type ChainDeployment } from '../lib/deployments';
import { LIVE } from '../lib/mode';
import { byEvent, useLogs } from './useLogs';
import type { DecodedEvent } from '../lib/logs';

export type PlanState = 'active' | 'skipped' | 'completed' | 'cancelled' | 'expired';

export interface LivePlan {
  chain: ChainDeployment;
  id: number;
  owner: `0x${string}`;
  payee: `0x${string}`;
  amount: bigint;
  period: number;
  nextDue: bigint;
  remaining: number;
  active: boolean;
  mode: 0 | 1;
  skips: number;
  state: PlanState;
  history: DecodedEvent[];
}

function toPlan(chain: ChainDeployment, id: number, raw: readonly unknown[], history: DecodedEvent[]): LivePlan {
  const owner = raw[0] as `0x${string}`;
  const payee = raw[1] as `0x${string}`;
  const amount = raw[2] as bigint;
  const period = Number(raw[3] ?? 0);
  const nextDue = raw[4] as bigint;
  const remaining = Number(raw[5] ?? 0);
  const active = Boolean(raw[6]);
  const mode = Number(raw[7] ?? 0) as 0 | 1;
  const skips = Number(raw[8] ?? 0);
  const cancelled = history.some((e) => e.eventName === 'PlanCancelled');
  const expired = history.some((e) => e.eventName === 'PlanExpired');
  const state: PlanState = active
    ? skips > 0
      ? 'skipped'
      : 'active'
    : cancelled
      ? 'cancelled'
      : expired
        ? 'expired'
        : remaining === 0
          ? 'completed'
          : 'cancelled';
  return { chain, id, owner, payee, amount, period, nextDue, remaining, active, mode, skips, state, history };
}

function useChainPlans(chain: ChainDeployment, history: DecodedEvent[]) {
  const count = useReadContract({
    abi: vaultAbi,
    address: chain.vault,
    functionName: 'planCount',
    chainId: chain.chainId,
    query: { enabled: LIVE, refetchInterval: 20_000 },
  });
  const total = Number(count.data ?? 0);
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
  const reads = useReadContracts({
    contracts: ids.map((id) => ({ abi: vaultAbi, address: chain.vault, functionName: 'plans' as const, args: [id], chainId: chain.chainId })),
    query: { enabled: LIVE && total > 0, refetchInterval: 20_000 },
  });
  const plans: LivePlan[] = [];
  ids.forEach((id, i) => {
    const raw = reads.data?.[i]?.result as readonly unknown[] | undefined;
    if (!raw) return;
    const key = chain.chain;
    const mine = history.filter((e) => e.address === chain.vault && Number(e.args.id ?? -1) === Number(id));
    plans.push(toPlan(chain, Number(id), raw, mine));
  });
  return { plans, loading: count.isLoading || reads.isLoading, error: count.error ?? reads.error };
}

/** Every plan on both vaults, with its payout/skip/cancel history from the event reader. */
export function usePlans() {
  const logs = useLogs('baseVault', 'uniVault');
  const base = useChainPlans(BASE, logs.logs);
  const uni = useChainPlans(UNICHAIN, logs.logs);
  const plans = [...base.plans, ...uni.plans].sort((a, b) => a.chain.chainId - b.chain.chainId || a.id - b.id);
  return {
    plans,
    active: plans.filter((p) => p.active),
    loading: logs.loading || base.loading || uni.loading,
    error: logs.error ?? (base.error as Error | null)?.message ?? (uni.error as Error | null)?.message,
    partial: logs.partial,
    note: logs.note,
    isLive: logs.isLive && !base.error && !uni.error,
    refresh: logs.refresh,
  };
}

/** How many payments landed vs skipped for a plan, for the live order card. */
export function planTotals(plan: LivePlan) {
  const paid = byEvent(plan.history, 'PlanExecuted');
  const skipped = byEvent(plan.history, 'PlanSkipped');
  return { paid: paid.length, skipped: skipped.length, paidEvents: paid, skippedEvents: skipped };
}
