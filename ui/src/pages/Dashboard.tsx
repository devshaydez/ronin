import { AnimatePresence, motion } from 'framer-motion';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DepositCard } from '../components/DepositCard';
import { HistoryNote } from '../components/HistoryNote';
import { Icon } from '../components/Icon';
import { Pill } from '../components/Pill';
import { SourceTag } from '../components/SourceTag';
import { StatusPill } from '../components/StatusPill';
import { useLiveActivity } from '../hooks/useLiveEvents';
import { useNow } from '../hooks/useNow';
import { usePlans } from '../hooks/usePlans';
import { usePools } from '../hooks/usePools';
import { useSafetyStatus } from '../hooks/useSafetyStatus';
import { useVault } from '../hooks/useVault';
import { useWallet } from '../hooks/useWallet';
import { countdown, rel, shortAddr, usdc } from '../lib/format';
import { explorerTx } from '../lib/deployments';
import { LIVE } from '../lib/mode';
import { useApp } from '../state/AppState';

export default function Dashboard() {
  const now = useNow();
  const v = useVault();
  const w = useWallet();
  const safety = useSafetyStatus();
  const poolRead = usePools();
  const plans = usePlans();
  const activity = useLiveActivity(12);
  const { mode, setMode, balance: sample, deposited, orders, feed, toast } = useApp();
  const balance = v.balance ?? sample;
  const shownMode = LIVE ? (safety.basePaused ? 'paused' : 'ok') : mode;
  const inUse = poolRead.inUse;
  const upcoming = LIVE
    ? plans.active.sort((a, b) => Number(a.nextDue - b.nextDue)).slice(0, 3).map((p) => ({ id: `${p.chain.chainId}-${p.id}`, name: `Order #${p.id}`, amount: Number(p.amount) / 1e6, payee: p.payee, next: Number(p.nextDue) * 1000 }))
    : orders.filter((o) => o.state === 'active' || o.state === 'retrying').sort((a, b) => a.next - b.next).slice(0, 3);

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-8 pt-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-[-0.035em] sm:text-[34px]">Your vault</h1>
        <StatusPill mode={shownMode} />
      </div>
      {!w.connected && <Banner action={<Button small onClick={w.connect}>Connect wallet</Button>}>{LIVE ? 'Connect a wallet to read your on-chain position. No sample balance is shown.' : 'Sample data. Connect to see yours.'}</Banner>}
      {shownMode === 'paused' && <Banner tone="warn"><b>Vault paused by the AI safety check.</b> Deposits are off. Withdrawals and payouts keep working. It resumes on its own when rates return to normal.</Banner>}
      {shownMode === 'exit' && <Banner tone="warn"><b>Funds were moved out of Pool B to protect you.</b> They are idle in the vault and still yours.</Banner>}
      {shownMode === 'rec' && <Banner tone="warn"><b>Rates are settling.</b> The vault resumes by itself once they stay normal for 5 minutes.</Banner>}
      {shownMode === 'wrong' && <Banner tone="warn" action={<Button small onClick={() => { setMode('ok'); toast('Switched to Base Sepolia'); }}>Switch network</Button>}>Switch to Base Sepolia to continue.</Banner>}

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[13px] text-mut">Vault balance</div><SourceTag kind={v.live ? 'live' : 'sample'} source="ERC-4626 position" reason="connect a wallet for the on-chain position" /></div>
            <div className="my-2 text-[40px] leading-[1.05] tracking-[-0.045em] sm:text-[54px]" title={v.live ? `${balance.toFixed(6)} USDC` : 'Sample balance'}>{LIVE && !v.live ? '—' : usdc(balance)} <span className="text-xl text-mut">USDC</span></div>
            <div className="flex flex-wrap justify-between gap-2 text-[13px] text-mut">
              <span>Yield earned <b className="text-acc">{v.live ? (v.yieldNum !== undefined ? `+${usdc(v.yieldNum)}` : '—') : LIVE ? 'connect wallet' : `+${usdc(balance - deposited)}`}</b></span>
              <span>Pool APY <b className="text-ink">{inUse ? `${(inUse.rateBps / 100).toFixed(2)}%` : (LIVE ? 'not indexed' : `${v.apy.toFixed(2)}%`)}</b> {inUse ? 'live pool read' : (v.live ? 'wallet position' : 'sample')}</span>
            </div>
          </Card>
          <DepositCard balance={balance} />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium tracking-tight">Where your money is</h3><SourceTag kind={inUse ? 'live' : 'sample'} source="pool.balanceOf(vault)" reason="allocation indexer not configured" /></div>
            <div className="mt-2 text-[40px] leading-[1.05] tracking-tight">{shownMode === 'exit' ? 'Idle in the vault' : inUse && inUse.vaultBalance > 0 ? <>{inUse.name} <span className="text-xl text-mut">{(inUse.rateBps / 100).toFixed(2)}%</span></> : LIVE ? <>Idle in the vault <span className="text-xl text-mut">{usdc(v.totalNum ?? 0)}</span></> : <>Pool B <span className="text-xl text-mut">7.42%</span></>}</div>
            <p className="mt-1 text-[13px] text-mut">{shownMode === 'exit' ? 'Pool B failed its checks, so funds were pulled out.' : inUse && inUse.vaultBalance > 0 ? `${inUse.chain}. Read directly from the pool and vault.` : LIVE ? 'No pool holds this vault’s USDC right now. Read from the vault contract; no sample allocation is shown in live mode.' : 'Base Sepolia. Best rate across chains: 7.42% on Base Sepolia, so no move is needed. Utilisation approx. 61%.'}</p>
          </Card>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="mb-1.5 text-lg font-medium tracking-tight">Upcoming payouts</h3>{LIVE ? <SourceTag kind="live" source="vault.plans(id) · both chains" /> : <SourceTag kind="sample" reason="seeded demo orders" />}</div>
            {LIVE && plans.loading && <p className="text-[13px] text-mut">Reading standing orders from both vaults…</p>}
            {LIVE && !plans.loading && upcoming.length === 0 && <p className="text-[13px] text-mut">No active standing orders right now.</p>}
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
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium tracking-tight">Live activity</h3>{LIVE ? <SourceTag kind="live" source="eth_getLogs from the deploy block · cached 60 s" /> : <SourceTag kind="sample" reason="seeded demo events" />}</div>
        {LIVE ? (
          <>
            {activity.loading && <p className="mt-3 text-[13px] text-mut">Reading vault events from Base Sepolia and Unichain Sepolia…</p>}
            {activity.error && <p className="mt-3 text-[13px] text-red">Could not read events: {activity.error}</p>}
            <HistoryNote note={activity.note} />
            {!activity.loading && !activity.error && activity.items.length === 0 && <p className="mt-3 text-[13px] text-mut">No vault events since deployment yet.</p>}
            <ul>
              <AnimatePresence initial={false}>
                {activity.items.map((e) => (
                  <motion.li key={e.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                    className="flex flex-col justify-between gap-1 border-t border-line py-3.5 first:border-0 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-xl bg-c2 text-acc"><Icon name={e.kind} /></span>
                      <div>{e.text}<div className="text-[13px] text-mut" title={e.ts ? new Date(e.ts).toLocaleString() : undefined}>{e.ts ? rel(e.ts, now) : `block ${e.blockNumber.toString()}`}</div></div>
                    </div>
                    <a className="pl-[46px] text-acc sm:pl-0" href={explorerTx(e.chain, e.tx)} target="_blank" rel="noreferrer">{shortAddr(e.tx)}</a>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </>
        ) : <ul>
          <AnimatePresence initial={false}>
            {feed.slice(0, 12).map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex flex-col justify-between gap-1 border-t border-line py-3.5 first:border-0 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-xl bg-c2 text-acc"><Icon name={e.kind} /></span>
                  <div>{e.text}<div className="text-[13px] text-mut" title={new Date(e.ts).toLocaleTimeString()}>{rel(e.ts, now)}</div></div>
                </div>
                <span className="pl-[46px] text-mut sm:pl-0" title="Demo placeholder, not an on-chain transaction">{e.hash}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>}
      </Card>
    </main>
  );
}
