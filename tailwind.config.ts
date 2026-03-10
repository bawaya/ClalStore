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
        glass: {
          bg: "rgba(255,255,255,0.03)",
          border: "rgba(255,255,255,0.06)",
          elevated: "rgba(255,255,255,0.05)",
          hover: "rgba(255,255,255,0.08)",
          subtle: "rgba(255,255,255,0.02)",
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
        hebrew: ["David Libre", "Heebo", "serif"],
      },
      borderRadius: {
        card: "16px",
        button: "12px",
        chip: "8px",
        pill: "9999px",
      },
      backdropBlur: {
        "glass-sm": "8px",
        "glass-md": "16px",
        "glass-lg": "24px",
        "glass-xl": "40px",
      },
      boxShadow: {
        glass: "0 4px 30px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-lg": "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-brand": "0 8px 32px rgba(0,0,0,0.2), 0 0 20px rgba(196,16,64,0.08)",
        "glass-glow": "0 0 30px rgba(196,16,64,0.12)",
      },
      zIndex: {
        header: "50",
        compare: "100",
        toast: "300",
        cookie: "400",
        pwa: "500",
        chat: "600",
        modal: "800",
        top: "999",
      },
      screens: {
        mobile: { max: "767px" },
        tablet: { min: "768px", max: "1023px" },
        desktop: "1024px",
      },
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(196,16,64,0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(196,16,64,0.2)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
