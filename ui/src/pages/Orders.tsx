import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Dialog } from '../components/Dialog';
import { HistoryNote } from '../components/HistoryNote';
import { Pill } from '../components/Pill';
import { Segmented } from '../components/Segmented';
import { SourceTag } from '../components/SourceTag';
import { TxReceipt } from '../components/TxReceipt';
import type { IconName } from '../components/Icon';
import { makeHash, type Order } from '../data/mock';
import { useNow } from '../hooks/useNow';
import { usePlans, planTotals, type LivePlan } from '../hooks/usePlans';
import { useVault } from '../hooks/useVault';
import { useWrites } from '../hooks/useWrites';
import { countdown, shortAddr, usdc } from '../lib/format';
import { BASE, explorerTx } from '../lib/deployments';
import { LIVE } from '../lib/mode';
import { useApp } from '../state/AppState';

const BADGE: Record<Order['state'], { tone: 'ok' | 'warn' | 'bad' | 'mute'; icon: IconName; text: string }> = {
  active: { tone: 'ok', icon: 'ok', text: 'Active' }, retrying: { tone: 'warn', icon: 'retry', text: 'Retrying' },
  skipped: { tone: 'mute', icon: 'pause', text: 'Skipped' }, stuck: { tone: 'bad', icon: 'x', text: 'Needs attention' },
  completed: { tone: 'mute', icon: 'ok', text: 'Completed' }, cancelled: { tone: 'mute', icon: 'x', text: 'Cancelled' },
};

const LIVE_BADGE: Record<LivePlan['state'], { tone: 'ok' | 'warn' | 'bad' | 'mute'; icon: IconName; text: string }> = {
  active: { tone: 'ok', icon: 'ok', text: 'Active' },
  skipped: { tone: 'warn', icon: 'pause', text: 'Skipped' },
  completed: { tone: 'mute', icon: 'ok', text: 'Completed' },
  cancelled: { tone: 'mute', icon: 'x', text: 'Cancelled' },
  expired: { tone: 'bad', icon: 'x', text: 'Expired' },
};

const EVENT_LABEL: Record<string, string> = {
  PlanCreated: 'Created',
  PlanExecuted: 'Paid',
  PlanSkipped: 'Skipped',
  PlanCancelled: 'Cancelled',
  PlanExpired: 'Expired',
};

