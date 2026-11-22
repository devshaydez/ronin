import { motion } from 'framer-motion';
export function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[13px] text-mut">Confidence</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-c2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <motion.div className="h-full rounded-full bg-gradient-to-r from-[#1aa391] to-teal" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
      <b>{value}%</b>
    </div>
  );
}
