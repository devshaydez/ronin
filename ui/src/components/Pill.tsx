import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const TONES = { ok: 'bg-teal/15 text-acc', warn: 'bg-amb/15 text-amb', bad: 'bg-red/15 text-red', mute: 'bg-c2 text-mut' };
/** Status is always an icon plus a word, never colour alone. */
export function Pill({ tone = 'ok', icon, children }: { tone?: keyof typeof TONES; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium ${TONES[tone]}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}
