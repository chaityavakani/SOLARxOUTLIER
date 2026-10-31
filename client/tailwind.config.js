/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // styles.css already provides the base reset and component styles.
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
