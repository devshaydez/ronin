import type { Config } from 'tailwindcss';
const c = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: c('bg'), card: c('card'), c2: c('c2'), ink: c('ink'), mut: c('mut'), line: c('line'), acc: c('acc'), amb: c('amb'), red: c('red'), teal: '#3fe0c5' },
      fontFamily: { sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '24px' },
      transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)', spring: 'cubic-bezier(.3,1.2,.4,1)' },
    },
  },
} satisfies Config;
