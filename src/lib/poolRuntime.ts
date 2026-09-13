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
