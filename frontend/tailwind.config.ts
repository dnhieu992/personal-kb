import type { Config } from 'tailwindcss';

/**
 * Design tokens live in app/globals.css as RGB channels (`--fg: 22 23 28`) and are
 * re-declared for dark mode under [data-theme="dark"]. Tailwind only maps names to
 * them, so `bg-surface/80` etc. still work and every utility follows the theme.
 * Use these semantic names — never raw palette classes like `bg-slate-100`.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        subtle: v('subtle'),
        muted: v('muted'),
        emphasis: v('emphasis'),
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        fg: {
          DEFAULT: v('fg'),
          secondary: v('fg-secondary'),
          muted: v('fg-muted'),
          subtle: v('fg-subtle'),
          faint: v('fg-faint'),
        },
        accent: {
          DEFAULT: v('accent'),
          hover: v('accent-hover'),
          fg: v('accent-fg'),
          soft: v('accent-soft'),
          text: v('accent-text'),
        },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), text: v('danger-text') },
        success: { DEFAULT: v('success'), soft: v('success-soft'), text: v('success-text') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft'), text: v('warning-text') },
        info: { DEFAULT: v('info'), soft: v('info-soft'), text: v('info-text') },
      },
      borderColor: { DEFAULT: v('line') },
      ringColor: { DEFAULT: v('accent') },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '16px'],
        sm: ['13.5px', '20px'],
        base: ['15px', '24px'],
      },
      boxShadow: {
        xs: '0 1px 2px rgb(var(--shadow) / 0.05)',
        sm: '0 1px 3px rgb(var(--shadow) / 0.08), 0 1px 2px rgb(var(--shadow) / 0.04)',
        md: '0 4px 12px -2px rgb(var(--shadow) / 0.10), 0 2px 4px -2px rgb(var(--shadow) / 0.06)',
        lg: '0 12px 32px -8px rgb(var(--shadow) / 0.18), 0 4px 8px -4px rgb(var(--shadow) / 0.08)',
      },
      borderRadius: { DEFAULT: '6px' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(-4px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        shake: { '0%,100%': { transform: 'none' }, '20%,60%': { transform: 'translateX(-5px)' }, '40%,80%': { transform: 'translateX(5px)' } },
        'match-out': { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'pop-in': 'pop-in 140ms ease-out',
        shake: 'shake 360ms ease-in-out',
        'match-out': 'match-out 300ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