function LiveOrderCard({ p }: { p: LivePlan }) {
  const writes = useWrites();
  const now = useNow();
  const [hist, setHist] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const b = LIVE_BADGE[p.state];
  const totals = planTotals(p);
  const cancelling = (writes.tx.stage === 'signing' || writes.tx.stage === 'pending') && writes.tx.chain?.chainId === p.chain.chainId && writes.tx.label.startsWith('Cancel');
  const continueAfterSwitch = writes.switchChainAndContinue;
  useEffect(() => {
    if (writes.tx.stage === 'wrong-network' && writes.tx.chain?.chainId === p.chain.chainId) void continueAfterSwitch();
  }, [p.chain.chainId, writes.tx.stage, writes.tx.chain?.chainId, continueAfterSwitch]);

  return (
    <Card className="mb-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b className="text-[19px] font-medium">Order #{p.id}</b>{' '}
          <button className="text-[13px] text-mut hover:text-ink" title={p.payee} onClick={() => { navigator.clipboard?.writeText(p.payee); }}>{shortAddr(p.payee)} copy</button></div>
        <Pill tone={b.tone} icon={b.icon}>{b.text}</Pill>
      </div>
      <div className="my-2 text-[40px] tracking-[-0.045em]">{usdc(Number(p.amount) / 1e6)} <span className="text-lg text-mut">USDC</span></div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
        <div><span className="block text-xs text-mut">Every</span>{p.period >= 86400 ? `${Math.round(p.period / 86400)} d` : `${p.period} s`}</div>
        <div><span className="block text-xs text-mut">Payments left</span>{p.remaining}</div>
        <div><span className="block text-xs text-mut">Next due</span>{p.active ? countdown(Number(p.nextDue) * 1000, now) : 'None'}</div>
        <div><span className="block text-xs text-mut">Source</span>{p.mode === 0 ? 'Yield only' : 'Yield, then principal'}</div>
        <div><span className="block text-xs text-mut">Paid</span>{totals.paid}</div>
        <div><span className="block text-xs text-mut">Skipped</span>{p.skips}</div>
      </div>
      {p.state === 'skipped' && <p className="mt-3 text-[13px] text-mut">This order skipped its last {p.skips} payment{p.skips === 1 ? '' : 's'} because yield was short. It pays automatically once enough yield accrues.</p>}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" small onClick={() => setHist(!hist)}>History</Button>
        {p.active && <Button variant="outline" small onClick={() => setConfirm(true)}>Cancel order</Button>}
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Cancel order #${p.id}?`}
        description={`This stops future payouts on ${p.chain.name}. Your deposit stays in the vault and remains yours.`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button small variant="outline" onClick={() => setConfirm(false)}>Keep order</Button>
          <Button
            small
            className="!bg-red !text-white"
            disabled={cancelling}
            onClick={() => { setConfirm(false); void writes.cancelPlan(p.chain, p.id); }}
          >
            {cancelling ? 'Cancelling…' : 'Yes, cancel'}
          </Button>
        </div>
      </Dialog>
      {writes.tx.chain?.chainId === p.chain.chainId && (
        <TxReceipt tx={writes.tx} switchLabel={`Switch to ${p.chain.name}`} onSwitch={() => void writes.switchChainAndContinue()} />
      )}
      {hist && <div className="mt-3 border-t border-line">
        {p.history.length === 0 && <p className="py-3 text-[13px] text-mut">No events for this order yet.</p>}
        {p.history.map((e) => {
          const amount = e.eventName === 'PlanExecuted' ? `${usdc(Number(e.args.amount ?? 0) / 1e6)} USDC` : e.eventName === 'PlanSkipped' ? String(e.args.reason ?? '') : '';
          return <div key={e.key} className="flex flex-wrap justify-between gap-3 border-t border-line py-3 text-[13px] first:border-0">
            <div>{EVENT_LABEL[e.eventName] ?? e.eventName}<div className="text-mut">{amount}{e.ts ? ` · ${new Date(e.ts).toLocaleString()}` : ''}</div></div>
            <a href={explorerTx(p.chain.chain, e.transactionHash)} target="_blank" rel="noreferrer" className="text-acc">{shortAddr(e.transactionHash)}</a>
          </div>;
        })}
      </div>}
    </Card>
  );
}

function OrderCard({ o, yieldNow }: { o: Order; yieldNow: number }) {
  const { setOrders, toast } = useApp();
  const now = useNow();
  const [hist, setHist] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const rows = useMemo(() => [2, 1].map((n) => ({ n, tx: makeHash() })), []);
  const live = o.state === 'active' || o.state === 'retrying' || o.state === 'skipped';
  const b = BADGE[o.state];
  const patch = (p: Partial<Order>) => { if (LIVE) return; setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, ...p } : x))); };
  return (
    <Card className="mb-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b className="text-[19px] font-medium">{o.name}</b>{' '}
          <button className="text-[13px] text-mut hover:text-ink" title={o.payee} onClick={() => { navigator.clipboard?.writeText(o.payee); toast('Address copied'); }}>{shortAddr(o.payee)} copy</button></div>
        <Pill tone={b.tone} icon={b.icon}>{o.state === 'skipped' ? `Skipped: ${o.why}` : o.state === 'retrying' ? `Retrying (attempt ${o.attempt ?? 2} of 3)` : b.text}</Pill>
      </div>
      <div className="my-2 text-[40px] tracking-[-0.045em]">{usdc(o.amount)} <span className="text-lg text-mut">USDC</span></div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
        <div><span className="block text-xs text-mut">Period</span>{o.period}</div>
        <div><span className="block text-xs text-mut">Payments left</span>{o.left}</div>
        <div><span className="block text-xs text-mut">Next due</span>{live ? countdown(o.next, now) : 'None'}</div>
        <div className="col-span-2 sm:col-span-3"><span className="block text-xs text-mut">Source</span>{o.mode === 'yield' ? 'Yield only' : 'Yield, then principal'}</div>
      </div>
      {o.state === 'skipped' && <p className="mt-3 text-[13px] text-mut">Your yield is {LIVE ? 'not read' : `${usdc(yieldNow)} USDC`}, less than this payment. <button className="text-acc underline" onClick={() => patch({ mode: 'yield-principal', state: 'active' })}>Also use your deposit</button>, or wait for more yield.</p>}
      {o.state === 'retrying' && <p className="mt-3 text-[13px] text-mut">Attempt {o.attempt ?? 2} of 3. The earlier callback did not complete, so the RSC is retrying automatically. This is recovery time, not a faster loop.</p>}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" small onClick={() => setHist(!hist)}>History</Button>
        {live && !LIVE && <Button variant="outline" small onClick={() => setConfirm(true)}>Cancel order</Button>}
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Cancel this order?"
        description="This is the demo replay: the seeded order stops, and nothing on chain changes."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button small variant="outline" onClick={() => setConfirm(false)}>Keep order</Button>
          <Button small className="!bg-red !text-white" onClick={() => { patch({ state: 'cancelled' }); setConfirm(false); toast('Order cancelled'); }}>Yes, cancel</Button>
        </div>
      </Dialog>
      {hist && <div className="mt-3 border-t border-line">{rows.map((r, i) => {
        const fromYield = o.mode === 'yield-principal' && i === 1 ? Math.min(o.amount, yieldNow) : o.amount;
        return <div key={r.n} className="flex justify-between gap-3 border-t border-line py-3 text-[13px] first:border-0">
          <div>{new Date(Date.now() - r.n * 864e5).toLocaleDateString()}<div className="text-mut">{usdc(o.amount)} USDC, yield {usdc(fromYield)}, principal {usdc(o.amount - fromYield)}</div></div>
          <span className="text-mut" title="Demo placeholder, not an on-chain transaction">{r.tx}</span></div>;
      })}</div>}
    </Card>
  );
}

