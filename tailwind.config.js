/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#4285F4',
        'brand-secondary': '#34A853',
        'brand-accent': '#FBBC05',
        'brand-danger': '#EA4335',
      },
    },
  },
  plugins: [],
}