import { formatUnits } from 'viem';
import type { IconName } from '../components/Icon';
import type { StepStatus } from '../components/StepRow';
import type { ChainDeployment } from './deployments';
import type { DecodedEvent } from './logs';
import { shortAddr } from './format';

const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => String(v ?? '');
const usd = (v: unknown, d = 6) => Number(formatUnits(BigInt((v as bigint | undefined) ?? 0n), d));

export function bytes32ToText(value: unknown) {
  const hex = s(value).replace(/^0x/, '');
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (!code) break;
    out += String.fromCharCode(code);
  }
  return out || 'UNKNOWN';
}

export const ACTION_NAMES: Record<number, string> = { 1: 'ACT', 2: 'IGNORE', 3: 'PAUSE' };

export interface ActivityItem {
  id: string;
  kind: IconName;
  text: string;
  ts?: number;
  tx: `0x${string}`;
  chain: 'base' | 'unichain' | 'lasna';
  blockNumber: bigint;
}

function chainKey(chainId: number): 'base' | 'unichain' | 'lasna' {
  return chainId === 84532 ? 'base' : chainId === 1301 ? 'unichain' : 'lasna';
}

/** Human sentences for the vault events the dashboard and safety screens show. */
export function buildActivity(vaultLogs: DecodedEvent[], chainOf: Record<string, ChainDeployment>): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const log of vaultLogs) {
    const chain = chainOf[String(log.chainId)];
    const pool = () => shortAddr(s(log.args.pool ?? log.args.toPool));
    let kind: IconName = 'ok';
    let text = '';
    switch (log.eventName) {
      case 'Deposit':
        kind = 'move';
        text = `${usd(log.args.assets)} USDC deposited by ${shortAddr(s(log.args.owner))}`;
        break;
      case 'Withdraw':
        kind = 'pay';
        text = `${usd(log.args.assets)} USDC withdrawn by ${shortAddr(s(log.args.owner))}`;
        break;
      case 'Rebalanced':
        kind = 'move';
        text = `Verdict #${n(log.args.verdictId)}: moved ${usd(log.args.moved)} USDC to ${pool()} on ${chain?.name ?? ''}`;
        break;
      case 'RebalanceSkipped':
        kind = 'pause';
        text = `Verdict #${n(log.args.verdictId)} skipped: gain below the profit gate`;
        break;
      case 'PausedByVerdict':
        kind = 'pause';
        text = `Vault paused by AI verdict #${n(log.args.verdictId)}`;
        break;
      case 'PausedByReactive':
        kind = 'pause';
        text = `Vault paused by Reactive: ${bytes32ToText(log.args.reason)}`;
        break;
      case 'UnpausedByReactive':
        kind = 'ok';
        text = `Vault resumed by Reactive: ${bytes32ToText(log.args.reason)}`;
        break;
      case 'EmergencyExit':
        kind = 'x';
        text = `Breaker exit: ${usd(log.args.withdrawn)} USDC pulled out of ${pool()}`;
        break;
      case 'PoolUnfrozen':
        kind = 'ok';
        text = `Admin unfroze ${pool()}`;
        break;
      case 'PoolAdded':
        kind = 'ok';
        text = `New pool watched: ${pool()}`;
        break;
      case 'PlanCreated':
        kind = 'ok';
        text = `Standing order #${n(log.args.id)} created: ${usd(log.args.amount)} USDC every ${n(log.args.period)} s`;
        break;
      case 'PlanExecuted':
        kind = 'pay';
        text = `Standing order #${n(log.args.id)} paid ${usd(log.args.amount)} USDC to ${shortAddr(s(log.args.payee))}`;
        break;
      case 'PlanSkipped':
        kind = 'pause';
        text = `Standing order #${n(log.args.id)} skipped: ${s(log.args.reason)}`;
        break;
      case 'PlanCancelled':
        kind = 'x';
        text = `Standing order #${n(log.args.id)} cancelled`;
        break;
      case 'PlanExpired':
        kind = 'x';
        text = `Standing order #${n(log.args.id)} expired after too many empty periods`;
        break;
      default:
        continue;
    }
    items.push({
      id: log.key,
      kind,
      text,
      ts: log.ts,
      tx: log.transactionHash,
      chain: chainKey(log.chainId),
      blockNumber: log.blockNumber,
    });
  }
  return items.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).reverse();
}

