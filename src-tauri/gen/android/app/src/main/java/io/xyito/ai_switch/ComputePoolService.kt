package io.xyito.ai_switch

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * Keeps this process alive while the compute pool is supposed to be reachable.
 *
 * A local gateway is only worth anything if it still answers while the app is in
 * the background, and a foreground service is the only way Android lets an app
 * say "this process is doing something the user asked for". The notification is
 * not a side effect of that — it is the condition, and it doubles as the honest
 * indicator that the pool is up.
 *
 * Note what this is *not*: it does not make the process unkillable. Aggressive
 * ROMs still freeze or reap background apps, which is what the per-vendor
 * guidance exists for. This gets the process the priority it is entitled to.
 */
class ComputePoolService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    startForeground(NOTIFICATION_ID, buildNotification())
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
