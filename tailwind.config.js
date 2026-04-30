/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A3C5E',
        accent: '#C8402A',
        background: '#F5F2EB',
        surface: '#FFFFFF',
        muted: '#8A8578',
        border: '#D6D1C4',
        success: {
          DEFAULT: '#1A5C2A',
          bg: '#E6F4EA',
        },
        warning: {
          DEFAULT: '#7A4800',
          bg: '#FFF9E6',
        },
        error: {
          DEFAULT: '#C8402A',
          bg: '#FFE6E6',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
