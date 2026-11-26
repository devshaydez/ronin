import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSwitchChain } from 'wagmi';
import { NETWORKS } from '../chains';
import { useWallet } from '../hooks/useWallet';
import { useApp } from '../state/AppState';
import { Icon } from './Icon';

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Styled replacement for the native select. Closes on outside click and Escape; Tab stays inside. */
export function NetworkMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { network, setNetwork, toast } = useApp();
  const { connected, demo } = useWallet();
  const { switchChain } = useSwitchChain();
  const current = NETWORKS.find((n) => n.chain.id === network) ?? NETWORKS[0];

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !menu.current) return;
      const nodes = Array.from(menu.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => node.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => menu.current?.querySelector<HTMLElement>('[role="option"]')?.focus(), 30);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="network-list"
        aria-label={`Network: ${current.chain.name}`}
        onClick={() => setOpen(!open)}
        className={`flex h-9 items-center gap-3 rounded-full border bg-card pl-[18px] pr-3.5 transition hover:border-teal ${open ? 'border-teal' : 'border-line'}`}
      >
        {current.chain.name}
        <span className={`text-mut transition-transform duration-300 ease-spring ${open ? 'rotate-180' : ''}`}><Icon name="chevron" size={14} /></span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              aria-hidden
              className="fixed inset-0 z-10 bg-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={() => setOpen(false)}
            />
            <motion.div
              ref={menu}
              id="network-list"
              role="listbox"
              aria-label="Select a network"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute right-0 top-[calc(100%+10px)] z-20 min-w-[240px] origin-top-right rounded-2xl border border-line bg-card p-1.5 shadow-2xl max-sm:fixed max-sm:inset-x-3.5 max-sm:right-auto max-sm:top-24"
            >
              {NETWORKS.map((n) => (
                <button
                  key={n.chain.id}
                  role="option"
                  aria-selected={n.chain.id === current.chain.id}
                  onClick={() => {
                    setNetwork(n.chain.id);
                    if (connected && !demo) switchChain({ chainId: n.chain.id });
                    setOpen(false);
                    trigger.current?.focus();
                    toast(`Switched to ${n.chain.name}`);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-c2 focus-visible:bg-c2"
                >
                  <span>{n.chain.name}<small className="block text-xs text-mut">{n.sub}</small></span>
                  {n.chain.id === current.chain.id && <span className="text-acc"><Icon name="ok" size={16} /></span>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
