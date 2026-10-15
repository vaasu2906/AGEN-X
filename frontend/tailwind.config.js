/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        canvas: '#10110f',
        panel: '#171815',
        line: '#292a26',
        muted: '#85867f',
        lime: '#d2f36b',
      },
    },
  },
  plugins: [],
}
