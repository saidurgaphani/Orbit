/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        alabaster: '#FBFBF9',
        charcoal: '#1E201E',
        forest: '#375534',
        sage: '#C0D6C0',
        terracotta: '#D17E5E',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}

