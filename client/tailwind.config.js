/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        card: '#141414',
        border: '#2a2a2a',
        accent: '#7c3aed',
        'text-muted': '#888888',
      },
    },
  },
  plugins: [],
};
