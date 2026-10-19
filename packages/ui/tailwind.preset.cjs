/** @type {Partial<import('tailwindcss').Config>} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
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
        ring: 'rgb(var(--ring) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        overlay: 'rgb(var(--overlay) / <alpha-value>)',
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
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar-bg) / <alpha-value>)',
          hover: 'rgb(var(--sidebar-hover) / <alpha-value>)',
        },
        rail: {
          DEFAULT: 'rgb(var(--rail-bg) / <alpha-value>)',
          icon: 'rgb(var(--rail-icon) / <alpha-value>)',
          selected: 'rgb(var(--rail-selected-bg) / <alpha-value>)',
          'selected-icon': 'rgb(var(--rail-selected-icon) / <alpha-value>)',
        },
        grid: {
          header: 'rgb(var(--grid-header-bg) / <alpha-value>)',
          hover: 'rgb(var(--table-row-hover) / <alpha-value>)',
        },
        'empty-value': 'rgb(var(--empty-value-fg) / <alpha-value>)',
      },
      height: {
        control: 'var(--control-h)',
        'control-compact': 'var(--control-h-compact)',
        topbar: 'var(--topbar-h)',
        'sidebar-row': 'var(--sidebar-row-h)',
      },
      minHeight: {
        control: 'var(--control-h)',
        'control-compact': 'var(--control-h-compact)',
      },
      width: {
        rail: 'var(--rail-width)',
        sidebar: 'var(--sidebar-width)',
        drawer: 'var(--drawer-width)',
        'control-compact': 'var(--control-h-compact)',
      },
      maxWidth: {
        drawer: 'var(--drawer-width)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        base: 'var(--fs-supportive)',
        xxs: 'var(--text-xxs)',
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': 'var(--text-4xl)',
        '5xl': 'var(--text-5xl)',
        '6xl': 'var(--text-6xl)',
        '7xl': 'var(--text-7xl)',
        '8xl': 'var(--text-8xl)',
        '9xl': 'var(--text-9xl)',
        'fs-primary': 'var(--fs-primary)',
        'fs-secondary': 'var(--fs-secondary)',
        'fs-supportive': 'var(--fs-supportive)',
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      zIndex: {
        sticky: 'var(--z-sticky)',
        dropdown: 'var(--z-dropdown)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
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
        standard: 'var(--ease-standard)',
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
