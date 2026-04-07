import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#f0eefb",
          100: "#d9d5f5",
          200: "#b3abeb",
          300: "#8d81e0",
          400: "#6757d6",
          500: "#534AB7",
          600: "#433b92",
          700: "#322c6e",
          800: "#211e49",
          900: "#110f25",
        },
        org: {
          wwsh: "#534AB7",
          beyondchess: "#0D9488",
          ourrose: "#D97706",
          adaptive: "#EA580C",
          mosthated: "#DC2626",
        },
      },
    },
  },
  plugins: [],
};
export default config;
