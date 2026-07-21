import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#10B981",
          "green-dark": "#059669",
          red: "#EF4444",
          amber: "#F59E0B",
          "amber-dark": "#D97706",
        },
        category: {
          home: "#2D3748",
          "home-light": "#4A5568",
          garden: "#1B4332",
          "garden-light": "#2D6A4F",
          pets: "#4A1D6A",
          "pets-light": "#7B2D8E",
        },
        hero: {
          dark: "#1E3A5F",
          light: "#2D5A8E",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        marquee: "marquee 20s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;