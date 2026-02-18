import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ClalMobile Design System
        brand: {
          DEFAULT: "#c41040",
          light: "#ff3366",
          dark: "#8b0a2e",
          soft: "rgba(196,16,64,0.08)",
        },
        surface: {
          bg: "#09090b",
          card: "#111114",
          elevated: "#18181b",
          border: "#27272a",
        },
        state: {
          success: "#22c55e",
          warning: "#eab308",
          error: "#ef4444",
          info: "#3b82f6",
          purple: "#a855f7",
          orange: "#f97316",
          cyan: "#06b6d4",
          pink: "#ec4899",
        },
        muted: "#71717a",
        dim: "#3f3f46",
      },
      fontFamily: {
        arabic: ["Tajawal", "sans-serif"],
        hebrew: ["Heebo", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
        button: "10px",
        chip: "8px",
      },
      screens: {
        mobile: { max: "767px" },
        tablet: { min: "768px", max: "1023px" },
        desktop: "1024px",
      },
    },
  },
  plugins: [],
};

export default config;
