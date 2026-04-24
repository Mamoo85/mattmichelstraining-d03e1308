import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          soft: "hsl(var(--foreground-soft))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        m2: {
          surface: "hsl(var(--m2-surface))",
          "surface-alt": "hsl(var(--m2-surface-alt))",
          "surface-hover": "hsl(var(--m2-surface-hover))",
          dim: "hsl(var(--m2-dim))",
          "text-dim": "hsl(var(--m2-text-dim))",
          rust: "hsl(var(--m2-rust))",
        },
        "intel-teal": "hsl(186 100% 47%)",
        "seal-gold": "hsl(43 89% 55%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"SF Mono"', '"Fira Code"', 'monospace'],
        brand: ['Oswald', 'Impact', '"Arial Black"', 'sans-serif'],
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
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px -2px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 20px -2px hsl(var(--primary) / 0.6)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "set-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)", boxShadow: "0 0 16px rgba(16,185,129,0.5)" },
          "100%": { transform: "scale(1)", boxShadow: "0 0 0px rgba(16,185,129,0)" },
        },
        "confetti-burst": {
          "0%": { transform: "translate(0,0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translate(var(--confetti-x), var(--confetti-y)) rotate(var(--confetti-r))", opacity: "0" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scanline": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "seal-stamp": {
          "0%": { transform: "scale(2) rotate(-15deg)", opacity: "0" },
          "60%": { transform: "scale(0.9) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "dossier-glow": {
          "0%, 100%": { boxShadow: "0 0 20px -5px hsl(186 100% 47% / 0.3)" },
          "50%": { boxShadow: "0 0 40px -5px hsl(186 100% 47% / 0.6)" },
        },
        "pulse-flame": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.08)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        fadeIn: "fadeIn 0.4s ease-out",
        fadeInUp: "fadeInUp 0.4s ease-out 0.2s both",
        "set-pop": "set-pop 0.4s ease-out",
        "confetti-burst": "confetti-burst 0.8s ease-out forwards",
        "shimmer": "shimmer 3s linear infinite",
        "scanline": "scanline 4s ease-in-out infinite",
        "seal-stamp": "seal-stamp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "dossier-glow": "dossier-glow 3s ease-in-out infinite",
        "pulse-flame": "pulse-flame 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
