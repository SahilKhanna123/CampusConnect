import type { Config } from "tailwindcss";

// Tailwind is scoped to a handful of components (see CLAUDE.md's UI polish
// plan) -- the rest of the app stays on plain CSS in src/app/globals.css.
// `content` is deliberately narrow (not a broad src/**/*.tsx glob) to
// document that scope and keep the generated stylesheet small; add a file
// here only when it's deliberately being migrated to Tailwind.
const config: Config = {
  content: [
    "./src/components/ExploreCard.tsx",
    "./src/components/EmptyState.tsx",
    "./src/components/VerificationBadge.tsx",
    "./src/app/messages/page.tsx",
    "./src/app/connections/page.tsx",
    "./src/app/family/page.tsx",
    "./src/app/my-posts/page.tsx",
    "./src/app/profile/page.tsx",
    "./src/app/profile/[userId]/page.tsx",
  ],
  // Preflight's base reset would otherwise apply globally (Tailwind's
  // output is plain CSS, not scoped to these files) and fight with
  // globals.css's own element defaults on every untouched page.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // Mirrors the :root custom properties in src/app/globals.css so a
      // Tailwind-styled component (e.g. text-gray-meta, border-border)
      // resolves to the exact same value as its untouched plain-CSS
      // neighbors, and stays in sync if those variables ever change.
      colors: {
        black: "var(--color-black)",
        white: "var(--color-white)",
        "gray-section": "var(--color-gray-section)",
        "gray-body": "var(--color-gray-body)",
        "gray-meta": "var(--color-gray-meta)",
        border: "var(--color-border)",
        green: "var(--color-green)",
        "green-bg": "var(--color-green-bg)",
        blue: "var(--color-blue)",
        "blue-bg": "var(--color-blue-bg)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      boxShadow: {
        hover: "var(--shadow-hover)",
        card: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
