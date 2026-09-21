import { createGenerator } from "unocss";
import { describe, expect, it } from "vitest";
import config from "../uno.config";

/**
 * The only mechanical defence this project has for styling.
 *
 * There is no browser and no device where this is developed, so nobody can look at
 * the result — the one thing a machine *can* check is whether UnoCSS recognises the
 * class names the mobile components use. A typo, or a token that was never wired
 * into `theme.colors`, produces no error and no warning: it just silently emits
 * nothing and the element renders unstyled.
 *
 * `src/styles/tokens.css` is deliberately not loaded here. The generator only needs
 * to know the token *names* resolve; the values reach the page through the
 * stylesheet. That is also why these assertions are about `matched` rather than the
 * generated text — the rule for `bg-background` is just
 * `background-color:var(--background)`, which is exactly what the stylesheet
 * resolves at runtime.
 */

/** Returns the subset of `classes` that UnoCSS did not recognise — empty is a pass. */
async function unmatched(classes: string[]): Promise<string[]> {
  const uno = await createGenerator(config);
  const result = await uno.generate(classes.join(" "), { preflights: false });
  return classes.filter((name) => !result.matched.has(name));
}

describe("design tokens", () => {
  it("generates the semantic colour classes the mobile components use", async () => {
    expect(
      await unmatched([
        "bg-background",
        "text-foreground",
        "bg-card",
        "text-card-foreground",
        "bg-popover",
        "text-popover-foreground",
        "bg-primary",
        "text-primary-foreground",
        "bg-secondary",
        "text-secondary-foreground",
        "bg-muted",
        "text-muted-foreground",
        "bg-accent",
        "text-accent-foreground",
        "bg-destructive",
        "text-destructive-foreground",
        "border-border",
        "border-input",
        "ring-ring",
      ]),
    ).toEqual([]);
  });

  /**
   * The reason the preset was not swapped.
   *
   * Every class here belongs to presetUno's own palette and is already used by the
   * existing desktop screens, so `theme.colors` has to *merge* with it rather than
   * replace it. If this test ever fails the desktop has lost its colour scheme, and
   * it would fail silently in production: a utility that stops being generated
   * throws nothing, it simply is not in the stylesheet.
   */
  it("keeps presetUno's own palette intact", async () => {
    expect(
      await unmatched([
        "bg-stone-100",
        "text-stone-950",
        "border-stone-200",
        "text-stone-500",
        "bg-slate-900",
        "text-slate-700",
        "border-slate-200",
        "bg-emerald-50",
        "text-amber-700",
        "bg-white",
        "hover:bg-slate-800",
        "rounded-xl",
        "shadow-sm",
      ]),
    ).toEqual([]);
  });

  /**
   * Radix primitives carry their state in attributes rather than class names, so
   * without these variants the components render unstyled in every non-default
   * state. They are also the syntax most likely to be quietly unsupported, which is
   * why each is asserted on its own instead of being assumed to follow from the
   * plain utilities working.
   */
  it("supports the attribute variants the Radix primitives need", async () => {
    expect(
      await unmatched([
        "data-[state=open]:bg-accent",
        "data-[state=closed]:opacity-0",
        "aria-expanded:rotate-180",
        "aria-selected:bg-accent",
        "focus-visible:ring-2",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
        "[&_svg]:size-4",
        "hover:bg-muted",
        "sm:flex-row",
        "min-[600px]:grid-cols-2",
        "supports-[backdrop-filter]:bg-white/60",
      ]),
    ).toEqual([]);
  });
});
