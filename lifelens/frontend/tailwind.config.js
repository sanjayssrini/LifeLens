/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ice: {
          100: "#e8f3ff",
          200: "#cde2ff",
          300: "#b5d4ff"
        }
      },
      boxShadow: {
        glow: "0 0 60px rgba(116, 198, 255, 0.35)"
      }
    }
  },
  plugins: []
};
