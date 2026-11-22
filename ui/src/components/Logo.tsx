export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden>
      <path d="M3 22L13 3l10 19" stroke="#3fe0c5" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8 22l5-9 5 9" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
