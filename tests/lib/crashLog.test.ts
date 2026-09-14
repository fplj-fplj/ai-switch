import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearCrashes,
  installCrashCapture,
  readCrashes,
  readTrail,
  recordAction,
  recordCrash,
} from "../../src/lib/crashLog";

describe("crash log", () => {
  beforeEach(() => {
    clearCrashes();
  });

  it("keeps the newest first, with the message and stack of a thrown Error", () => {
    recordCrash("boundary:App", new Error("Cannot read properties of null"));

    const [entry] = readCrashes();
    expect(entry.source).toBe("boundary:App");
    expect(entry.message).toBe("Cannot read properties of null");
    expect(entry.stack).toContain("Error");
  });

  it("describes what was rejected even when it is not an Error", () => {
    // A rejection carries whatever was thrown, and a string or a plain object is
    // as common as an Error. Recording "undefined" for those would lose the only
    // clue there is.
    recordCrash("unhandledrejection", "boom");
    recordCrash("unhandledrejection", { code: 42 });

    expect(readCrashes()[1].message).toBe("boom");
    expect(readCrashes()[0].message).toBe('{"code":42}');
  });

  it("caps the list so a repeating failure cannot fill storage", () => {
    for (let index = 0; index < 25; index += 1) {
      recordCrash("window.onerror", new Error(`error ${index}`));
    }

    const crashes = readCrashes();
    expect(crashes).toHaveLength(20);
    // The newest survived the trim; the oldest did not.
    expect(crashes[0].message).toBe("error 24");
    expect(crashes.some((entry) => entry.message === "error 4")).toBe(false);
  });

  it("caps the action trail, keeping the most recent", () => {
    for (let index = 0; index < 45; index += 1) {
      recordAction(`tap ${index}`);
    }

    const trail = readTrail();
    expect(trail).toHaveLength(40);
    expect(trail[trail.length - 1].label).toBe("tap 44");
  });

  it("counts the trail a crash saw, so the recovery taps can be told apart", () => {
    recordAction("选模型");
    recordAction("点思考强度");
    recordCrash("window.onerror", new Error("boom"));
    recordAction("点重试");

    expect(readCrashes()[0].trailLength).toBe(2);
    expect(readTrail()).toHaveLength(3);
  });

  it("still reports when storage cannot be written", () => {
    // A WebView configured without DOM storage throws on access, and the code whose
    // job is to report failures must not become one.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });

    try {
      expect(() => recordCrash("window.onerror", new Error("boom"))).not.toThrow();
      expect(() => recordAction("tap")).not.toThrow();
    } finally {
      if (original) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });
});

describe("installCrashCapture", () => {
  beforeEach(() => {
    clearCrashes();
  });

  afterEach(() => {
    clearCrashes();
  });

  it("records an uncaught error", () => {
    installCrashCapture();

    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("handler blew up"), message: "handler blew up" }),
    );

    expect(readCrashes()[0].source).toBe("window.onerror");
    expect(readCrashes()[0].message).toBe("handler blew up");
  });

  it("records an unhandled rejection", () => {
    installCrashCapture();

    // `PromiseRejectionEvent` is not in jsdom, so the listener gets the shape it
    // reads — `reason` — rather than a missing constructor being the test's subject.
    const event = new Event("unhandledrejection") as Event & { reason: unknown };
    event.reason = new Error("nobody awaited");
    window.dispatchEvent(event);

    expect(readCrashes()[0].source).toBe("unhandledrejection");
    expect(readCrashes()[0].message).toBe("nobody awaited");
  });

  it("records what was tapped, by its accessible name", () => {
    installCrashCapture();
    const button = document.createElement("button");
    button.setAttribute("aria-label", "推理程度 low 1");
    document.body.appendChild(button);

    try {
      button.click();
      expect(readTrail()[0].label).toBe("推理程度 low 1");
    } finally {
      button.remove();
    }
  });

  it("says nothing about a tap on the background", () => {
    // The trail is meant to be read, and a page full of `div` entries buries the
    // one tap that mattered.
    installCrashCapture();
    const background = document.createElement("div");
    document.body.appendChild(background);

    try {
      background.click();
      expect(readTrail()).toHaveLength(0);
    } finally {
      background.remove();
    }
  });
});
