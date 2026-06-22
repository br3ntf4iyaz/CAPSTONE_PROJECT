/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface scale — clean cool whites for backgrounds (not warm newsprint)
        paper: {
          DEFAULT: '#ffffff',
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
        },
        // Text scale — cool slate, not warm stone
        ink: {
          DEFAULT: '#0b1220',
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0b1220',
        },
        // Primary — Philippine flag blue (eGov PH inspired)
        primary: {
          50:  '#eef3fb',
          100: '#d6e1f4',
          200: '#adc3e8',
          300: '#7fa1d7',
          400: '#4f7ec3',
          500: '#2a5fb0',
          600: '#0038a8', // PH flag blue
          700: '#002d87',
          800: '#001f60',
          900: '#001140',
        },
        // Accent — Philippine sun yellow
        accent: {
          50:  '#fffae5',
          100: '#fff2bf',
          200: '#ffe680',
          300: '#ffd840',
          400: '#fcd116', // PH sun
          500: '#e6bd0d',
          600: '#bf9c0a',
          700: '#8c7008',
          800: '#5e4b06',
          900: '#3a2f04',
        },
        // Alert — Philippine flag red (used sparingly)
        alert: {
          50:  '#fdecef',
          100: '#fbd0d6',
          200: '#f5a1ad',
          300: '#ef7281',
          400: '#e3475a',
          500: '#ce1126', // PH red
          600: '#a90d1f',
          700: '#7e0a17',
          800: '#54070f',
          900: '#2a0307',
        },
      },
      fontFamily: {
        sans:    ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Manrope', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightish: '-0.02em',
        tighter2: '-0.035em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft':   '0 1px 2px 0 rgb(11 18 32 / 0.04), 0 1px 3px 0 rgb(11 18 32 / 0.06)',
        'lift':   '0 4px 6px -2px rgb(11 18 32 / 0.05), 0 10px 15px -3px rgb(11 18 32 / 0.08)',
        'inset-b': 'inset 0 -1px 0 0 rgb(226 232 240 / 1)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
