import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette Bilal Education
        // primary  = turquoise  #18aa99
        primary: {
          50:  '#f0fbfa',
          100: '#cff4f0',
          200: '#9fe9e1',
          300: '#65d9cf',
          400: '#2ec4ba',
          500: '#18aa99',
          600: '#12887a',
          700: '#0e6b61',
          800: '#0a504a',
          900: '#063530',
        },
        // secondary = ardoise   #507583
        secondary: {
          50:  '#f0f5f7',
          100: '#dce7ec',
          200: '#b8cfda',
          300: '#93b6c7',
          400: '#6f9eb4',
          500: '#507583',
          600: '#3f5e6a',
          700: '#2e4550',
          800: '#1f2e35',
          900: '#111c21',
        },
        // amber = orange doré   #ffa200
        amber: {
          50:  '#fff8e6',
          100: '#ffedb3',
          200: '#ffd966',
          300: '#ffc733',
          400: '#ffb800',
          500: '#ffa200',
          600: '#cc8200',
          700: '#996100',
          800: '#664100',
          900: '#332000',
        },
        // warm = beige chaud    #b6a798
        warm: {
          50:  '#faf8f6',
          100: '#f0ece8',
          200: '#e0d9d1',
          300: '#d0c6ba',
          400: '#c0b3a3',
          500: '#b6a798',
          600: '#9a8e81',
          700: '#786d64',
          800: '#564e47',
          900: '#332e2a',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-amiri)', 'serif'],
      },
      boxShadow: {
        'card':       '0 2px 8px 0 rgba(47,69,80,0.08), 0 1px 3px 0 rgba(47,69,80,0.04)',
        'card-hover': '0 10px 32px 0 rgba(47,69,80,0.16), 0 3px 8px 0 rgba(47,69,80,0.08)',
        'sidebar':    '4px 0 20px 0 rgba(17,28,33,0.22)',
        'nav':        '0 2px 12px 0 rgba(17,28,33,0.10)',
      },
      backgroundImage: {
        'login-gradient': 'linear-gradient(135deg, #507583 0%, #18aa99 100%)',
        'sidebar-dark':   'linear-gradient(180deg, #2e4550 0%, #1f2e35 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
