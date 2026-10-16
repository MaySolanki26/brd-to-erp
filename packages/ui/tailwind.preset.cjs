/** @type {Partial<import('tailwindcss').Config>} */
module.exports = {
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--border) / <alpha-value>)',
        ring: 'rgb(var(--primary) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
          light: 'rgb(var(--primary-light) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
          light: 'rgb(var(--destructive-light) / <alpha-value>)',
          fg: 'rgb(var(--danger-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          light: 'rgb(var(--success-light) / <alpha-value>)',
          fg: 'rgb(var(--success-fg) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          light: 'rgb(var(--warning-light) / <alpha-value>)',
          fg: 'rgb(var(--warning-fg) / <alpha-value>)',
        },
        orange: {
          DEFAULT: 'rgb(var(--orange) / <alpha-value>)',
          light: 'rgb(var(--orange-light) / <alpha-value>)',
          fg: 'rgb(var(--orange-fg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          light: 'rgb(var(--info-light) / <alpha-value>)',
          fg: 'rgb(var(--info-fg) / <alpha-value>)',
        },
        violet: {
          DEFAULT: 'rgb(var(--violet) / <alpha-value>)',
          light: 'rgb(var(--violet-light) / <alpha-value>)',
          fg: 'rgb(var(--violet-fg) / <alpha-value>)',
        },
        cyan: {
          DEFAULT: 'rgb(var(--cyan) / <alpha-value>)',
          light: 'rgb(var(--cyan-light) / <alpha-value>)',
          fg: 'rgb(var(--cyan-fg) / <alpha-value>)',
        },
        pink: {
          DEFAULT: 'rgb(var(--pink) / <alpha-value>)',
          light: 'rgb(var(--pink-light) / <alpha-value>)',
          fg: 'rgb(var(--pink-fg) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
      },
      fontSize: {
        xxs: '9px',
        xs: '10px',
        sm: '11px',
        md: '12px',
        lg: '13px',
        xl: '14px',
        '2xl': '16px',
        '3xl': '18px',
        '4xl': '20px',
        '5xl': '24px',
        '6xl': '30px',
        '7xl': '36px',
        '8xl': '48px',
        '9xl': '96px',
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      keyframes: {
        'icon-pop': {
          '0%': { transform: 'scale(0.6) rotate(-8deg)', opacity: '0' },
          '60%': { transform: 'scale(1.08) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        'check-bounce': {
          '0%': { transform: 'scale(0)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        'content-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'dot-active': {
          '0%': { transform: 'scale(0.6)' },
          '60%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-8px) scale(1.03)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'confetti-pop': {
          '0%': { transform: 'scale(0) rotate(0)', opacity: '0' },
          '40%': { transform: 'scale(1.3) rotate(15deg)', opacity: '1' },
          '60%': { transform: 'scale(0.95) rotate(-5deg)' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        'badge-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.1)' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'icon-pop': 'icon-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'check-bounce': 'check-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'content-in': 'content-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'dot-active': 'dot-active 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float-slow': 'float-slow 4s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'confetti-pop': 'confetti-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'badge-pulse': 'badge-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};
