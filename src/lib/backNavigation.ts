import { getCurrentWindow } from "@tauri-apps/api/window";
import { isAndroidApp } from "./platform";

/** What one Android back press should do. */
export type BackAction = "dialog" | "drawer" | "settings" | "exit";

export type BackContext = {
  /** A registered dialog (or other stacked handler) already consumed the press. */
  handlerConsumed: boolean;
  /** Narrow layout with the sidebar drawer open. */
  drawerVisible: boolean;
  /** The active screen is inside the Settings area. */
  settingsActive: boolean;
};

/**
 * Decide what one back press means, innermost first.
 *
 * The order is the whole point: a dialog outranks the drawer, the drawer
 * outranks the Settings fallback, and the Settings root is the end of the line.
 *
 * `"exit"` is a real action rather than "do nothing". Registering
 * `onBackButtonPress` cancels Android's default finish for as long as the
 * listener lives, so returning quietly at the root would swallow the press and
 * leave the app impossible to leave with the back button. The finish has to be
 * asked for explicitly — see `requestAppExit`.
 */
export function resolveBackAction(context: BackContext): BackAction {
  if (context.handlerConsumed) {
    return "dialog";
  }
  if (context.drawerVisible) {
    return "drawer";
  }
  if (!context.settingsActive) {
    return "settings";
  }
  return "exit";
}

/**
 * Ask the platform to finish the Android activity.
 *
 * Needs `core:window:allow-close`, granted in `capabilities/android.json`. The
 * rejection is swallowed on purpose: there is no second path to try, and a
 * failed close must not turn a silent back press into a visible error.
 */
export async function requestAppExit(): Promise<void> {
  if (!isAndroidApp()) {
    return;
  }

  try {
    await getCurrentWindow().close();
  } catch {
    // No fallback available; the press simply has no effect, as before.
  }
}
