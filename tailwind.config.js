/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-dark)',
        foreground: 'var(--text-main)',
        navalio: {
          charcoal: '#080706',
          surface: '#120f0c',
          card: '#181410',
          gold: '#d4af37',
          'gold-light': '#f7e7a9',
          'gold-dark': '#96751c',
          crimson: '#9b1b1b',
          'crimson-bright': '#dc2626',
          parchment: '#fbf8f1',
          muted: '#a89e90',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
        cinzel: ['var(--font-cinzel)', 'serif'],
      },
    },
  },
  plugins: [],
}
