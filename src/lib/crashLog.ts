/**
 * What went wrong last time, kept where the next launch can read it.
 *
 * A white screen destroys its own evidence: the tree that would have shown the
 * message is the thing that failed, so anything meant to survive has to be written
 * outside React, before the failure. Errors from `window.onerror`, from unhandled
 * rejections and from the error boundaries all land in one list, and the list
 * outlives a WebView reload — which is what a renderer restart looks like from here.
 *
 * The action trail is the other half. Not every blank screen comes with an error —
 * a native layer that never told JavaScript anything produces a clean, silent
 * disappearance — and then the only useful fact left is what the user had just
 * touched. So the last few interactions are recorded too, labels and all, and the
 * report pairs them with whatever error did land.
 *
 * Deliberately small and synchronous: this runs inside failure paths, and anything
 * asynchronous or clever here is one more thing that can fail while failing.
 */

const CRASH_KEY = "ai-switch.crash-log";
const TRAIL_KEY = "ai-switch.action-trail";
/** How many are kept. Enough to see a pattern, few enough to read on a phone. */
const MAX_CRASHES = 20;
const MAX_TRAIL = 40;

export type CrashEntry = {
  /** ISO 8601, so an entry from an earlier launch sorts against a later one. */
  at: string;
  /** Where it was caught: `window.onerror`, `unhandledrejection`, `boundary:App`. */
  source: string;
  message: string;
  stack?: string;
  /**
   * How many interactions had been recorded when this happened.
   *
   * A count rather than a timestamp: two taps in the same millisecond are ordinary
   * and a comparison on `at` would then include the recovery taps as if they had
   * led to the failure. The count cannot tie.
   */
  trailLength: number;
};

export type TrailEntry = {
  at: string;
  /** What the user touched — an accessible name, which is what buttons have. */
  label: string;
};

/**
 * The parsed lists, held so `useSyncExternalStore` gets a stable snapshot.
 *
 * Reading and parsing on every render would hand React a new array each time, and a
 * new array is a change as far as it is concerned, which is an infinite re-render.
 */
let crashes: CrashEntry[] = [];
let trail: TrailEntry[] = [];
let loaded = false;
/** Guarded because installing twice would record every failure twice over. */
let captureInstalled = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    // Absent in a non-browser test environment, and can throw outright when a
    // WebView is configured without DOM storage — neither is worth a crash in the
    // code whose job is to report crashes.
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readList<T>(key: string): T[] {
  const raw = storage()?.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupted by a half-written save. Dropping it loses history; keeping it
    // would break every later write.
    return [];
  }
}

function writeList(key: string, value: unknown) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // A full or disabled storage means the report is lost, not that the failure
    // that is being reported should be replaced by a second one.
  }
}

function ensureLoaded() {
  if (loaded) {
    return;
  }
  loaded = true;
  crashes = readList<CrashEntry>(CRASH_KEY);
  trail = readList<TrailEntry>(TRAIL_KEY);
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function now(): string {
  return new Date().toISOString();
}

export function recordCrash(source: string, error: unknown) {
  ensureLoaded();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
  const stack = error instanceof Error ? error.stack : undefined;
  crashes = [
    // Newest first: the banner shows the head, and capping from the tail keeps
    // the newest when the list is full.
    {
      at: now(),
      source,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000),
      trailLength: trail.length,
    },
    ...crashes,
  ].slice(0, MAX_CRASHES);
  writeList(CRASH_KEY, crashes);
  emit();
}

/**
 * One interaction, recorded as the user's accessible name for whatever they hit.
 *
 * `aria-label` first because it is the shortest honest description of a control —
 * "推理程度 low 1" — whereas `textContent` on a wrapper is a screenshot in words.
 */
export function recordAction(label: string) {
  ensureLoaded();
  trail = [...trail, { at: now(), label: label.slice(0, 160) }].slice(-MAX_TRAIL);
  writeList(TRAIL_KEY, trail);
}

export function readCrashes(): CrashEntry[] {
  ensureLoaded();
  return crashes;
}

export function readTrail(): TrailEntry[] {
  ensureLoaded();
  return trail;
}

export function clearCrashes() {
  ensureLoaded();
  crashes = [];
  trail = [];
  writeList(CRASH_KEY, crashes);
  writeList(TRAIL_KEY, trail);
  emit();
}

export function subscribeToCrashLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const TRAIL_IGNORED = new Set(["HTML", "BODY", "MAIN", "DIV"]);

function describeTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const labelled = target.closest("[aria-label]")?.getAttribute("aria-label");
  if (labelled) {
    return labelled;
  }
  // A `<select>` and its `<option>`s carry their meaning in their text, and a
  // `<select>` has no aria-label in most of this app.
  const select = target.closest("select");
  if (select) {
    const name = select.getAttribute("aria-label") ?? select.name ?? "select";
    return `${name} → ${(target as HTMLOptionElement).value ?? ""}`;
  }
  const own = target.tagName;
  if (!TRAIL_IGNORED.has(own)) {
    return own.toLowerCase();
  }
  return null;
}

/**
 * Wires the three failure channels to the log, once.
 *
 * `window.onerror` and `unhandledrejection` are the ones an error boundary cannot
 * see: a throw inside an event handler, or a rejected promise nobody awaited, never
 * reaches React, and a blank screen caused by one of those would otherwise leave no
 * trace at all.
 */
export function installCrashCapture() {
  if (typeof window === "undefined" || captureInstalled) {
    return;
  }
  captureInstalled = true;
  ensureLoaded();

  window.addEventListener("error", (event) => {
    // A resource that failed to load reports here too, with no `error` object and
    // a target instead. That is noise — a 404 on an icon is not a crash — so only
    // a real uncaught throw is recorded.
    if (event.error || (event.message && event.target === window)) {
      recordCrash("window.onerror", event.error ?? event.message);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    recordCrash("unhandledrejection", event.reason);
  });

  // Capture phase, so a handler that calls `stopPropagation` still leaves a mark.
  document.addEventListener(
    "click",
    (event) => {
      const label = describeTarget(event.target);
      if (label) {
        recordAction(label);
      }
    },
    true,
  );
}
