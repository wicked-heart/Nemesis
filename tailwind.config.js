import colors from 'tailwindcss/colors.js';

// NEMESIS design system ("Emerald Sovereign"). See UI_PLAN.md.
//
// Green is the only accent. Instead of editing hundreds of class names, the default palettes the
// screens already use are remapped here:
//   emerald-*  -> pure green (Doom's cloak / eyes), the main accent
//   cyan-*     -> the old teal-green, a quieter second green (no blue/cyan on screen)
//   gray-*, zinc-* -> "iron" neutrals with a faint green tint
// amber-* and red-* keep their meaning: amber = warning (5-min timer, penalty pending), red = penalty.

const iron = {
  50: '#f4f7f5',
  100: '#e7efe9',
  200: '#d0dbd4',
  300: '#b4c2b9',
  400: '#8a9a90',
  500: '#66756c',
  600: '#4b5750',
  700: '#343e38',
  800: '#222a25',
  900: '#151b17',
  950: '#0b100d',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        emerald: colors.green,
        cyan: colors.emerald,
        gray: iron,
        zinc: iron,
        doom: {
          void: '#040605', // page background
          iron: '#0b100d', // panels
          raised: '#121a15', // cards, inputs
          line: 'rgba(170, 255, 200, 0.08)', // hairline borders
          text: '#e7efe9',
          muted: '#8a9a90',
          green: '#22c55e', // the one accent
          glow: '#4ade80', // light, eyes, focus
          cloak: '#0f3d24', // deep green surfaces
          steel: '#c9d1d6', // Doom's mask, metal details
        },
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        regal: ['Cinzel', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
