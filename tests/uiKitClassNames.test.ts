import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGenerator } from "unocss";
import { describe, expect, it } from "vitest";
import config from "../uno.config";
import { buttonVariants } from "../src/components/ui-kit/Button";
import { listItemVariants } from "../src/components/ui-kit/ListItem";

/**
 * Every class name the mobile ui-kit writes must be one UnoCSS recognises.
 *
 * `tests/mobileClassNames.test.ts` scans the screen tree; this one covers the
 * component kit, which lives outside that directory and gets its class names
 * from `cva` object literals and `clsx()` calls rather than from JSX attributes
 * alone — so the extraction here needs three shapes, and the variant maps are
 * enumerated by calling the real `cva` builders instead of by regex (a regex
 * over object literals would silently drift the moment a variant is added).
 *
 * The failure mode is the same silent one as in the screen tree: an
 * unrecognised utility throws nothing, emits nothing, and the component renders
 * unstyled. On a phone, from this machine, nobody can see that.
 *
 * Deliberately no rendering: Radix primitives mount portals and presence
 * machinery that this jsdom setup has never exercised, and an unverifiable
 * render test would put the whole commit's signal at risk. Class generation is
 * the part the spec asks to pin ("每个新组件补一条断言「类名出现在生成的 CSS
 * 里」的测试"), and it is checkable without a DOM.
 */

// `process.cwd()` is the repo root under vitest; `import.meta.url` is not a
// `file:` URL in the jsdom environment and would throw during collection.
const UI_KIT_DIR = resolve(process.cwd(), "src/components/ui-kit");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Static class strings as they are actually written in this kit: a bare
 * `className="..."`, or the leading literal of a `clsx(` / `cva(` call.
 * Variants and boolean sizes live in object literals and are covered by
 * `variantClasses()` below, not by this regex.
 */
const LITERAL_PATTERNS = [/className="([^"]*)"/gs, /clsx\(\s*"([^"]*)"/gs, /cva\(\s*"([^"]*)"/gs];

function staticClassNames(source: string): string[] {
  const names: string[] = [];
  for (const pattern of LITERAL_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      names.push(...match[1].split(/\s+/).filter(Boolean));
    }
  }
  return names;
}

const BUTTON_VARIANTS = ["default", "secondary", "ghost", "destructive"] as const;
const BUTTON_SIZES = ["sm", "md", "lg", "icon"] as const;

/**
 * What the builders actually produce, per combination — the ground truth for
 * the parts a source regex cannot reach.
 */
function variantClasses(): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    out.push(...value.split(/\s+/).filter(Boolean));
  };
  push(buttonVariants());
  for (const variant of BUTTON_VARIANTS) {
    for (const size of BUTTON_SIZES) {
      push(buttonVariants({ variant, size }));
    }
  }
  push(listItemVariants());
  push(listItemVariants({ interactive: true }));
  push(listItemVariants({ interactive: false }));
  return out;
}

/**
 * A semantic token with an alpha modifier — `bg-primary/90`,
 * `active:bg-accent/60` — compiles to the plain `var()` colour and drops the
 * alpha silently (measured on this config before the kit was written: the
 * palette colours keep their alpha, the CSS-variable ones do not). It therefore
 * looks like a pressed state and is not one. Press feedback in this kit uses
 * `active:opacity-90`, `active:brightness-95` or a solid token instead, and this
 * pattern keeps any future `/alpha` on a semantic token from slipping back in.
 */
const SEMANTIC_ALPHA =
  /(?:^|:)(?:bg|text|border|ring)-(?:background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring)(?:-foreground)?\/\d/;

async function unmatched(classes: string[]): Promise<string[]> {
  const uno = await createGenerator(config);
  const result = await uno.generate(classes.join(" "), { preflights: false });
  return classes.filter((name) => !result.matched.has(name));
}

describe("mobile ui-kit class names", () => {
  it("only uses utilities UnoCSS generates", async () => {
    const files = sourceFiles(UI_KIT_DIR);
    expect(files.length).toBeGreaterThan(0);

    const classes = new Set<string>();
    for (const file of files) {
      for (const name of staticClassNames(readFileSync(file, "utf8"))) {
        classes.add(name);
      }
    }
    for (const name of variantClasses()) {
      classes.add(name);
    }
    // Vacuous-pass guard: if every extractor stops matching the source shape,
    // the assertions below would pass on an empty set.
    expect(classes.size).toBeGreaterThan(0);

    expect(await unmatched([...classes])).toEqual([]);
  });

  it("never puts an alpha modifier on a semantic token", () => {
    const classes = new Set<string>(variantClasses());
    for (const file of sourceFiles(UI_KIT_DIR)) {
      for (const name of staticClassNames(readFileSync(file, "utf8"))) {
        classes.add(name);
      }
    }
    expect(classes.size).toBeGreaterThan(0);
    expect([...classes].filter((name) => SEMANTIC_ALPHA.test(name))).toEqual([]);
  });

  it("covers both the static and the variant surface", () => {
    // The two extraction paths are independent; if either silently stops
    // matching, this is the assertion that turns into a red build rather than a
    // quietly weakened guard.
    const staticNames = sourceFiles(UI_KIT_DIR).flatMap((file) =>
      staticClassNames(readFileSync(file, "utf8")),
    );
    expect(new Set(staticNames).size).toBeGreaterThan(20);
    expect(new Set(variantClasses()).size).toBeGreaterThan(20);
    // The variant maps must contribute classes the literals do not.
    const onlyVariants = variantClasses().filter((name) => !staticNames.includes(name));
    expect(onlyVariants.length).toBeGreaterThan(0);
  });
});
