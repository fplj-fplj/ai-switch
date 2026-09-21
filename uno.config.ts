import { defineConfig, presetUno } from "unocss";

export default defineConfig({
  presets: [presetUno()],

  /**
   * Semantic tokens for the mobile interface, defined in `src/styles/tokens.css`.
   *
   * These are *added* to presetUno's own palette, not substituted for it — UnoCSS
   * deep-merges `theme`, so every `stone-*`, `slate-*` and `emerald-*` class the
   * desktop panel already uses keeps generating. That merge is load-bearing enough
   * to be pinned by `tests/designTokens.test.ts`: its failure mode is silent, since
   * a replaced palette would simply stop emitting those classes and the desktop
   * would lose its colours without anything throwing.
   *
   * The names follow the shadcn/ui vocabulary (`bg-background`,
   * `text-muted-foreground`, `border-input`) so components written against that
   * convention work here unchanged. Only the colour layer is borrowed; the utility
   * generator stays UnoCSS, because presetUno already emits every class those
   * components need and swapping the preset would recompute the whole desktop
   * stylesheet for no gain.
   */
  theme: {
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",

      card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
      popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },

      primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
      secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },

      muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
      accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },

      destructive: {
        DEFAULT: "var(--destructive)",
        foreground: "var(--destructive-foreground)",
      },

      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
    },
  },
});
