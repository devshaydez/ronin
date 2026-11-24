import { useReducer, useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { Segmented } from './Segmented';
import { SourceTag } from './SourceTag';
import { makeHash } from '../data/mock';
import { usdc } from '../lib/format';
import { LIVE } from '../lib/mode';
import { useApp } from '../state/AppState';

type Stage = 'idle' | 'pending' | 'approved' | 'done' | 'failed';
type Flow = { stage: Stage; step: 0 | 1; hash: string };
type Act = { t: 'send' } | { t: 'ok' } | { t: 'fail' } | { t: 'reset' };
function flow(s: Flow, a: Act): Flow {
  switch (a.t) {
    case 'send': return { ...s, stage: 'pending', hash: makeHash() };
    case 'ok': return s.step === 0 ? { ...s, stage: 'approved', step: 1 } : { stage: 'done', step: 0, hash: s.hash };
    case 'fail': return { ...s, stage: 'failed' };
    default: return { stage: 'idle', step: 0, hash: '' };
  }
}

/** Approve then deposit as two steps, with pending, confirmed and failed states. */
export function DepositCard({ balance }: { balance: number }) {
  const w = useWallet();
  const { mode, setMode, walletUsdc, adjustBalance, adjustWallet, addEvent, failNext, setFailNext, toast } = useApp();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('100.00');
  const [error, setError] = useState('');
  const [s, dispatch] = useReducer(flow, { stage: 'idle', step: 0, hash: '' });

  const withdraw = tab === 'withdraw';
  const max = withdraw ? balance : walletUsdc;
  const paused = mode === 'paused' && !withdraw;

  if (!withdraw && (mode === 'nousdc' || walletUsdc <= 0)) {
    return (
      <Card>
        <Segmented id="dtab" value={tab} onChange={setTab} options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdraw', label: 'Withdraw' }]} />
        <h3 className="mt-5 text-[30px] font-medium leading-tight tracking-tight">You have no test USDC</h3>
        <p className="my-2 text-mut">Mint some on Base Sepolia from the demo faucet, then come back to deposit.</p>
        <Button onClick={() => { adjustWallet(1000); setMode('ok'); toast('Minted 1,000 test USDC'); }}>Mint 1,000 test USDC</Button>
      </Card>
    );
  }

  function submit() {
    if (LIVE) return toast('On-chain deposit and withdraw writes are not wired in this UI build');
    if (!w.connected) return w.connect();
    if (mode === 'wrong') { setMode('ok'); return toast('Switched to Base Sepolia'); }
    const v = parseFloat(amount);
    if (!(v > 0)) return setError('Enter an amount above 0.');
    if (v > max) return setError('That is more than you have available.');
    setError('');
    dispatch({ t: 'send' });
    // TODO: replace the timer with wagmi useWriteContract (approve, then deposit or withdraw)
    // and wait with useWaitForTransactionReceipt.
    setTimeout(() => {
      if (failNext) { setFailNext(false); return dispatch({ t: 'fail' }); }
      dispatch({ t: 'ok' });
      if (withdraw) { adjustBalance(-v); addEvent('pay', `You withdrew ${usdc(v)} USDC`); }
      else if (s.step === 1) { adjustBalance(v); adjustWallet(-v); addEvent('move', `You deposited ${usdc(v)} USDC, placed in Pool B`); }
    }, 1900);
  }

  const label = LIVE ? 'On-chain writes not wired' : !w.connected ? 'Connect wallet' : mode === 'wrong' ? 'Switch network' : withdraw ? 'Withdraw' : s.step === 0 ? 'Approve USDC' : 'Deposit';
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Segmented id="dtab" value={tab} onChange={(t) => { setTab(t); dispatch({ t: 'reset' }); }} options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdraw', label: 'Withdraw' }]} /><SourceTag kind="sample" reason="deposit/withdraw is a local simulation; no transaction is signed" /></div>
      <div className={`my-4 flex items-center gap-2.5 rounded-2xl border bg-c2 px-4 py-3 ${error ? 'border-red' : 'border-line'}`}>
        <input aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} className="min-w-0 flex-1 bg-transparent text-base tracking-tight outline-none sm:text-[28px]" />
        <span className="text-mut">USDC</span>
        <button disabled={LIVE} onClick={() => setAmount(max.toFixed(2))} className="rounded-full bg-teal/15 px-3 py-1 text-[13px] text-acc disabled:opacity-40">Max</button>
      </div>
      <div className="text-[13px] text-mut">{withdraw ? 'Vault' : 'Wallet'}: <span title={LIVE ? 'Not connected' : max.toFixed(6)}>{LIVE && !w.connected ? '—' : usdc(max)}</span> USDC</div>
      {error && <div className="mt-1 text-[13px] text-red">{error}</div>}
      {!withdraw && (
        <div className="my-3 grid grid-cols-2 gap-2 text-[13px]">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${s.step === 1 ? 'bg-teal/15 text-acc' : 'bg-c2 text-mut'}`}>{s.step === 1 && <Icon name="ok" size={14} />}1 Approve</div>
          <div className="rounded-xl bg-c2 px-3 py-2 text-mut">2 Deposit</div>
        </div>
      )}
      {paused && <p className="my-2 text-[13px] text-mut">Deposits are off while the vault is paused. Withdrawals still work.</p>}
      <div className="my-2 flex min-h-[26px] flex-wrap items-center gap-2.5 text-sm" aria-live="polite">
        {s.stage === 'pending' && <><span className="spinner" />Waiting for confirmation <span className="text-mut" title="Demo placeholder, not an on-chain transaction">{s.hash}</span></>}
        {s.stage === 'approved' && <><span className="text-acc"><Icon name="ok" size={16} /></span>Approved. Now deposit.</>}
        {s.stage === 'done' && <><span className="text-acc"><Icon name="ok" size={16} /></span>Confirmed <span className="text-mut" title="Demo placeholder, not an on-chain transaction">{s.hash}</span></>}
        {s.stage === 'failed' && <><span className="text-red"><Icon name="x" size={16} /></span>Transaction failed. You rejected the request, so nothing was spent. <button className="text-acc underline" onClick={submit}>Try again</button></>}
      </div>
      <Button className="mt-1 w-full" disabled={paused || s.stage === 'pending'} onClick={submit}>{label}</Button>
    </Card>
  );
}
