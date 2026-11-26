/**
 * A source that answered with some history still counts as usable. This note says so
 * without the red error styling reserved for a read that returned nothing at all.
 */
export function HistoryNote({ note, className = 'mt-3' }: { note?: string; className?: string }) {
  if (!note) return null;
  return (
    <p role="status" className={`flex items-start gap-2 text-[13px] text-mut ${className}`}>
      <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-amb" aria-hidden />
      {note}
    </p>
  );
}
