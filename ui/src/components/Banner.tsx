import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
const T = { info: 'border-teal/30 bg-teal/10', warn: 'border-amb/40 bg-amb/10', error: 'border-red bg-red/10' };
export function Banner({ tone = 'info', children, action }: { tone?: keyof typeof T; children: ReactNode; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className={`mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border px-5 py-3.5 sm:flex-row sm:items-center ${T[tone]}`}>
      <span>{children}</span>{action}
    </motion.div>
  );
}
