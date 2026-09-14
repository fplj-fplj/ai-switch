package io.xyito.ai_switch

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    requestNotificationPermissionIfNeeded()
    // The pool is meant to keep answering while this app is in the background, and
    // a foreground service is the only way Android permits that. It is started here
    // and stopped when the task is removed. Tying it to the gateway's own state
    // instead of to the activity needs a bridge from Rust, and comes next.
    ComputePoolService.start(this)
  }

  /**
   * The watchdog asks the WebView whether it is still answering, and only while this
   * activity is in front of the user: a backgrounded renderer is frozen by the
   * system, so probing then would time out every round and record a death that never
   * happened.
   */
  override fun onResume() {
    super.onResume()
    WebViewWatchdog.start(this)
  }

  override fun onPause() {
    WebViewWatchdog.stop()
    super.onPause()
  }

  /**
   * Android 13 and up hide notifications until the user grants this. Without it the
   * foreground service runs with nothing on screen — confusing for the user, and it
   * defeats the reason the notification exists.
   */
  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return
    }
    val granted =
      checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    if (granted) {
      return
    }
    requestPermissions(
      arrayOf(Manifest.permission.POST_NOTIFICATIONS),
      NOTIFICATION_PERMISSION_REQUEST,
    )
  }

  private companion object {
    const val NOTIFICATION_PERMISSION_REQUEST = 1001
  }
}
