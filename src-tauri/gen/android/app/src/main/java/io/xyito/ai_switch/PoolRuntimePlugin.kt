package io.xyito.ai_switch

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * The Android-side facts the panel cannot work out for itself.
 *
 * Deliberately small. A command belongs here only when the webview has no way to
 * answer the question, because everything in this file is code the panel's tests
 * cannot reach.
 */
@TauriPlugin
class PoolRuntimePlugin(private val activity: Activity) : Plugin(activity) {
  /**
   * The addresses the pool can be reached at, from this device and from the network.
   *
   * The LAN address is simply the first non-loopback IPv4 the device holds. A phone
   * can hold several at once — wifi, a hotspot, a VPN — so this is a guess, and it
   * is reported as one: the panel shows the address and the user can see whether it
   * looks like the network they mean. Ranking interfaces properly would mean
   * guessing on their behalf, which is worse than showing what is there.
   */
  @Command
  fun getLocalAddresses(invoke: Invoke) {
    val result = JSObject()
    result.put("loopback", LOOPBACK_HOST)
    result.put("lan", firstLanAddress())
    invoke.resolve(result)
  }

  private fun firstLanAddress(): String? =
    try {
      NetworkInterface.getNetworkInterfaces()
        ?.asSequence()
        ?.filter { it.isUp && !it.isLoopback }
        ?.flatMap { it.inetAddresses.asSequence() }
        ?.filterIsInstance<Inet4Address>()
        ?.firstOrNull()
        ?.hostAddress
    } catch (_: Exception) {
      // Enumerating interfaces can throw on an unusual network stack. The panel
      // shows the loopback address and says nothing about the LAN, rather than
      // failing the settings page over a detail it can live without.
      null
    }

  private companion object {
    const val LOOPBACK_HOST = "127.0.0.1"
  }
}
