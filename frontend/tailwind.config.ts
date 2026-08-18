import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F2F2F0',
        canvasWarm: '#FDFBF7',
        surface: '#FFFDF9',
        surfaceWarm: '#F8F3EA',
        surfaceBlue: '#DCEFF0',
        surfaceBlue2: '#EDF7F7',
        primary: {
          DEFAULT: '#087F8C',
          dark: '#075E67',
          soft: '#DCEFF0',
          glow: '#7CC6CA',
        },
        ink: {
          DEFAULT: '#171A1A',
          2: '#242929',
        },
        muted: '#687170',
        gold: {
          DEFAULT: '#C89B5B',
          soft: '#F3E7D3',
        },
        success: {
          DEFAULT: '#237A57',
          soft: '#E2F1E9',
        },
        warning: {
          DEFAULT: '#9A6B12',
          soft: '#F6EDD8',
        },
        destructive: {
          DEFAULT: '#C03A2B',
          soft: '#FBE9E6',
        },
      },
      borderRadius: {
        shell: '18px',
        core: '15px',
        card: '12px',
        control: '10px',
        small: '7px',
      },
      boxShadow: {
        soft: '0 22px 50px -34px rgba(23,26,26,.26)',
        card: '0 12px 40px -28px rgba(23,26,26,.22)',
        pop: '0 18px 44px -26px rgba(23,26,26,.32)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.32,.72,0,1)',
        spring: 'cubic-bezier(.16,1.16,.3,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
