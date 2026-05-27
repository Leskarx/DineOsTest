import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3c7', 100: '#fde68a', 200: '#fcd34d', 300: '#fbbf24',
          400: '#f59e0b', 500: '#d97706', 600: '#b45309', 700: '#92400e',
        },
        surface: { DEFAULT: '#0f172a', card: '#1e293b', muted: '#334155' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        slideUp: { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};

export default config;
