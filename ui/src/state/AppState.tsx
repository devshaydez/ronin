import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IconName } from '../components/Icon';
import type { StepStatus } from '../components/StepRow';
import { liveEventPool, makeHash, mockFeed, mockOrders, mockVault, type FeedEvent, type Order } from '../data/mock';
import { PAY, REB, REC, SAF, type StepDef } from '../data/pipeline';
import { LATENCY_TOTAL_SECONDS, RECOVERY_CASE } from '../data/latency';

export type Mode = 'ok' | 'paused' | 'exit' | 'wrong' | 'nousdc' | 'rec';
export interface Loop { id: string; name: string; steps: StepDef[]; status: StepStatus[]; ts: number[]; hashes: string[]; latency: number; running: boolean; startedAt: number; aiStart?: number; kind: 'normal' | 'recovery' }
/** How much faster than real time the demo loops play. */
export const SPEED = 0.55;

function seed(name: string, steps: StepDef[], latency: number, ageSec: number, kind: Loop['kind'] = 'normal'): Loop {
  const t0 = Date.now() - ageSec * 1000; let c = t0;
  return { id: crypto.randomUUID(), name, steps, status: steps.map(() => 'done'), ts: steps.map((s) => { const v = c; c += s.sec * 1000; return v; }), hashes: steps.map(makeHash), latency, running: false, startedAt: t0, kind };
}

interface Ctx {
  mode: Mode; setMode: (m: Mode) => void; failNext: boolean; setFailNext: (b: boolean) => void;
  balance: number; deposited: number; adjustBalance: (d: number) => void; walletUsdc: number; adjustWallet: (d: number) => void;
  orders: Order[]; setOrders: Dispatch<SetStateAction<Order[]>>;
  demoConnected: boolean; setDemoConnected: (b: boolean) => void; network: number; setNetwork: (id: number) => void;
  feed: FeedEvent[]; addEvent: (k: IconName, t: string) => void;
  loops: Loop[]; selected: string; setSelected: (id: string) => void; running: boolean;
  runLoop: (steps: StepDef[], name: string, fin?: () => void, kind?: Loop['kind']) => void;
  demoFlag: boolean; setDemoFlag: (b: boolean) => void; debt: number; toggleDebt: () => void;
  toast: (m: string) => void;
}
const AppCtx = createContext<Ctx>(null!);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('ok');
  const [failNext, setFailNext] = useState(false);
  const [balance, setBalance] = useState(mockVault.balance);
  const [walletUsdc, setWallet] = useState(mockVault.walletUsdc);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [feed, setFeed] = useState<FeedEvent[]>(mockFeed);
  const [loops, setLoops] = useState<Loop[]>(() => [seed('AI-gated rebalance', REB, LATENCY_TOTAL_SECONDS, 190), seed('Retry that healed (verdict 44)', REC, RECOVERY_CASE.seconds, 640, 'recovery'), seed('Standing order payout', PAY, 6.8, 1100), seed('Safety resume', SAF, 9.1, 2500)]);
  const [selected, setSelected] = useState('');
  const [running, setRunning] = useState(false);
  const [demoFlag, setDemoFlag] = useState(true);
  const [debt, setDebt] = useState(0);
  const [demoConnected, setDemoConnected] = useState(true);
  const [network, setNetwork] = useState(84532);
  const [msg, setMsg] = useState('');
  const timer = useRef<number>();

  const toast = useCallback((m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(''), 2800); }, []);
  const addEvent = useCallback((kind: IconName, text: string) => setFeed((f) => [{ id: crypto.randomUUID(), kind, text, ts: Date.now(), hash: makeHash() }, ...f].slice(0, 40)), []);

  useEffect(() => {
    if (mode === 'paused') return;
    const t = setInterval(() => { const [k, x] = liveEventPool[Math.floor(Math.random() * liveEventPool.length)]; addEvent(k, x); }, 8000);
    return () => clearInterval(t);
  }, [mode, addEvent]);

  const runLoop = useCallback((steps: StepDef[], name: string, fin?: () => void, kind: Loop['kind'] = 'normal') => {
    const id = crypto.randomUUID(); const t0 = Date.now(); let i = 0;
    const patch = (fn: (l: Loop) => Loop) => setLoops((ls) => ls.map((l) => (l.id === id ? fn(l) : l)));
    setLoops((ls) => [{ id, name, steps, status: steps.map(() => 'waiting'), ts: [], hashes: steps.map(makeHash), latency: 0, running: true, startedAt: t0, kind }, ...ls]);
    setSelected(id); setRunning(true);
    const next = () => {
      if (i >= steps.length) {
        const latency = kind === 'recovery' ? RECOVERY_CASE.seconds : (Date.now() - t0) / 1000;
        patch((l) => ({ ...l, running: false, latency })); setRunning(false);
        if (kind === 'recovery') addEvent('ok', `Recovery complete in ${RECOVERY_CASE.seconds} s (attempt 2 of 3): retry healed, not a faster loop`);
        else addEvent(steps === REB ? 'move' : 'ok', `${steps === REB ? 'Moved your money to a better pool' : name + ' finished'}, loop took ${latency.toFixed(1)} s`);
        fin?.(); return;
      }
      const k = i;
      patch((l) => { const status = [...l.status]; status[k] = 'running'; const ts = [...l.ts]; ts[k] = Date.now(); return { ...l, status, ts, aiStart: steps === REB && k === 3 ? Date.now() : l.aiStart }; });
      if (kind === 'recovery' && k === 4) addEvent('retry', 'Retrying (attempt 2 of 3): vault unpaused, sending the same verdict again');
      if (kind === 'recovery' && k === 6) addEvent('move', 'Retry healed: 498.76 USDC moved to Pool U');
      setTimeout(() => { patch((l) => { const status = [...l.status]; status[k] = 'done'; return { ...l, status }; }); i++; next(); }, steps[k].sec * SPEED * 1000);
    };
    next();
  }, [addEvent]);

  const value: Ctx = {
    mode, setMode, failNext, setFailNext, balance, deposited: mockVault.deposited, adjustBalance: (d) => setBalance((b) => b + d),
    walletUsdc, adjustWallet: (d) => setWallet((w) => w + d), orders, setOrders, feed, addEvent, loops, selected, setSelected, running, runLoop,
    demoConnected, setDemoConnected, network, setNetwork, demoFlag, setDemoFlag, debt, toggleDebt: () => setDebt((d) => (d ? 0 : 0.35)), toast,
  };
  return (
    <AppCtx.Provider value={value}>
      {children}
      <AnimatePresence>
        {msg && <motion.div initial={{ opacity: 0, y: 40, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 40, x: '-50%' }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 z-30 rounded-full border border-teal bg-c2 px-5 py-3">{msg}</motion.div>}
      </AnimatePresence>
    </AppCtx.Provider>
  );
}
