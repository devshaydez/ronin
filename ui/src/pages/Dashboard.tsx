import { AnimatePresence, motion } from 'framer-motion';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DepositCard } from '../components/DepositCard';
import { Icon } from '../components/Icon';
import { Pill } from '../components/Pill';
import { StatusPill } from '../components/StatusPill';
import { useNow } from '../hooks/useNow';
import { useVault } from '../hooks/useVault';
import { useWallet } from '../hooks/useWallet';
import { countdown, rel, shortAddr, usdc } from '../lib/format';
import { useApp } from '../state/AppState';

export default function Dashboard() {
  const now = useNow();
  const v = useVault();
  const w = useWallet();
  const { mode, setMode, balance: sample, deposited, orders, feed, toast } = useApp();
  const balance = v.balance ?? sample;
  const upcoming = orders.filter((o) => o.state === 'active' || o.state === 'retrying').sort((a, b) => a.next - b.next).slice(0, 3);

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Your vault</h1>
        <StatusPill mode={mode} />
      </div>
      {!w.connected && <Banner action={<Button small onClick={w.connect}>Connect wallet</Button>}>Sample data. Connect to see yours.</Banner>}
      {mode === 'paused' && <Banner tone="warn"><b>Vault paused by the AI safety check.</b> Deposits are off. Withdrawals and payouts keep working. It resumes on its own when rates return to normal.</Banner>}
      {mode === 'exit' && <Banner tone="warn"><b>Funds were moved out of Pool B to protect you.</b> They are idle in the vault and still yours.</Banner>}
      {mode === 'rec' && <Banner tone="warn"><b>Rates are settling.</b> The vault resumes by itself once they stay normal for 5 minutes.</Banner>}
      {mode === 'wrong' && <Banner tone="warn" action={<Button small onClick={() => { setMode('ok'); toast('Switched to Base Sepolia'); }}>Switch network</Button>}>Switch to Base Sepolia to continue.</Banner>}

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <div className="grid gap-4">
          <Card>
            <div className="text-[13px] text-mut">Vault balance</div>
            <div className="my-2 text-[40px] leading-[1.05] tracking-[-0.045em] sm:text-[54px]" title={`${balance.toFixed(6)} USDC`}>{usdc(balance)} <span className="text-xl text-mut">USDC</span></div>
            <div className="flex flex-wrap justify-between gap-2 text-[13px] text-mut">
              <span>Yield earned <b className="text-acc">+{usdc(balance - deposited)}</b></span>
              <span>Pool APY <b className="text-ink">{v.apy.toFixed(2)}%</b> {v.live ? 'live on-chain' : 'sample'}</span>
            </div>
          </Card>
          <DepositCard balance={balance} />
        </div>
        <div className="grid gap-4">
          <Card>
            <div className="flex items-center justify-between"><h3 className="text-lg font-medium tracking-tight">Where your money is</h3><Pill tone="mute">Mock pool (demo)</Pill></div>
            <div className="mt-2 text-[40px] leading-[1.05] tracking-tight">{mode === 'exit' ? 'Idle in the vault' : <>Pool B <span className="text-xl text-mut">7.42%</span></>}</div>
            <p className="mt-1 text-[13px] text-mut">{mode === 'exit' ? 'Pool B failed its checks, so funds were pulled out.' : 'Base Sepolia. Best rate across chains: 7.42% on Base Sepolia, so no move is needed. Utilisation approx. 61%.'}</p>
          </Card>
          <Card>
            <h3 className="mb-1.5 text-lg font-medium tracking-tight">Upcoming payouts</h3>
            {upcoming.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-0">
                <div><b className="font-medium">{o.name}</b><div className="text-[13px] text-mut">{usdc(o.amount)} USDC to {shortAddr(o.payee)}</div></div>
                <span className="text-mut">{countdown(o.next, now)}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium tracking-tight">Live activity</h3><span className="text-[13px] text-mut">Updated by the automation, newest first</span></div>
        <ul>
          <AnimatePresence initial={false}>
            {feed.slice(0, 12).map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex flex-col justify-between gap-1 border-t border-line py-3.5 first:border-0 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-xl bg-c2 text-acc"><Icon name={e.kind} /></span>
                  <div>{e.text}<div className="text-[13px] text-mut" title={new Date(e.ts).toLocaleTimeString()}>{rel(e.ts, now)}</div></div>
                </div>
                <a href="#" className="pl-[46px] text-acc sm:pl-0">{e.hash}</a>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Card>
    </main>
  );
}
