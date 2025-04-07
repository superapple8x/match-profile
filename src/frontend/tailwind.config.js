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
        primary: { // KDE Blue Palette Mapping
          500: '#3daee9', // kde-blue-500 - Main primary
          600: '#2a9cd7', // kde-blue-600 - Darker primary/hover
          700: '#1a8ac5', // kde-blue-700 - Darkest primary/hover
          800: '#1a8ac5', // kde-blue-700 - Darkest primary/hover (reusing 700)
        },
        gray: {
          150: '#f3f4f6', // Lighter gray for subtle backgrounds/borders
          850: '#1f2937', // Darker gray for subtle backgrounds/borders
        },
        'kde-blue': { // KDE Blue Palette
          50: '#f0f9ff',  // Lighter++
          100: '#e0f2fe', // Lighter+
          200: '#bae6fd', // Lighter
          300: '#9bd9f5', // Base Light
          400: '#6fc3f1', // Base
          500: '#3daee9', // Base Dark
          600: '#2a9cd7', // Darker
          700: '#1a8ac5', // Darkest
        },
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
  plugins: [
    require('@tailwindcss/typography'), // Add the typography plugin
  ],
}
