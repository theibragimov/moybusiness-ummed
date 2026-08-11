import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef3ff",
          100: "#dce6ff",
          200: "#b8ccff",
          300: "#8aa9ff",
          400: "#5c82ff",
          500: "#3b63f5",
          600: "#2c4ee0",
          700: "#233fb8",
          800: "#1d3491",
          900: "#1a2d73",
        },
        surface: "#f3f5fb",
        ink: {
          900: "#131b2e",
          700: "#3c4661",
          500: "#6b7690",
          400: "#94a0b8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        soft: "0 2px 10px rgba(20, 30, 60, 0.04), 0 12px 32px rgba(20, 30, 60, 0.06)",
        card: "0 1px 2px rgba(20,30,60,0.03), 0 8px 24px rgba(30,45,90,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
