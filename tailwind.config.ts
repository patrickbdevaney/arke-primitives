import type { Config } from "tailwindcss";

// Minimal Tailwind setup. We only scan src/ so the build stays fast.
// The starter kit uses utility classes directly in the components; there is no
// design system to learn — just enough styling to make the demos readable.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Arc brand-ish accent, used sparingly for primary actions.
        arc: "#5b6cff",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
