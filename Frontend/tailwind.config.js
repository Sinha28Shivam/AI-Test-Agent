/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        surface: '#1E1E2E',
        'surface-dark': '#0D1515',
        'surface-card': '#151D1E',
        accent: '#00F2FE',
        'accent-violet': '#7F00FF',
        passed: '#10B981',
        healed: '#F59E0B',
        failed: '#EF4444'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Geist', 'sans-serif']
      }
    },
  },
  plugins: [],
}
