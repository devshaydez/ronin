import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWallet } from '../hooks/useWallet';
import { shortAddr } from '../lib/format';
import { Button } from './Button';
import { NetworkMenu } from './NetworkMenu';
import { Logo } from './Logo';

const TABS = [['/app', 'Dashboard'], ['/app/pipeline', 'Pipeline'], ['/app/orders', 'Orders'], ['/app/ai', 'AI decisions'], ['/app/pools', 'Pools'], ['/app/safety', 'Safety'], ['/app/reviewer', 'Reviewer']];

export function Header() {
  const w = useWallet();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="shell flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <Link to="/" aria-label="Ronin home" className="mr-auto flex items-center gap-2 text-lg font-semibold tracking-tight sm:mr-3"><Logo /><span className="hidden sm:inline">Ronin</span></Link>
        <nav className="order-last flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-card p-1 lg:order-none lg:mr-auto lg:w-auto">
          {TABS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `relative whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors ${isActive ? 'font-medium text-[#04201c]' : 'text-mut hover:text-ink'}`}>
              {({ isActive }) => (<>{isActive && <motion.span layoutId="tab" className="absolute inset-0 rounded-full bg-teal" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}<span className="relative">{label}</span></>)}
            </NavLink>
          ))}
        </nav>
        <span className="rounded-full border border-amb px-2.5 py-0.5 text-xs text-amb">Testnet</span>
        <NetworkMenu />
        <Button small variant={w.connected ? 'outline' : 'primary'} onClick={() => (w.connected ? w.disconnect() : w.connect())}>
          {w.connected && w.address ? shortAddr(w.address) : 'Connect wallet'}
        </Button>
      </div>
    </header>
  );
}
