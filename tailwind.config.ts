import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/emails/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        // 跨性别旗 + Anthropic-warm 基调
        trans: {
          pink: "#F5A9B8",
          "pink-soft": "#FCE0E6",
          "pink-deep": "#E58AA0",
          blue: "#5BCEFA",
          "blue-soft": "#E0F4FE",
          "blue-deep": "#3CB6E8",
          white: "#FFFFFF",
        },
        bg: {
          warm: "#FAF7F2",
          card: "#FFFFFF",
          muted: "#F2EEE7",
        },
        ink: {
          DEFAULT: "#1F1B17",
          muted: "#6B655E",
          subtle: "#9A938A",
          inverse: "#FAF7F2",
        },
        border: {
          DEFAULT: "#E8E2D8",
          strong: "#D6CFC2",
        },
        // shadcn-style semantic tokens, mapped to our palette
        background: "#FAF7F2",
        foreground: "#1F1B17",
        primary: {
          DEFAULT: "#3CB6E8",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#E58AA0",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F2EEE7",
          foreground: "#6B655E",
        },
        accent: {
          DEFAULT: "#FCE0E6",
          foreground: "#1F1B17",
        },
        destructive: {
          DEFAULT: "#C7464D",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F1B17",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F1B17",
        },
        ring: "#5BCEFA",
        input: "#E8E2D8",
      },
      fontFamily: {
        serif: [
          "'Source Serif 4'",
          "'Source Han Serif SC'",
          "'Noto Serif SC'",
          "Georgia",
          "serif",
        ],
        sans: [
          "Inter",
          "'PingFang SC'",
          "'Source Han Sans SC'",
          "'Noto Sans SC'",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "'SF Mono'",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Editorial scale
        "display-lg": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "400" }],
        "display": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "400" }],
        "h1": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "500" }],
        "h2": ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.005em", fontWeight: "500" }],
        "h3": ["1.25rem", { lineHeight: "1.35", fontWeight: "500" }],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        "soft": "0 1px 2px rgba(31, 27, 23, 0.04), 0 4px 12px rgba(31, 27, 23, 0.04)",
        "lift": "0 2px 4px rgba(31, 27, 23, 0.06), 0 8px 24px rgba(31, 27, 23, 0.08)",
      },
      backgroundImage: {
        "trans-gradient": "linear-gradient(135deg, #F5A9B8 0%, #5BCEFA 100%)",
        "trans-gradient-soft": "linear-gradient(135deg, #FCE0E6 0%, #E0F4FE 100%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
