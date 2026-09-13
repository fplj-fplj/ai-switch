import { afterEach, describe, expect, it } from "vitest";
import { isMobileApp } from "../../src/lib/platform";
import { isScreenAvailable, resolveAvailableScreen } from "../../src/lib/screenAvailability";

/** jsdom reports a desktop-ish UA, so the mobile signal has to be injected. */
function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  // Leave the ambient UA as jsdom set it rather than leaking the Android one.
  delete (window.navigator as unknown as Record<string, unknown>).userAgent;
});

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("isMobileApp", () => {
  it("is false for a desktop user agent", () => {
    setUserAgent(DESKTOP_UA);
    expect(isMobileApp()).toBe(false);
  });

  it("is true for an Android user agent", () => {
    setUserAgent(ANDROID_UA);
    expect(isMobileApp()).toBe(true);
  });
});

describe("screen availability", () => {
  it("offers every screen on the desktop build", () => {
    // The whole point of the platform filter is that it changes nothing here.
    for (const screen of ["Vibe", "OCR", "MCP", "Skills", "Updates", "Sessions", "Targets", "ImageGen"]) {
      expect(isScreenAvailable(screen, false)).toBe(true);
    }
  });

  it("withholds the screens whose commands are absent from the mobile build", () => {
    for (const screen of [
      "Vibe",
      "OCR",
      "MCP",
      "Skills",
      "Updates",
      "Sessions",
      "Targets",
      "ImageGen",
    ]) {
      expect(isScreenAvailable(screen, true)).toBe(false);
    }
  });

  it("keeps the first-phase screens on mobile", () => {
    for (const screen of ["Codex", "Claude", "Settings", "About", "SaaS"]) {
      expect(isScreenAvailable(screen, true)).toBe(true);
    }
  });

  it("keeps the operation log on mobile", () => {
    // Named on its own because it was hidden once, by mistake. The screen is empty on
    // a phone — there are no CLI config files to have snapshots of — but it loads,
    // and "no config operations recorded" is a truthful answer where a vanishing
    // module is not.
    expect(isScreenAvailable("Log", true)).toBe(true);
  });

  it("falls back to Settings, not to an agent screen the user may have hidden", () => {
    expect(resolveAvailableScreen("Vibe", true)).toBe("Settings");
    expect(resolveAvailableScreen("Codex", true)).toBe("Codex");
    expect(resolveAvailableScreen("Vibe", false)).toBe("Vibe");
  });
});