export type DecisionOutcome = 'executed' | 'skipped' | 'paused' | 'pending';

export interface DecisionRow {
  chain: ChainDeployment;
  id: number;
  action: number;
  confidenceBps: number;
  target: `0x${string}`;
  requestId: number;
  reasoningHash: `0x${string}`;
  reasoning?: string;
  ts?: number;
  tx: `0x${string}`;
  outcome: DecisionOutcome;
  moved?: bigint;
  request?: DecodedEvent;
  outcomeEvent?: DecodedEvent;
}

export function buildDecisions(
  chain: ChainDeployment,
  registryLogs: DecodedEvent[],
  requesterLogs: DecodedEvent[],
  vaultLogs: DecodedEvent[],
): DecisionRow[] {
  const reasoned = new Map<number, string>();
  for (const log of registryLogs) {
    if (log.eventName === 'VerdictReasoning') reasoned.set(n(log.args.id), s(log.args.reasoning));
  }
  const requests = new Map<number, DecodedEvent>();
  for (const log of requesterLogs) {
    if (log.eventName === 'DecisionRequested') requests.set(n(log.args.id), log);
  }
  const outcomes = new Map<number, DecodedEvent>();
  for (const log of vaultLogs) {
    if (log.eventName === 'Rebalanced' || log.eventName === 'RebalanceSkipped' || log.eventName === 'PausedByVerdict') {
      const id = n(log.args.verdictId);
      const existing = outcomes.get(id);
      // Prefer a completed move over an earlier pause for the same verdict.
      if (!existing || log.eventName === 'Rebalanced') outcomes.set(id, log);
    }
  }
  return registryLogs
    .filter((log) => log.eventName === 'VerdictPosted')
    .map((log) => {
      const id = n(log.args.id);
      const outcomeEvent = outcomes.get(id);
      const outcome: DecisionOutcome =
        outcomeEvent?.eventName === 'Rebalanced'
          ? 'executed'
          : outcomeEvent?.eventName === 'RebalanceSkipped'
            ? 'skipped'
            : outcomeEvent?.eventName === 'PausedByVerdict'
              ? 'paused'
              : 'pending';
      return {
        chain,
        id,
        action: n(log.args.action),
        confidenceBps: n(log.args.confidenceBps),
        target: s(log.args.targetPool) as `0x${string}`,
        requestId: n(log.args.requestId),
        reasoningHash: s(log.args.reasoningHash) as `0x${string}`,
        reasoning: reasoned.get(id),
        ts: log.ts,
        tx: log.transactionHash,
        outcome,
        moved: outcomeEvent?.eventName === 'Rebalanced' ? (outcomeEvent.args.moved as bigint) : undefined,
        request: requests.get(n(log.args.requestId)),
        outcomeEvent,
      };
    })
    .sort((a, b) => b.id - a.id);
}

export interface LiveStep {
  title: string;
  chain: string;
  detail: string;
  status: StepStatus;
  ts?: number;
  tx: `0x${string}`;
  explorer: 'base' | 'unichain' | 'lasna';
  movesFunds?: boolean;
}

export interface LiveLoop {
  id: string;
  chain: ChainDeployment;
  verdictId: number;
  requestId: number;
  name: string;
  kind: 'normal' | 'recovery';
  latency?: number;
  steps: LiveStep[];
  ts?: number;
}

