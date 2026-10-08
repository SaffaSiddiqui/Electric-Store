/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B2D',
        panel: '#1E2A3A',
        paper: '#F4F1EB',
        copper: { DEFAULT: '#B7791F', dark: '#8F5C14' },
        steel: '#5B6B7F',
        line: '#E3DED3',
        success: '#2F7D5B',
        warning: '#C98A1B',
        danger: '#B2403A',
      },
      fontFamily: { sans: ['"Source Sans 3"', 'Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
