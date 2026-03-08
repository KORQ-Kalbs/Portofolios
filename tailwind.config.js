/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // === Core dark palette ===
        black: "#0a0a09",
        dark: "#141413",
        "grey-900": "#1c1c1a",
        "grey-800": "#242422",
        "grey-700": "#2e2e2c",
        "grey-600": "#3a3a38",
        "grey-400": "#5a5a56",
        "grey-300": "#7a7a74",
        "grey-200": "#a0a09a",
        "grey-100": "#c8c8c0",
        offwhite: "#e4e4dc",

        // === Olive accent palette ===
        "olive-deep": "#4a5c28",
        olive: "#6b7c3e",
        "olive-mid": "#7a9040",
        "olive-light": "#9ab050",
        "olive-bright": "#b8cc60",
        "olive-pale": "#d4e090",
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'Outfit'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