export function buildLoops(
  chain: ChainDeployment,
  decisions: DecisionRow[],
  vaultLogs: DecodedEvent[],
  rscLogs: DecodedEvent[],
): LiveLoop[] {
  const closed = new Map<number, DecodedEvent>();
  for (const log of rscLogs) {
    if (log.eventName === 'LoopClosed' && n(log.args.chainId) === chain.chainId) closed.set(n(log.args.verdictId), log);
  }
  const retried = new Set<number>();
  const stuck = new Set<number>();
  for (const log of rscLogs) {
    if (n(log.args.chainId) !== chain.chainId) continue;
    if (log.eventName === 'ActionRetried') retried.add(n(log.args.id));
    if (log.eventName === 'ActionStuck') stuck.add(n(log.args.id));
  }
  const paused = new Map<number, DecodedEvent>();
  for (const log of vaultLogs) {
    if (log.eventName === 'PausedByVerdict') paused.set(n(log.args.verdictId), log);
  }

  return decisions
    .filter((d) => d.request || d.outcomeEvent)
    .map((d) => {
      const req = d.request;
      const rec = paused.has(d.id) && d.outcome === 'executed';
      const loop = closed.get(d.id);
      const steps: LiveStep[] = [
        {
          title: 'Decision requested',
          chain: chain.name,
          detail: req ? `Gap ${(n(req.args.gapBps) / 100).toFixed(2)}%, risk ${n(req.args.riskScore)}, trigger ${n(req.args.trigger)}` : 'Request event not found',
          status: req ? 'done' : 'failed',
          ts: req?.ts,
          tx: req?.transactionHash ?? d.tx,
          explorer: chain.chain,
        },
        {
          title: 'AI verdict posted',
          chain: chain.name,
          detail: `${ACTION_NAMES[d.action] ?? d.action}, confidence ${(d.confidenceBps / 100).toFixed(0)}%${d.reasoning ? `: ${d.reasoning}` : ''}`,
          status: 'done',
          ts: d.ts,
          tx: d.tx,
          explorer: chain.chain,
        },
        {
          title: d.outcome === 'executed' ? 'Vault re-checked and moved funds' : d.outcome === 'paused' ? 'Vault paused by the verdict' : d.outcome === 'skipped' ? 'Vault skipped the move' : 'Waiting for the vault',
          chain: chain.name,
          detail:
            d.outcome === 'executed'
              ? `${usd(d.moved)} USDC moved after the on-chain rule check`
              : d.outcome === 'skipped'
                ? 'Profit gate or cooldown rejected the move'
                : d.outcome === 'paused'
                  ? 'Deposits stopped; withdrawals and payouts continue'
                  : 'No vault event yet',
          status: d.outcome === 'pending' ? 'waiting' : 'done',
          ts: d.outcomeEvent?.ts,
          tx: d.outcomeEvent?.transactionHash ?? d.tx,
          explorer: chain.chain,
          movesFunds: d.outcome === 'executed',
        },
        {
          title: 'Reactive closed the loop',
          chain: 'Reactive Lasna',
          detail: loop ? `${n(loop.args.requestToRebalanceSecs)} s from request to rebalance` : 'No LoopClosed event for this verdict',
          status: loop ? 'done' : 'waiting',
          ts: loop?.ts,
          tx: loop?.transactionHash ?? d.tx,
          explorer: 'lasna',
        },
      ];
      const latency = loop
        ? n(loop.args.requestToRebalanceSecs)
        : d.ts && d.outcomeEvent?.ts
          ? Math.max(0, Math.round((d.outcomeEvent.ts - d.ts) / 1000))
          : undefined;
      return {
        id: `${chain.chainId}-${d.id}`,
        chain,
        verdictId: d.id,
        requestId: d.requestId,
        name: `Verdict #${d.id}: ${ACTION_NAMES[d.action] ?? d.action}${rec ? ' (retried)' : ''}`,
        kind: rec ? 'recovery' : 'normal',
        latency,
        steps,
        ts: d.ts,
      } satisfies LiveLoop;
    })
    .filter((l) => l.steps[0].status === 'done')
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}

export interface SafetyEvent {
  id: string;
  kind: IconName;
  text: string;
  detail?: string;
  ts?: number;
  tx: `0x${string}`;
  explorer: 'base' | 'unichain' | 'lasna';
}

