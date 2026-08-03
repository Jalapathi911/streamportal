/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#ffffff',
        'bg-soft': '#faf8ff',
        card: '#faf8ff',
        border: '#e9e0f5',
        accent: '#8B2BE2',
        'accent-hover': '#7B1BD2',
        'accent-light': '#f3e8ff',
        'text-primary': '#1f1235',
        'text-muted': '#6b7280',
      },
    },
  },
  plugins: [],
};