const PERIODS = [{ label: '2 min', sec: 120 }, { label: 'day', sec: 86400 }, { label: '7 days', sec: 604800 }];

export default function Orders() {
  const { orders, setOrders, balance, deposited, toast } = useApp();
  const plans = usePlans();
  const vault = useVault();
  const writes = useWrites();
  const { isConnected, chainId: walletChainId } = useAccount();
  const yieldNow = LIVE ? vault.yieldNum ?? 0 : balance - deposited;
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('50.00');
  const [period, setPeriod] = useState(0);
  const [count, setCount] = useState('8');
  const [mode, setMode] = useState<Order['mode']>('yield');
  const [err, setErr] = useState('');
  const v = parseFloat(amount) || 0;
  const wouldSkip = !LIVE && mode === 'yield' && v > yieldNow;
  const creating = (writes.tx.stage === 'signing' || writes.tx.stage === 'pending') && writes.tx.label === 'Create standing order';
  const continueAfterSwitch = writes.switchChainAndContinue;
  useEffect(() => {
    if (LIVE && writes.tx.stage === 'wrong-network') void continueAfterSwitch();
  }, [LIVE, writes.tx.stage, continueAfterSwitch]);

  function create() {
    if (LIVE) {
      if (!isConnected) return toast('Connect a wallet first');
      if (writes.tx.stage === 'wrong-network') { void writes.switchChainAndContinue(); return; }
      if (!/^0x[0-9a-fA-F]{40}$/.test(payee.trim())) return setErr('Enter a full address: 0x followed by 40 characters.');
      const n = parseInt(count);
      if (!(v > 0) || !(n > 0)) return setErr('Amount and payments must be above 0');
      if (n > 365) return setErr('Payments must be 365 or fewer.');
      setErr('');
      void writes.createPlan(payee.trim() as `0x${string}`, amount, PERIODS[period].sec, n, mode === 'yield' ? 0 : 1);
      return;
    }
    if (!isConnected) return toast('Connect the demo wallet first');
    const n = parseInt(count);
    if (!(v > 0) || !(n > 0)) return toast('Amount and payments must be above 0');
    setErr('');
    const p = PERIODS[period];
    setOrders((os) => [{ id: crypto.randomUUID(), name: 'New order', payee: payee.trim(), amount: v, period: `Every ${p.label}`, left: n, mode, next: Date.now() + p.sec * 1000, state: wouldSkip ? 'skipped' : 'active', why: 'No yield yet' }, ...os]);
    toast('Standing order created');
  }
  const field = 'w-full rounded-[14px] border border-line bg-c2 px-3.5 py-2.5 text-base outline-none focus:border-teal';
  const wrongNetwork = LIVE && isConnected && walletChainId !== BASE.chainId;

  return (
    <main className="shell pb-8 pt-7">
      <div className="flex items-center justify-between"><h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Standing orders</h1>
        <a href="#nf" className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-[#04201c] md:hidden">New order</a></div>
      <p className="mt-1.5 text-mut">Pay someone on a schedule, with no one pressing a button.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">{LIVE ? <SourceTag kind="live" source="vault.plans · PlanCreated/Executed/Skipped events" /> : <SourceTag kind="sample" reason="order rows and actions are local" />}</div>
      <div className="mt-5 grid items-start gap-4 md:grid-cols-[1.25fr_1fr]">
        <div>
          {LIVE && plans.loading && <Card className="mb-3.5"><p className="text-[13px] text-mut">Reading standing orders from both vaults…</p></Card>}
          {LIVE && plans.error && <Card className="mb-3.5"><p className="text-[13px] text-red">Could not read plans: {plans.error}</p></Card>}
          {LIVE && plans.note && <Card className="mb-3.5"><HistoryNote note={plans.note} className="" /></Card>}
          {LIVE && !plans.loading && !plans.error && plans.plans.length === 0 && <Card className="mb-3.5"><h3 className="text-lg font-medium tracking-tight">No standing orders yet</h3><p className="mt-2 text-[13px] text-mut">Create one on Base Sepolia with the form. Orders from both chains appear here.</p></Card>}
          {LIVE ? plans.plans.map((p) => <LiveOrderCard key={`${p.chain.chainId}-${p.id}`} p={p} />) : orders.map((o) => <OrderCard key={o.id} o={o} yieldNow={yieldNow} />)}
        </div>
        <Card id="nf" className="scroll-mt-36 md:sticky md:top-24">
          <h3 className="text-lg font-medium tracking-tight">New standing order</h3>
          <label className="mb-1.5 mt-4 block text-[13px] text-mut">Payee address</label>
          <input className={field} value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="0x..." autoComplete="off" />
          {err && <div className="mt-1 text-[13px] text-red">{err}</div>}
          <div className="mt-4">
            <label className="mb-1.5 block text-[13px] text-mut">Amount, USDC</label>
            <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-[13px] text-mut">Every</label>
            <Segmented id="period" value={String(period)} onChange={(v) => setPeriod(Number(v))} options={PERIODS.map((p, i) => ({ value: String(i), label: p.label }))} />
          </div>
          <label className="mb-1.5 mt-4 block text-[13px] text-mut">Number of payments</label>
          <input className={field} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          <label className="mb-1.5 mt-4 block text-[13px] text-mut">Pay from</label>
          <Segmented id="srcmode" value={mode} onChange={setMode} options={[{ value: 'yield', label: 'Yield only' }, { value: 'yield-principal', label: 'Yield, then principal' }]} />
          <p className="mt-2 text-[13px] text-mut">{mode === 'yield' ? 'Your deposit is never touched. Skipped if there is no yield yet.' : 'Always pays, using your deposit if yield runs short.'}</p>
          <Banner tone={wouldSkip ? 'warn' : 'info'}>Available yield right now: <b>{LIVE ? (isConnected ? `${usdc(yieldNow)} USDC` : 'connect a wallet') : `${usdc(yieldNow)} USDC`}</b>{wouldSkip && '. This order would be skipped. Switch to Yield, then principal, or lower the amount.'}</Banner>
          {wrongNetwork && <p className="mt-2 text-[13px] text-amb">Creating an order is on Base Sepolia. Your wallet is on another network; use the switch button to continue.</p>}
          {LIVE && <TxReceipt tx={writes.tx} switchLabel="Switch to Base Sepolia" onSwitch={() => void writes.switchChainAndContinue()} />}
          <Button className="mt-4 w-full" disabled={(LIVE && creating) || (!LIVE && !isConnected)} onClick={create}>{LIVE ? (creating ? 'Creating…' : writes.tx.stage === 'wrong-network' ? 'Switch to Base Sepolia' : 'Create order') : isConnected ? 'Create order' : 'Connect wallet'}</Button>
        </Card>
      </div>
    </main>
  );
}
