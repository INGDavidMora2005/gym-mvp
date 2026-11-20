module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8fb4ff',
          400: '#588dff',
          500: '#2f66e6',
          600: '#1d49c4',
          700: '#1a3da0',
          800: '#1a3382',
          900: '#1a2b66',
        },
        ink: {
          900: '#14181f',
          800: '#232834',
          700: '#3a4050',
          600: '#5a6272',
          500: '#8a90a0',
          400: '#b8bcc4',
          300: '#dce0e6',
          200: '#e9ebef',
          100: '#f4f5f7',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(47,102,230,0.45)' },
          '70%': { boxShadow: '0 0 0 8px rgba(47,102,230,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(47,102,230,0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-up': 'slide-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
        'ring': 'ring 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
}