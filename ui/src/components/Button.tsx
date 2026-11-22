import type { ButtonHTMLAttributes } from 'react';
const V = {
  primary: 'bg-teal text-[#04201c] hover:shadow-[0_8px_26px_rgb(63_224_197/.3)] hover:-translate-y-0.5',
  outline: 'border border-line bg-transparent text-ink hover:border-teal',
  glass: 'border border-white/40 bg-[#040706]/60 text-white backdrop-blur hover:bg-[#040706]/80',
};
export function Button({ variant = 'primary', small, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof V; small?: boolean }) {
  return <button {...p} className={`rounded-full font-medium transition duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${small ? 'h-10 px-4 text-sm' : 'h-11 px-5'} ${V[variant]} ${className}`} />;
}
