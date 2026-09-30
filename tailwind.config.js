/** Tailwind build config for Chopaholic. Run `npm run build:css` after changing markup or JS class names. */
module.exports = {
  content: ['./index.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        walnut: '#2C1A0E',
        amberwood: '#8B5A2B',
        cream: '#FAEDCD',
        accent: '#D4A373',
        paper: '#fdf6e7',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
