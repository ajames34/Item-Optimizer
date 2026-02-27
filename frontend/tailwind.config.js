/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          card: '#161b27',
          elevated: '#1c2236',
          border: '#252d42',
        },
        brand: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          glow: 'rgba(99,102,241,0.25)',
        },
        emerald: {
          glow: 'rgba(52,211,153,0.2)',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 24px rgba(99,102,241,0.25)',
      },
    },
  },
  plugins: [],
}

