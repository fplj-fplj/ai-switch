import { isMobileApp } from "./platform";

/**
 * Screens the mobile build does not offer.
 *
 * Hidden, not deleted: the components stay compiled, the desktop build routes to
 * them exactly as before, and only the phone stops offering an entrance. Every
 * entry here is one whose backing commands are absent from the mobile build, so
 * the screen could only render and then fail.
 */
const MOBILE_HIDDEN_SCREENS: ReadonlySet<string> = new Set([
  // PTY terminals, plus the three.js skin that hangs off them. The terminal
  // subsystem is its own cargo feature and `mobile` does not select it.
  "Vibe",
  // ocrad.js is a large payload for a convenience a phone does not need.
  "OCR",
  // `mcp::command` and `skills::command` are both `#[cfg(feature = "desktop")]`.
  "MCP",
  "Skills",
  // `tauri-plugin-updater` is not linked into the APK.
  "Updates",
  // Resumes a session by opening a system terminal (`open_session_terminal`,
  // which rides the `terminal` feature).
  "Sessions",
  // Writes CLI config files — `~/.codex/config.toml` and friends. They do not
  // exist on a phone, and neither does the concept.
  "Targets",
  // `imagegen_commands` is `#[cfg(feature = "desktop")]`.
  "ImageGen",
  // `Log` is deliberately absent. It was on this list for two reasons, and neither
  // holds: its command (`list_config_snapshots`) *is* registered for mobile, and the
  // `BaseDirs` failure that did break it was in the Rust read path, which is where it
  // was fixed. What the screen shows on a phone is an empty list — there are no CLI
  // config files to have snapshots of — and an empty list that loads is worth more
  // than a module that quietly disappears.
]);

/**
 * Whether this platform may show `screen`.
 *
 * Separate from `agentVisibility`, and deliberately so: that one is a *user
 * preference* over the seven agent screens, which the user is free to change.
 * This is a *platform constraint* they cannot override. The two compose — a
 * screen shows when the platform allows it and the user has not hidden it — so
 * neither should be folded into the other.
 *
 * `mobile` is a parameter rather than a call to `isMobileApp()` at each use, so a
 * test can state which platform it means instead of mocking the environment.
 */
export function isScreenAvailable(screen: string, mobile: boolean = isMobileApp()): boolean {
  if (!mobile) {
    return true;
  }

  return !MOBILE_HIDDEN_SCREENS.has(screen);
}

/**
 * The screen to show when `screen` is not available here.
 *
 * Falls back to `Settings`, which every build keeps, rather than to an agent
 * screen the user may have hidden — the same reasoning as
 * `resolveVisibleAgentScreen` in `agentVisibility.ts`.
 */
export function resolveAvailableScreen(screen: string, mobile: boolean = isMobileApp()): string {
  return isScreenAvailable(screen, mobile) ? screen : "Settings";
}
