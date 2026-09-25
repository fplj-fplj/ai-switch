import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator } from "unocss";
import { describe, expect, it } from "vitest";
import config from "../uno.config";

/**
 * Every class name the mobile tree writes must be one UnoCSS recognises.
 *
 * `tests/designTokens.test.ts` asserts a fixed list of classes by hand; this one
 * reads the actual source, so it keeps working as the mobile tree grows without
 * anyone remembering to extend a list. The failure mode it guards is the silent
 * one: an unrecognised utility throws nothing, emits nothing, and the element
 * renders unstyled — which on a phone nobody can see from this machine.
 *
 * It exists because of a concrete bug: the first skeleton used `min-h-screen`,
 * which generates fine but was wrong against `#root`'s `max-height: 100dvh` clip.
 * That class was valid — the point here is narrower and mechanically checkable:
 * a class that does not generate at all (a Tailwind-only spelling like
 * `pt-safe`, or a token never wired into `theme.colors`) is always a bug.
 *
 * Scope: plain `className="..."` string literals. Conditional and template-literal
 * classNames are not scanned — when the ui-kit lands, its variants come from
 * `class-variance-authority` and the attribute syntax itself is pinned by
 * designTokens.test.ts, so the unscanned surface stays small on purpose.
 */

const MOBILE_DIR = fileURLToPath(new URL("../src/mobile", import.meta.url));

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

function staticClassNames(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/className="([^"]*)"/gs)) {
    names.push(...match[1].split(/\s+/).filter(Boolean));
  }
  return names;
}

describe("mobile class names", () => {
  it("only uses utilities UnoCSS generates", async () => {
    const files = sourceFiles(MOBILE_DIR);
    expect(files.length).toBeGreaterThan(0);

    const classes = new Set<string>();
    for (const file of files) {
      for (const name of staticClassNames(readFileSync(file, "utf8"))) {
        classes.add(name);
      }
    }
    // Vacuous-pass guard: if the extractor ever stops matching the source shape,
    // the assertion below would pass on an empty set.
    expect(classes.size).toBeGreaterThan(0);

    const uno = await createGenerator(config);
    const result = await uno.generate([...classes].join(" "), { preflights: false });
    const missing = [...classes].filter((name) => !result.matched.has(name));
    expect(missing).toEqual([]);
  });
});
