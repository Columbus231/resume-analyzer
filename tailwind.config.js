/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: "#17233b",
        muted: "#77829a",
        brand: { 50: "#f0efff", 100: "#e5e2ff", 500: "#7565e8", 600: "#6353d7", 700: "#4b3cb6" },
      },
      boxShadow: {
        card: "0 8px 26px rgba(34, 45, 80, 0.055)",
        float: "0 18px 45px rgba(34, 45, 80, 0.10)",
      },
    },
  },
  plugins: [],
};
