/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3b82f6', // Base blue
          600: '#2563eb', // Hover blue
          700: '#1d4ed8', // Dark base blue
          800: '#1e40af', // Dark hover blue
        },
        gray: {
          150: '#f3f4f6', // Lighter gray for subtle backgrounds/borders
          850: '#1f2937', // Darker gray for subtle backgrounds/borders
        }
      },
      keyframes: {
        'fade-in-fast': {
          '0%': { opacity: '0', transform: 'translateY(-5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'progress-indeterminate': { // <-- Add progress keyframes
          '0%': { transform: ' translateX(-100%) scaleX(0.5)' },
          '50%': { transform: ' translateX(0) scaleX(0.5)' },
          '100%': { transform: ' translateX(100%) scaleX(0.5)' },
        },
      },
      animation: {
        'fade-in-fast': 'fade-in-fast 0.2s ease-out forwards',
        'progress-indeterminate': 'progress-indeterminate 1.5s ease-in-out infinite', // <-- Add progress animation
      },
    },
  },
  plugins: [],
}
