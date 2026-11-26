import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { LatencyBreakdown } from '../components/LatencyBreakdown';
import { Logo } from '../components/Logo';
import { Segmented } from '../components/Segmented';
import { SourceTag } from '../components/SourceTag';
import { MEASURED_PROOF } from '../data/proof';
import { useDeploymentStats } from '../hooks/useDeploymentStats';
import { useNow } from '../hooks/useNow';
import { countdown, usdc } from '../lib/format';
import { GITHUB_URL, LIVE, PROOF_URL, explorerAddress, explorerTx } from '../lib/mode';
import { BASE, RSC, UNICHAIN } from '../lib/deployments';

const css = (o: Record<string, string | number>) => o as CSSProperties;
const EASE = [0.2, 0.8, 0.2, 1] as const;
const rise = (i = 0) => ({ initial: { opacity: 0, y: 22 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.9, delay: i * 0.09, ease: EASE } });

function CountUp({ to, decimals = 0, suffix = '' }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reduce) { setV(to); return; }
    const c = animate(0, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [seen, to, reduce]);
  return <span ref={ref}>{v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

// Sample values for the prototype. In the app each one is read from the chain, and an empty vault shows a real 0.
// Demo-only marketing figures. Live mode replaces this curve with chain reads below.
const STATS: Array<{ x: string; y: number; to: number; label: string; d?: number; s?: string }> = [
  { x: '6%', y: 230, to: 184220, label: 'Total deposited, USDC' }, { x: '27%', y: 182, to: 1286, label: 'Loops completed' },
  { x: '48%', y: 134, to: 22, s: 's', label: 'Median normal loop' }, { x: '69%', y: 86, to: 3172, label: 'Payouts made' },
  { x: '87%', y: 38, to: 2, label: 'Chains connected' },
];

function LiveMetrics() {
  const s = useDeploymentStats();
  const value = (n: number | undefined) => n === undefined ? 'Reading…' : usdc(n);
  return (
    <div className="mx-auto max-w-[1180px] px-7 pt-8">
      <div className="flex flex-wrap items-center gap-3"><SourceTag kind="live" source="vault.totalAssets()" /><span className="text-[13px] text-mut">Read from the deployed vaults, not from the marketing sample.</span></div>
      <div className="mt-5 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
        <div><small className="text-[13px] text-mut">Base Sepolia vault</small><b className="mt-1 block text-[clamp(28px,3.4vw,44px)] font-normal leading-none tracking-[-0.04em]">{value(s.base)} <span className="text-base text-mut">USDC</span></b></div>
        <div><small className="text-[13px] text-mut">Unichain Sepolia vault</small><b className="mt-1 block text-[clamp(28px,3.4vw,44px)] font-normal leading-none tracking-[-0.04em]">{value(s.unichain)} <span className="text-base text-mut">USDC</span></b></div>
        <div><small className="text-[13px] text-mut">Chains configured</small><b className="mt-1 block text-[clamp(28px,3.4vw,44px)] font-normal leading-none tracking-[-0.04em]">2</b></div>
      </div>
      {s.error && <p className="mt-3 text-[13px] text-red">Vault read failed. No fallback numbers are shown.</p>}
    </div>
  );
}

function Ill({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid h-60 place-items-center overflow-hidden rounded-[20px]" style={{ background: 'radial-gradient(circle at 85% 0,#35c9b2 0,transparent 55%),radial-gradient(circle at 0 100%,#5b4be0 0,transparent 50%),linear-gradient(160deg,#071311,#0d3d37)' }}>{children}</div>;
}
const Mu = ({ children }: { children: ReactNode }) => <div className="relative w-[82%] rounded-[18px] bg-white/95 p-4 text-xs text-[#0a0f0e] shadow-[0_24px_40px_-12px_rgb(0_0_0/.6)] transition duration-500 ease-out group-hover:-translate-y-1.5 group-hover:-rotate-1">{children}</div>;
const Tx = ({ children }: { children: ReactNode }) => <div className="a-tx absolute -bottom-5 -right-3 rounded-full border border-teal/55 bg-[#0a0f0e] px-3 py-1.5 text-[11px] text-[#eef4f2] shadow-lg">{children}</div>;

const MINIS = [
  <Mu key="d"><div className="flex justify-between text-[#5d6a67]"><span>Deposit</span><i className="rounded-full bg-[#e3f7f2] px-2.5 py-0.5 font-medium not-italic text-[#0c7a6a]">Max</i></div>
    <div className="my-2 text-[28px] tracking-tight">{LIVE ? '—' : '1,000.00'} <small className="text-xs text-[#5d6a67]">USDC</small></div>
    <div className="grid grid-cols-2 gap-1.5 font-medium"><u className="rounded-full bg-teal p-2 text-center text-[#04201c] no-underline">1 Approved</u><u className="a-fill rounded-full bg-[#eef2f1] p-2 text-center text-[#5d6a67] no-underline">2 Deposit</u></div><Tx>{LIVE ? 'Illustrative receipt' : 'Confirmed 0x9c1e…4b07'}</Tx></Mu>,
  <Mu key="f"><div className="flex justify-between pb-2"><span className="text-[#5d6a67]">Pool A, Base Sepolia</span><b>{LIVE ? '—' : '4.10%'}</b></div>
    <div className="a-hl -mx-2 flex justify-between rounded-[10px] p-2"><span className="text-[#0c7a6a]">Pool B, Unichain Sepolia</span><b>{LIVE ? '—' : '7.42%'}</b></div>
    <svg viewBox="0 0 200 34" preserveAspectRatio="none" className="mt-1.5 block h-[34px] w-full"><path className="a-draw" pathLength={1} d="M0 28C30 28 40 22 70 20S110 24 130 14 170 6 200 3" fill="none" stroke="#19c3ac" strokeWidth="2" strokeLinecap="round" /></svg>
    <div className="mt-2 flex justify-between text-[#5d6a67]"><span>Moved to Pool B</span><span>12 s ago</span></div><Tx>{LIVE ? 'Illustrative receipt' : 'Rebalanced 0x9c1e…4b07'}</Tx></Mu>,
  <Mu key="p"><div className="flex justify-between text-[#5d6a67]"><span>Rent, Amara Okafor</span><i className="rounded-full bg-[#e3f7f2] px-2.5 py-0.5 font-medium not-italic text-[#0c7a6a]">Paid</i></div>
    <div className="my-2 text-[28px] tracking-tight">{LIVE ? '—' : '250.00'} <small className="text-xs text-[#5d6a67]">USDC</small></div>
    <div className="flex justify-between border-t border-[#e2e9e7] py-2"><span className="text-[#5d6a67]">From yield</span><b>{LIVE ? '—' : '250.00'}</b></div>
    <div className="flex justify-between border-t border-[#e2e9e7] py-2"><span className="text-[#5d6a67]">Next, in 7 days</span><b>0x4f2a&hellip;c91e</b></div>
    <div className="h-[5px] overflow-hidden rounded-full bg-[#e2e9e7]"><div className="a-pb h-full w-[62%] rounded-full bg-[#19c3ac]" /></div><Tx>{LIVE ? 'Illustrative receipt' : 'Sent 0x37fa…a2d1'}</Tx></Mu>,
];

const H2 = ({ children }: { children: ReactNode }) => <motion.h2 {...rise()} className="max-w-[15ch] text-[clamp(34px,5vw,64px)] font-medium leading-[1.04] tracking-[-0.035em]">{children}</motion.h2>;

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const [src, setSrc] = useState<'yield' | 'yield-principal'>('yield');
  const now = useNow();
  const [due] = useState(() => Date.now() + (2 * 86400 + 4 * 3600) * 1000);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 40);
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);

  return (
    <div onPointerMove={(e) => setPt({ x: (e.clientX / innerWidth - 0.5) * -26, y: (e.clientY / innerHeight - 0.5) * -18 })}>
      <nav className={`fixed inset-x-0 top-0 z-20 border-b transition duration-500 ${scrolled ? 'border-white/10 bg-[#070b0a]/60 backdrop-blur-xl' : 'border-transparent'}`}>
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-7 text-[#eef4f2]">
          <a href="#top" className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"><Logo size={26} />Ronin</a>
          <div className="hidden gap-8 text-sm text-[#b8c7c3] md:flex">{[['How it works', '#how'], ['Standing orders', '#orders'], ['Safety', '#safety'], ['Proof', '#proof']].map(([l, h]) => <a key={l} href={h} className="hover:text-white">{l}</a>)}<a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a></div>
          <Link to="/app"><Button small>Launch app</Button></Link>
        </div>
      </nav>

      <header id="top" className="relative min-h-[max(100svh,700px)] overflow-hidden pb-[70px] text-[#eef4f2]" style={{ background: 'linear-gradient(180deg,#040706 0%,#050908 34%,#08312d 80%,#4fd6c0 93%,rgb(var(--bg)) 99.5%)' }}>
        <div aria-hidden className="pointer-events-none absolute right-[-7%] top-[max(90px,10vh)] z-[1] aspect-square w-[min(46vw,600px,88vh)] transition-transform duration-700 ease-out max-md:right-[-45%] max-md:w-screen max-md:opacity-40" style={{ transform: `translate3d(${pt.x}px,${pt.y}px,0)` }}>
          <div className="disc" style={css({ '--a': '240deg', '--d': '38s', inset: '-8% -10% 58% 56%', opacity: 0.8 })} />
          <div className="disc" style={css({ '--a': '120deg', '--d': '60s', inset: '42% 34% -6% 2%', animationDirection: 'reverse', opacity: 0.9 })} />
          <div className="disc tilt" style={css({ '--a': '0deg', inset: '6%' })} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1] [mask-image:linear-gradient(#000_55%,transparent_82%)]" style={{ background: 'linear-gradient(90deg,rgba(4,7,6,.9) 0,rgba(4,7,6,.55) 42%,transparent 64%)' }} />
        <div className="relative z-[2] mx-auto max-w-[1180px] px-7 pt-[clamp(92px,14vh,190px)]">
          <motion.div initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.1, ease: EASE }}>
            <div className="mb-[clamp(18px,4vh,34px)] inline-flex gap-2.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-[#a9bbb6]"><b className="font-medium text-teal">Testnet</b>Base Sepolia and Unichain Sepolia</div>
            <h1 className="max-w-[12ch] text-[clamp(48px,min(9.4vw,19.5vh),138px)] font-medium leading-[1.04] tracking-[-0.035em]">Deposit once.<span className="block bg-gradient-to-b from-[#d3ebe6] to-[#a0c8c0]/45 bg-clip-text text-transparent">It runs itself.</span></h1>
            <p style={{ margin: 'clamp(16px,3vh,30px) 0 clamp(18px,4vh,34px)' }} className="max-w-[480px] text-[17px] text-[#b6c6c2]">Ronin finds the best yield, protects your money, and pays your bills on schedule. No bots, no keepers, no button-pressing.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/app"><Button className="h-[50px] px-7 text-[15px] shadow-[0_12px_40px_rgb(63_224_197/.35)]">Launch app</Button></Link>
              <a href="#proof"><Button variant="glass" className="h-[50px] px-7 text-[15px]">View live proof</Button></a>
            </div>
          </motion.div>
        </div>
      </header>

      {LIVE ? <LiveMetrics /> : <>
      <div className="relative z-[3] -mt-[30px] hidden h-[390px] md:block">
        <div className="relative mx-auto h-full max-w-[1180px] px-7">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <motion.path d="M0,270 C60,266 80,248 100,240 S240,205 300,190 S440,155 500,140 S640,105 700,90 S840,55 900,40 L1000,28" fill="none" stroke="rgb(var(--mut))" strokeWidth={1.2} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 } as any} whileInView={{ pathLength: 1 } as any} viewport={{ once: true }} transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1] }} />
          </svg>
          {STATS.map((s) => (
            <div key={s.label} className="absolute border-l border-mut pl-[18px]" style={{ left: s.x, top: s.y, height: 300 - s.y }}>
              <i className="absolute -left-1.5 -top-1.5 h-[11px] w-[11px] rounded-full border-[1.5px] border-[#19c3ac] bg-white" />
              <b className="block pt-[22px] text-[clamp(34px,4vw,52px)] font-normal leading-none tracking-[-0.04em]"><CountUp to={s.to} decimals={s.d ?? 0} suffix={s.s} /></b>
              <small className="mt-1.5 block max-w-[200px] text-[13px] text-mut">{s.label}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-6 px-7 pt-2 md:hidden">{STATS.map((s) => <div key={s.label}><b className="block text-4xl font-normal tracking-[-0.04em]"><CountUp to={s.to} decimals={s.d ?? 0} suffix={s.s} /></b><small className="text-[13px] text-mut">{s.label}</small></div>)}</div>
      <p className="mx-auto max-w-[1180px] px-7 pt-4 text-[13px] text-mut">Testnet. Sample values in this prototype. In the app every figure is read from the chain, and an empty vault shows a real 0.</p>
      </>}

      <section id="how" className="mx-auto max-w-[1180px] px-7 pt-[120px] max-md:pt-20">
        <H2>Fund it once. Then leave.</H2>
        <div className="mt-4"><SourceTag kind="sample" reason="illustrative product screens, not wallet data" /></div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[['Deposit', 'Put in USDC. Your money is placed in the best paying pool straight away.'], ['Farm', 'When another pool pays more and the checks pass, the vault moves your money there.'], ['Get paid', 'Set a payee, an amount and a schedule. Every payment goes out on time.']].map(([t, d], i) => (
            <motion.div key={t} {...rise(i)} className="group"><Card className="min-h-[440px]"><Ill>{MINIS[i]}</Ill><h3 className="mb-2.5 text-[28px] font-medium tracking-tight">{t}</h3><p className="text-[15px] text-mut">{d}</p></Card></motion.div>
          ))}
        </div>
      </section>

      <section id="orders" className="mx-auto grid max-w-[1180px] items-center gap-14 px-7 pt-[120px] max-md:pt-20 md:grid-cols-2">
        <motion.div {...rise()}>
          <h2 className="max-w-[15ch] text-[clamp(34px,5vw,64px)] font-medium leading-[1.04] tracking-[-0.035em]">Choose where each payout comes from.</h2>
          <div className="mt-8"><Segmented id="landsrc" value={src} onChange={setSrc} options={[{ value: 'yield', label: 'Yield only' }, { value: 'yield-principal', label: 'Yield, then principal' }]} /></div>
          <div className="mt-3"><SourceTag kind="sample" reason="illustrative order; live plan reads are in the app" /></div>
          <p className="mt-4 min-h-[50px] max-w-[400px] text-mut">{src === 'yield' ? 'Your deposit is never touched. The payment is skipped if there is no yield yet.' : 'Always pays, using your deposit if yield runs short.'}</p>
        </motion.div>
        <motion.div {...rise(2)}><Card className="!p-7 shadow-[0_40px_80px_-40px_rgb(8_60_52/.35)]">
          <div className="flex items-center justify-between"><b className="font-medium">Rent, Amara Okafor</b><span className="inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-3 py-1 text-[13px] font-medium text-acc"><Icon name="ok" size={14} />Active</span></div>
          <div className="mb-1 mt-5 text-[56px] leading-none tracking-[-0.045em]">{LIVE ? '—' : '250.00'} <span className="text-[22px] text-mut">USDC</span></div>
          <div className="text-mut">Every 7 days, {LIVE ? 'payment count read in the app' : '6 payments left'}</div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-line"><motion.div className="h-full origin-left rounded-full bg-teal" animate={{ scaleX: src === 'yield' ? 0.5 : 0.34 }} initial={{ scaleX: 0.5 }} transition={{ duration: 1, ease: [0.3, 1, 0.4, 1] }} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3.5 border-t border-line pt-5 text-sm">
            <div><span className="block text-[13px] text-mut">Payee</span>0x4f2a&hellip;c91e</div><div><span className="block text-[13px] text-mut">Next payment</span>{countdown(due, now)}</div>
            <div><span className="block text-[13px] text-mut">Source</span>{src === 'yield' ? 'Yield only' : 'Yield, then principal'}</div><div><span className="block text-[13px] text-mut">Available yield now</span>{LIVE ? 'Read in the app' : '312.48 USDC'}</div>
          </div></Card></motion.div>
      </section>

      <section id="safety" className="relative mx-3.5 mt-[120px] overflow-hidden rounded-[40px] bg-[#050908] py-[90px] text-[#eef4f2] max-md:mx-2 max-md:mt-20 max-md:rounded-[28px]">
        <svg className="absolute right-[-60px] top-1/2 h-[520px] w-[520px] -translate-y-1/2 opacity-90 max-md:right-[-200px] max-md:opacity-25" viewBox="0 0 520 520" fill="none" aria-hidden>
          <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e7fbf6" /><stop offset=".5" stopColor="#3fe0c5" /><stop offset="1" stopColor="#5b4be0" /></linearGradient></defs>
          <g stroke="url(#gl)" strokeWidth="14"><rect x="110" y="70" width="170" height="92" rx="46" transform="rotate(-24 195 116)" /><rect x="200" y="190" width="170" height="92" rx="46" transform="rotate(32 285 236)" /><rect x="90" y="300" width="170" height="92" rx="46" transform="rotate(-12 175 346)" /></g>
          <g stroke="#eef4f2" strokeOpacity=".25" strokeWidth="2"><rect x="115" y="75" width="170" height="92" rx="46" transform="rotate(-24 195 116)" /><rect x="205" y="195" width="170" height="92" rx="46" transform="rotate(32 285 236)" /></g>
        </svg>
        <div className="relative mx-auto max-w-[1180px] px-7">
          <H2>It protects itself.</H2>
          <motion.p {...rise()} className="mt-4 max-w-[460px] text-[#98aaa6]">If something looks wrong, Ronin stops first and explains after. Vaults restart on their own when things settle; a pool the breaker exited stays frozen until a human reviews it.</motion.p>
          <div className="mt-11 grid max-w-[560px] gap-3">
            {([['pause', 'Pause', 'Deposits stop when rates or data look unsafe. Withdrawals and payouts keep working.'], ['move', 'Exit', 'If a pool fails its checks, funds are pulled out and held safe in the vault.'], ['retry', 'Self-heal', 'Vaults resume automatically once rates settle. An exited pool stays frozen for human review before it gets funds again.']] as const).map(([ic, t, d], i) => (
              <motion.div key={t} {...rise(i)} className="grid grid-cols-[auto_1fr] gap-[18px] rounded-[20px] border border-white/10 bg-white/5 p-5 transition duration-300 hover:translate-x-1.5 hover:bg-teal/10">
                <span className="text-teal"><Icon name={ic} size={30} /></span><p><b className="block font-medium">{t}</b><span className="text-sm text-[#98aaa6]">{d}</span></p></motion.div>
            ))}
          </div>
          <Link to="/app/safety" className="mt-9 inline-block"><Button className="!bg-white !text-[#0a0f0e]">See safety status</Button></Link>
        </div>
      </section>

      <section id="proof" className="mx-auto max-w-[1180px] px-7 pt-[120px] max-md:pt-20">
        <H2>Every step has a receipt.</H2>
        <motion.p {...rise()} className="mt-4 max-w-[460px] text-mut">Receipts from the 2026-11-23 Phase B2 run on this deployment. These are not live refetches; the full evidence report is linked below.</motion.p>
        <div className="mt-4"><SourceTag kind="proof" /></div>
        <div className="mt-6 grid gap-2.5">
          {MEASURED_PROOF.slice(0, 3).map((r, i) => (
            <motion.div key={r.hash} {...rise(i)} className="grid grid-cols-2 items-center gap-5 rounded-[20px] border border-line bg-card px-6 py-5 text-sm transition duration-300 hover:scale-[1.012] md:grid-cols-[1.2fr_2fr_1.4fr_auto]">
              <b className="font-medium">{r.label}</b><div><em className="block text-[13px] not-italic text-mut">Transaction</em>{r.hash.slice(0, 6)}…{r.hash.slice(-4)}</div><div><em className="block text-[13px] not-italic text-mut">{r.chainName}</em>2026-11-23</div><a href={explorerTx(r.chain, r.hash)} target="_blank" rel="noreferrer" className="whitespace-nowrap font-medium text-acc">View on explorer</a></motion.div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-mut"><a href={PROOF_URL} target="_blank" rel="noreferrer" className="font-medium text-acc hover:underline">Open ai-service/PROOF.md for every receipt and the 683 s recovery row.</a></p>
        <motion.div {...rise()} className="mt-4"><LatencyBreakdown /></motion.div>
      </section>

      <section className="mx-auto max-w-[1180px] px-7 pt-[120px] max-md:pt-20">
        <H2>Built on Reactive Network.</H2>
        <div className="mt-11 grid gap-4 md:grid-cols-4">
          {[['Event driven', 'A change on chain wakes the contract. Nothing polls on a timer.'], ['No keeper', 'No one runs a script for you, so there is no script to forget.'], ['Across chains', 'Base Sepolia and Unichain Sepolia share rates and safety signals.'], ['Verifiable', 'Each step is a transaction you can open on the explorer.']].map(([t, d], i) => (
            <motion.div key={t} {...rise(i)}><Card className="min-h-[210px] !p-[26px]"><h3 className="text-[22px] font-medium tracking-[-0.03em]">{t}</h3><p className="mt-2.5 text-[15px] text-mut">{d}</p></Card></motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-7 pt-[120px] max-md:pt-20">
        <H2>What Ronin does not do.</H2>
        <motion.div {...rise()} className="mt-11 grid border-t border-line md:grid-cols-4">
          {[['Testnet only', 'No real money. Mock pools are marked as demo.'], ['No bridging', 'Funds stay on their chain. Only rates and safety signals cross.'], ['AI is a gate', 'It suggests. The vault checks the rules again before moving anything.'], ['Open source', 'Read the contracts and the front end on GitHub.']].map(([t, d]) => (
            <div key={t} className="pr-6 pt-6 text-[15px] text-mut"><b className="mb-1.5 block text-[17px] font-medium text-ink">{t}</b>{d}</div>
          ))}
        </motion.div>
      </section>

      <footer className="mt-[120px] border-t border-line py-10 pb-[60px] text-sm text-mut">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-5 px-7"><span className="flex items-center gap-2 font-semibold text-ink"><Logo size={22} />Ronin</span>
          <div className="flex flex-wrap gap-6"><a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a><a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer" className="hover:text-ink">Docs</a><a href={PROOF_URL} target="_blank" rel="noreferrer" className="hover:text-ink">Proof</a><Link to="/app/reviewer" className="hover:text-ink">Reviewer</Link></div></div>
        <div className="mx-auto mt-7 flex max-w-[1180px] flex-wrap items-center gap-x-5 gap-y-2 px-7 text-[13px]">
          <span className="text-mut">Verified source on the explorers:</span>
          <a href={explorerAddress('base', BASE.vault)} target="_blank" rel="noreferrer" className="hover:text-ink">Vault · Base Sepolia</a>
          <a href={explorerAddress('unichain', UNICHAIN.vault)} target="_blank" rel="noreferrer" className="hover:text-ink">Vault · Unichain Sepolia</a>
          <a href={explorerAddress('lasna', RSC)} target="_blank" rel="noreferrer" className="hover:text-ink">Reactive contract · Lasna</a>
        </div>
      </footer>
    </div>
  );
}
