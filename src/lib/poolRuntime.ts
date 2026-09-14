import { isMobileApp } from "./platform";
import { getTransport } from "./transport";

/**
 * Facts about the Android runtime that the webview cannot work out on its own.
 *
 * Kept out of `api/client.ts` on purpose: that module is the HTTP/IPC command
 * surface, and `tests/transport/command-contract.test.ts` asserts every command in
 * it resolves to a Rust handler or a web handler. These are served by the Kotlin
 * plugin instead, so they would fail that contract rather than satisfy it.
 */
export type LocalAddresses = {
  /** What this device reaches the pool at from inside itself. */
  loopback: string;
  /**
   * What the network reaches it at — the first non-loopback IPv4 the device holds,
   * or `null` when it holds none. A phone can hold several at once (wifi, hotspot,
   * a VPN), so this is the one the platform happened to report first: the panel
   * shows it and the user judges it, rather than the two of us guessing.
   */
  lan: string | null;
};

/**
 * `null` everywhere the plugin is not registered — desktop, and any failure.
 *
 * A missing address is a detail the panel can live without, and a settings page
 * that throws because a network interface could not be enumerated would be worse
 * than one that quietly shows less.
 */
export async function getLocalAddresses(): Promise<LocalAddresses | null> {
  if (!isMobileApp()) {
    return null;
  }

  try {
    return await getTransport().call<LocalAddresses>("plugin:pool-runtime|getLocalAddresses");
  } catch {
    return null;
  }
}

export type KeepAliveStatus = {
  /** `Build.MANUFACTURER`, which is what the vendor table matches on. */
  manufacturer: string;
  /** `Build.BRAND`, reported because the two disagree on some devices. */
  brand: string;
  /** True when the system has excused this app from battery optimisation. */
  ignoringBatteryOptimizations: boolean;
};

async function callPlugin<T>(command: string): Promise<T | null> {
  if (!isMobileApp()) {
    return null;
  }

  try {
    return await getTransport().call<T>(`plugin:pool-runtime|${command}`);
  } catch {
    return null;
  }
}

export function getKeepAliveStatus() {
  return callPlugin<KeepAliveStatus>("getKeepAliveStatus");
}

/**
 * When the WebView was seen to stop answering, as ISO timestamps, oldest first.
 *
 * Read once and cleared on the native side, so a death is reported on the launch
 * after it happened and not on every launch afterwards. Empty on desktop, and empty
 * on a phone that has never gone quiet.
 */
export async function getRenderProcessSilences(): Promise<string[]> {
  const result = await callPlugin<{ silences: string }>("getRenderProcessReport");
  if (!result?.silences) {
    return [];
  }
  return result.silences
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Opens the system's "don't optimise this app" dialog, and reports whether one
 * opened at all.
 *
 * `false` means the device has no such dialog to show, not that the user refused —
 * the answer comes from the next `getKeepAliveStatus`, since the dialog is outside
 * this app and reports nothing back.
 */
export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  const result = await callPlugin<{ opened: boolean }>("requestIgnoreBatteryOptimizations");
  return result?.opened ?? false;
}

/**
 * Opens the first keep-alive screen this ROM has, falling back to the app's own
 * details page when none of the known ones exist. `false` means even that failed.
 */
export async function openVendorKeepAliveSettings(): Promise<boolean> {
  const result = await callPlugin<{ opened: boolean }>("openVendorKeepAliveSettings");
  return result?.opened ?? false;
}
