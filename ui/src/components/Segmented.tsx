import { motion } from 'framer-motion';
/** Sliding selector. The spring gives the small overshoot described in the motion note. */
export function Segmented<T extends string>({ id, value, options, onChange }: { id: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="relative inline-flex rounded-full bg-c2 p-1" role="group">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`relative rounded-full px-4 py-2 text-sm transition-colors ${value === o.value ? 'font-medium text-[#04201c]' : 'text-mut'}`}>
          {value === o.value && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-teal" transition={{ type: 'spring', stiffness: 420, damping: 30 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
