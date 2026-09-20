import { isDesktop } from "./transport";

/**
 * Whether this bundle is running as a packaged mobile app.
 *
 * Deliberately not `isDesktop()`. That predicate answers "am I inside Tauri", and
 * the Android build is inside Tauri too, so it reports `true` there
 * (`tauri-transport.ts`) — while its sixteen call sites use it to mean "is this
 * the desktop build". Every one of them was therefore wrong on the phone:
 * autostart, the updater, deep links, tailscale and the local-HTTPS settings all
 * took their desktop branch and then called plugins that are not linked into the
 * APK.
 *
 * Two signals, because neither is sufficient alone:
 *
 *  - `TAURI_ENV_PLATFORM` is inlined by Vite at build time — `vite.config.ts`
 *    lists `TAURI_` in `envPrefix`, so the Android bundle carries the literal
 *    `"android"`. Cleaner, but it depends on the Tauri CLI exporting the variable
 *    before the frontend build runs, which has not been verified.
 *  - The WebView's user agent says `Android` on every Android device. That is
 *    sniffing, which is why it is the fallback rather than the whole answer.
 *
 * Either signal is enough, so mobile behaviour stays on even if the build
 * variable turns out not to be set.
 */
export function isMobileApp(): boolean {
  return buildPlatform() === "android" || userAgentLooksAndroid();
}

/**
 * Whether this is the desktop application.
 *
 * Use this — not `isDesktop()` — to gate a feature that only exists on a desktop:
 * autostart, the updater, the tray, deep links, CLI config writing, anything
 * whose commands live behind `#[cfg(feature = "desktop")]` in the Rust crate.
 * `isDesktop()` remains correct for "should I use the IPC transport", which is
 * true on both.
 *
 * Built on `isDesktop()` rather than on `isTauriRuntime()` directly, even though
 * the two agree today: `isDesktop()` goes through the transport, and the transport
 * is what the component tests substitute. Reaching past it would have made every
 * test that renders a desktop component see a non-desktop one.
 */
export function isDesktopApp(): boolean {
  return isDesktop() && !isMobileApp();
}

/**
 * Whether the OS back button exists and is delivered to this bundle.
 *
 * Only Android dispatches `backbutton` (Tauri 2), and only the packaged app has a
 * listener worth registering — the desktop build, the browser and the standalone
 * server all have no such button. Built on `isMobileApp()` rather than a fresh
 * check so there stays one place that decides what "the Android bundle" means.
 */
export function isAndroidApp(): boolean {
  return isMobileApp();
}

/** The platform Tauri inlined at build time, lowercased; `""` when absent. */
export function buildPlatform(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const platform = env?.TAURI_ENV_PLATFORM;
  return typeof platform === "string" ? platform.trim().toLowerCase() : "";
}

function userAgentLooksAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android/i.test(navigator.userAgent ?? "");
}
