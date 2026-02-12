/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        corporate: {
          red: '#E31937',      // PANTONE 186
          black: '#231F20',    // PANTONE BLACK
          white: '#FFFFFF',
          yellow: '#FFF200',   // PANTONE PROCESS YELLOW
          blue: '#0072BC',     // PANTONE 7461
          darkRed: '#CA0926',  // PANTONES 186C
        }
      }
    },
  },
  plugins: [],
}
