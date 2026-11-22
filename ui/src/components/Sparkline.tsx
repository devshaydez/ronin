import { motion } from 'framer-motion';
export function Sparkline({ data }: { data: number[] }) {
  const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${((i * 100) / (data.length - 1)).toFixed(1)} ${(27 - ((v - mn) / r) * 24).toFixed(1)}`).join('');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-[30px] w-full" aria-hidden>
      <motion.path d={d} fill="none" stroke="rgb(var(--acc))" strokeWidth={1.8} strokeLinecap="round" initial={{ pathLength: 0 } as any} animate={{ pathLength: 1 } as any} transition={{ duration: 1.6, ease: 'easeOut' }} />
    </svg>
  );
}