export function buildSafetyEvents(vaultLogs: DecodedEvent[], rscLogs: DecodedEvent[]): SafetyEvent[] {
  const out: SafetyEvent[] = [];
  for (const log of vaultLogs) {
    const chain = chainKey(log.chainId);
    const pool = shortAddr(s(log.args.pool));
    switch (log.eventName) {
      case 'PausedByReactive':
        out.push({ id: log.key, kind: 'pause', text: `Vault paused by Reactive (${bytes32ToText(log.args.reason)})`, ts: log.ts, tx: log.transactionHash, explorer: chain });
        break;
      case 'UnpausedByReactive':
        out.push({ id: log.key, kind: 'ok', text: `Vault resumed by Reactive (${bytes32ToText(log.args.reason)})`, ts: log.ts, tx: log.transactionHash, explorer: chain });
        break;
      case 'PausedByVerdict':
        out.push({ id: log.key, kind: 'ai', text: `AI verdict #${n(log.args.verdictId)} paused the vault`, ts: log.ts, tx: log.transactionHash, explorer: chain });
        break;
      case 'EmergencyExit':
        out.push({ id: log.key, kind: 'x', text: `Emergency exit from ${pool}: ${usd(log.args.withdrawn)} USDC`, ts: log.ts, tx: log.transactionHash, explorer: chain });
        break;
      case 'PoolUnfrozen':
        out.push({ id: log.key, kind: 'ok', text: `Admin unfroze ${pool}`, ts: log.ts, tx: log.transactionHash, explorer: chain });
        break;
      default:
        break;
    }
  }
  for (const log of rscLogs) {
    switch (log.eventName) {
      case 'BreakerTripped':
        out.push({ id: log.key, kind: 'pause', text: `Breaker tripped on chain ${n(log.args.chainId)}: utilisation ${(n(log.args.utilBps) / 100).toFixed(0)}%`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'BreakerCleared':
        out.push({ id: log.key, kind: 'ok', text: `Breaker cleared on chain ${n(log.args.chainId)}`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'StaleDetected':
        out.push({ id: log.key, kind: 'pause', text: `No rate data for ${n(log.args.silentForSecs)} s: vault on chain ${n(log.args.chainId)} paused`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'StaleHealed':
        out.push({ id: log.key, kind: 'ok', text: `Fresh rate data: chain ${n(log.args.chainId)} unpaused`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'OmniPause':
        out.push({ id: log.key, kind: 'pause', text: `Omnichain pause: chain ${n(log.args.pausedChainId)} paused by chain ${n(log.args.sourceChainId)}`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'OmniHeal':
        out.push({ id: log.key, kind: 'ok', text: `Omnichain heal: chain ${n(log.args.chainId)} resumed`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'ActionRetried':
        out.push({ id: log.key, kind: 'retry', text: `Action retried (kind ${n(log.args.kind)}, id ${n(log.args.id)}, attempt ${n(log.args.attempt)} of 3)`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'ActionStuck':
        out.push({ id: log.key, kind: 'x', text: `Action stuck after 3 attempts (kind ${n(log.args.kind)}, id ${n(log.args.id)})`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      case 'ExitObserved':
        out.push({ id: log.key, kind: 'x', text: `Reactive saw an emergency exit of ${usd(log.args.withdrawn)} USDC on chain ${n(log.args.chainId)}`, ts: log.ts, tx: log.transactionHash, explorer: 'lasna' });
        break;
      default:
        break;
    }
  }
  return out.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).reverse();
}

export function nextPayouts(plans: { active: boolean; nextDue: bigint; amount: bigint; payee: `0x${string}`; id: number; chain: { name: string } }[]) {
  return plans
    .filter((p) => p.active)
    .sort((a, b) => Number(a.nextDue - b.nextDue))
    .slice(0, 3)
    .map((p) => ({ ...p, dueMs: Number(p.nextDue) * 1000 }));
}
