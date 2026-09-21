import { App } from "./App";
import { isMobileApp } from "./lib/platform";
import { MobileApp } from "./mobile/MobileApp";

/**
 * Which application this bundle is.
 *
 * There are two trees now, and the choice is made here rather than inside `App`
 * for a mechanical reason: `App()` opens with eight `useState` and four `useEffect`
 * calls, so an early `return` in the middle of it is not legal without hoisting all
 * of them above the branch — a large, risky edit to a file the desktop still uses.
 * Deciding before either tree mounts keeps both of them honest and leaves `App`
 * byte-identical.
 *
 * The predicate is `isMobileApp()`, not `isDesktop()`. Both are true inside the
 * Android WebView (`isDesktop()` answers "am I in Tauri", and the APK is), so
 * `isDesktop()` would send the phone down the desktop branch — the exact mistake
 * its doc comment records having made in sixteen other call sites. A browser and
 * the standalone server report `false` here and keep the desktop tree.
 *
 * This file used to branch into a hosted "portal" mode when the SaaS plugin was
 * enabled, which is why it exists separately from `App` at all. That plugin is
 * gone; the branch it left behind is now this one.
 */
export function ApplicationEntry() {
  return isMobileApp() ? <MobileApp /> : <App />;
}
