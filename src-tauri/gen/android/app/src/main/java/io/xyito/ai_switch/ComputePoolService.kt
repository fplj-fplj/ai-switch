package io.xyito.ai_switch

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import java.io.File
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import org.json.JSONObject

/**
 * Keeps this process alive while the compute pool is actually reachable.
 *
 * A local gateway is only worth anything if it still answers while the app is in
 * the background, and a foreground service is the only way Android lets an app say
 * "this process is doing something the user asked for". The notification is not a
 * side effect of that — it is the condition, and it doubles as the honest indicator
 * that the pool is up.
 *
 * It follows the pool by **probing for the listener** rather than by being told.
 * That is deliberate: the question this service answers is "is the pool reachable
 * right now", and a listening socket is the direct evidence of it, where a flag
 * pushed across a language boundary is a claim about it. It also means no bridge
 * from Rust to Kotlin, and no way for the two to disagree.
 *
 * Note what this is *not*: it does not make the process unkillable. Aggressive ROMs
 * still freeze or reap background apps, which is what the per-vendor guidance is
 * for. This gets the process the priority it is entitled to.
 */
class ComputePoolService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var consecutiveMisses = 0

  private val watchdog = object : Runnable {
    override fun run() {
      if (poolIsListening()) {
        consecutiveMisses = 0
      } else {
        consecutiveMisses += 1
        if (consecutiveMisses >= MISSES_BEFORE_STOP) {
          // The pool never came up, or it has been stopped. Either way there is
          // nothing left to keep alive, and a notification for a gateway that is
          // not running is just a lie the user cannot dismiss.
          stopSelf()
          return
        }
      }
      handler.postDelayed(this, PROBE_INTERVAL_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    startForeground(NOTIFICATION_ID, buildNotification())
    consecutiveMisses = 0
    handler.removeCallbacks(watchdog)
    handler.postDelayed(watchdog, PROBE_INTERVAL_MS)
    // Not sticky. "Start it when I need it and put it away after" is how this app
    // is meant to be used, so a process the system had to kill is not brought back
    // behind the user's back.
    return START_NOT_STICKY
  }

  /**
   * Swiping the app away is how the user says they are done. The notification and
   * the process go with it rather than lingering with nothing to show for it.
   */
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    handler.removeCallbacks(watchdog)
    super.onDestroy()
  }

  /**
   * Whether something is already listening on the pool's port.
   *
   * Asks by trying to bind rather than by connecting: a failed bind is exactly
   * "something is already there", and unlike a probe connection it does not show up
   * in the pool's own request log as an aborted request every fifteen seconds.
   *
   * Binding the loopback address catches the LAN case too — a wildcard bind and a
   * loopback bind on the same port conflict in both directions.
   */
  private fun poolIsListening(): Boolean = try {
    ServerSocket().use {
      it.bind(InetSocketAddress(InetAddress.getLoopbackAddress(), poolPort()))
    }
    false
  } catch (_: IOException) {
    true
  }

  /**
   * The port the pool is configured to use, read from the same file the Rust side
   * writes.
   *
   * Read rather than assumed: the port is a user setting, and a service watching
   * the wrong one would decide the pool is down and stop keeping it alive — which is
   * the one failure this service exists to prevent. Re-read on every probe, so a
   * port change is picked up within one interval.
   *
   * The path is `/data/user/0/<package>/ai-switch/web-service.json`. That is worth
   * spelling out because it is not where the documentation implies: Tauri's
   * `app_data_dir()` has a doc comment saying it appends the bundle identifier, but
   * the implementation just calls `getDataDir`, and `PathPlugin.getDataDir` returns
   * `activity.dataDir`. The `ai-switch` segment comes from our own
   * `AppPaths::from_data_dir` call in `mobile.rs`.
   */
  private fun poolPort(): Int {
    for (relative in CONFIG_FILES) {
      val file = File(dataDir, relative)
      if (!file.isFile) {
        continue
      }
      try {
        val port = JSONObject(file.readText()).optInt("port", DEFAULT_PORT)
        // Range-checked here rather than handed straight to `InetSocketAddress`,
        // which throws `IllegalArgumentException` — not `IOException` — for a
        // port outside 0..65535. That exception escapes `poolIsListening`'s
        // catch, so it lands in a `Handler` callback and kills the process, and
        // the watchdog probes every fifteen seconds so it would keep killing it.
        // Port 0 is refused as well: it binds an arbitrary free port, which
        // reads as "the pool is not up" and stops the service after eight
        // probes. An out-of-range value falls through to the next candidate,
        // the same way an unreadable file does.
        if (port in 1..MAX_PORT) {
          return port
        }
      } catch (_: Exception) {
        // Unreadable or not JSON yet — mid-write, or written by an older build.
        // Fall through to the next candidate and then to the default.
      }
    }
    return DEFAULT_PORT
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) {
      return
    }
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.compute_pool_channel_name),
        // Low importance: the pool being up is a state, not an event, and a sound
        // each time the app opens would be its own reason not to open it.
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = getString(R.string.compute_pool_channel_description)
        setShowBadge(false)
      },
    )
  }

  private fun buildNotification(): Notification {
    val openApp = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      },
      PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle(getString(R.string.compute_pool_notification_title))
      .setContentText(getString(R.string.compute_pool_notification_body))
      // The launcher mipmap rather than a dedicated monochrome asset: it always
      // resolves, and `startForeground` throws on an icon it cannot load.
      // Replacing it with a proper status-bar glyph is cosmetic follow-up.
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(openApp)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "compute-pool"
    private const val NOTIFICATION_ID = 1
    private const val PROBE_INTERVAL_MS = 15_000L

    /**
     * ~2 minutes of a pool that is not there before giving up. Long on purpose: the
     * gap between opening the app and starting the gateway is time the user spends
     * configuring it, and a notification that vanished during that would be worse
     * than one that lingers a minute after the pool stops.
     */
    private const val MISSES_BEFORE_STOP = 8

    /**
     * Where the pool's settings live, relative to the app's data directory. Both
     * spellings are tried: release builds write `web-service.json`, debug builds
     * `web-service-dev.json`.
     */
    private val CONFIG_FILES =
      listOf("ai-switch/web-service.json", "ai-switch/web-service-dev.json")

    /** What the pool binds when nothing has configured it yet. */
    private const val DEFAULT_PORT = 19527

    /** The largest port `InetSocketAddress` will accept. */
    private const val MAX_PORT = 65535

    fun start(context: Context) {
      val intent = Intent(context, ComputePoolService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
