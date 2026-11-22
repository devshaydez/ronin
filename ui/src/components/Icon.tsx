const PATHS = {
  rate: 'M4 18v-5M10 18V6M16 18v-8M3 21h18',
  ai: 'M12 3l8 9-8 9-8-9z',
  move: 'M4 8h13m0 0l-4-4m4 4l-4 4M20 16H7m0 0l4 4m-4-4l4-4',
  pay: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12h8',
  pause: 'M8 6v12M16 6v12',
  ok: 'M5 12l4 4 10-10',
  x: 'M6 6l12 12M18 6L6 18',
  retry: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5',
  chevron: 'M6 9l6 6 6-6',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
