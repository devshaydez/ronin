import type { HTMLAttributes } from 'react';
export function Card({ className = '', ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={`rounded-card border border-line bg-card p-6 ${className}`} />;
}
