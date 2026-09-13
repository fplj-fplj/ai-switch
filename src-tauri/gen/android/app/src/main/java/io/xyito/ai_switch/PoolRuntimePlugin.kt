package io.xyito.ai_switch

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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

  /**
   * Whether the system has excused this app from battery optimisation, and which
   * vendor the guidance should offer next.
   *
   * The manufacturer is reported alongside because the panel wants to say "on this
   * phone, look here" rather than showing a list of every ROM's instructions.
   */
  @Command
  fun getKeepAliveStatus(invoke: Invoke) {
    val result = JSObject()
    result.put("manufacturer", Build.MANUFACTURER ?: "")
    result.put("brand", Build.BRAND ?: "")
    result.put("ignoringBatteryOptimizations", isIgnoringBatteryOptimizations())
    invoke.resolve(result)
  }

  /**
   * Opens the system's "don't optimise this app" dialog.
   *
   * The direct request rather than the settings list is only permitted to apps
   * that qualify, and Play polices that — but this build is sideloaded, which is
   * exactly the case the direct intent exists for.
   */
  @Command
  fun requestIgnoreBatteryOptimizations(invoke: Invoke) {
    val opened = try {
      activity.startActivity(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
          .setData(Uri.parse("package:${activity.packageName}")),
      )
      true
    } catch (_: ActivityNotFoundException) {
      false
    }
    invoke.resolve(JSObject().apply { put("opened", opened) })
  }

  /**
   * Opens the first keep-alive screen this ROM actually has.
   *
   * Every vendor keeps this in a different, unexported activity, so the list is
   * ordered best-first and probed rather than assumed. A name that is wrong for
   * this ROM simply does not resolve and the next one is tried; if none resolve,
   * the app's own details page is the honest fallback — it is the one page that
   * always exists, even though it does not solve the problem by itself.
   */
  @Command
  fun openVendorKeepAliveSettings(invoke: Invoke) {
    val opened = openFirstAvailable(vendorPages(Build.MANUFACTURER, Build.BRAND))
    invoke.resolve(JSObject().apply { put("opened", opened) })
  }

  private fun isIgnoringBatteryOptimizations(): Boolean {
    val power = activity.getSystemService(PowerManager::class.java) ?: return false
    return power.isIgnoringBatteryOptimizations(activity.packageName)
  }

  private fun openFirstAvailable(pages: List<Pair<String, String>>): Boolean {
    val manager = activity.packageManager
    for ((packageName, className) in pages) {
      val intent = Intent().setComponent(ComponentName(packageName, className))
      if (manager.resolveActivity(intent, 0) == null) {
        continue
      }
      try {
        activity.startActivity(intent)
        return true
      } catch (_: ActivityNotFoundException) {
        // Declared but not exported on this ROM, or removed by the vendor.
      } catch (_: SecurityException) {
        // Same, reported differently depending on the ROM.
      }
    }
    return openAppDetails()
  }

  private fun openAppDetails(): Boolean = try {
    activity.startActivity(
      Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:${activity.packageName}"),
      ),
    )
    true
  } catch (_: Exception) {
    false
  }

  /**
   * The keep-alive screens for a manufacturer, best first.
   *
   * Matched on manufacturer *and* brand because the two disagree: realme and
   * OnePlus report themselves as OPPO on one field and not the other, and Honor is
   * its own company whose package name only exists on devices shipped after the
   * split — hence Honor trying its own path before falling back to Huawei's.
   *
   * Samsung has no auto-start screen at all. Its equivalent problem is "sleeping
   * apps", which is why the battery screen is what gets opened there.
   */
  private fun vendorPages(manufacturer: String, brand: String): List<Pair<String, String>> {
    val maker = manufacturer.trim().lowercase()
    val mark = brand.trim().lowercase()
    fun anyOf(vararg needles: String) =
      needles.any { maker.contains(it) || mark.contains(it) }

    return when {
      anyOf("xiaomi", "redmi", "poco") -> listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
        "com.miui.securitycenter" to "com.miui.permissions.PermissionsEditorActivity",
      )

      anyOf("honor", "hihonor") -> listOf(
        "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity",
      )

      anyOf("huawei") -> listOf(
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity",
      )

      anyOf("oppo", "realme", "oneplus") -> listOf(
        "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
        "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
      )

      anyOf("vivo", "iqoo") -> listOf(
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
        "com.iqoo.secure" to "com.iqoo.secure.safeguard.PurviewTabActivity",
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.PurviewTabActivity",
      )

      anyOf("samsung") -> listOf(
        "com.samsung.android.lool" to "com.samsung.android.sm.ui.battery.BatteryActivity",
      )

      anyOf("meizu") -> listOf(
        "com.meizu.safe" to "com.meizu.safe.permission.SmartBGActivity",
        "com.meizu.safe" to "com.meizu.safe.permission.PermissionMainActivity",
      )

      anyOf("asus") -> listOf(
        "com.asus.mobilemanager" to "com.asus.mobilemanager.MainActivity",
        "com.asus.mobilemanager" to "com.asus.mobilemanager.powersaver.PowerSaverSettings",
      )

      anyOf("lenovo", "zuk") -> listOf(
        "com.lenovo.powersetting" to "com.lenovo.powersetting.activity.PowerSettingActivity",
      )

      anyOf("nokia", "evenwell") -> listOf(
        "com.evenwell.powersaving.g3" to "com.evenwell.powersaving.g3.powersaving.PowerSavingActivity",
      )

      // Stock Android and anything unrecognised: there is no vendor page to open,
      // so the battery-optimisation request above is the whole of the guidance.
      else -> emptyList()
    }
  }

  private companion object {
    const val LOOPBACK_HOST = "127.0.0.1"
  }
}
