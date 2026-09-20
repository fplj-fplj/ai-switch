import { openUrl } from "@tauri-apps/plugin-opener";
import { isDesktopApp } from "./platform";

/**
 * Open an http(s) url outside the app.
 *
 * The desktop webview drops `window.open` and `target="_blank"` navigations, so
 * the URL has to be handed to the system browser through the opener plugin.
 * Failures are propagated instead of swallowed: a silently dead link is worse
 * than a visible error.
 *
 * Gated on `isDesktopApp()`, not `isDesktop()`: the Android build is inside
 * Tauri too, so `isDesktop()` reads true there — but `tauri-plugin-opener` is
 * not linked into the APK (`capabilities/android.json` grants only
 * `core:default`), so calling it can only reject. Android falls back to
 * `window.open`, the same path a plain browser takes.
 */
export async function openExternal(url: string): Promise<void> {
  if (isDesktopApp()) {
    await openUrl(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
