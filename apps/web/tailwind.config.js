/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 深色主题
        dark: {
          bg: {
            primary: '#0a0a0a',
            secondary: '#171717',
            tertiary: '#262626',
          },
          text: {
            primary: '#fafafa',
            secondary: '#a3a3a3',
          },
          border: '#262626',
        },
        // 浅色主题
        light: {
          bg: {
            primary: '#ffffff',
            secondary: '#f5f5f5',
            tertiary: '#e5e5e5',
          },
          text: {
            primary: '#171717',
            secondary: '#525252',
          },
          border: '#e5e5e5',
        },
        // 强调色
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'dark-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'dark-md': '0 4px 6px rgba(0, 0, 0, 0.4)',
        'dark-lg': '0 10px 15px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
      },
    },
  },
  plugins: [],
}