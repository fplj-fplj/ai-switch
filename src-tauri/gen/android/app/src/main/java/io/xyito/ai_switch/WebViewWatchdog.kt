package io.xyito.ai_switch

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import java.io.File
import java.lang.ref.WeakReference
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Asks the WebView, from outside it, whether it is still answering.
 *
 * A blank screen that cannot be accounted for has one question at its centre: was the
 * page still running? The page cannot answer it. A renderer the system takes away is
 * not given the chance to write anything down, and neither is a compositor that stops
 * producing frames — the code that would have recorded it is the code that stopped.
 *
 * So the question is asked from here instead, by running a trivial script every few
 * seconds. The reply arrives as a callback on this same looper, which is what makes a
 * missing reply meaningful: it does not mean "busy", it means nothing on the other
 * side executed the script at all.
 *
 * Deliberately not `WebViewClient.onRenderProcessGone`. That hook is narrower — it
 * covers a renderer that died and nothing else — and reaching it means replacing the
 * client that `Ipc` holds for `currentUrl`, the value Rust is given on every IPC call.
 * Breaking that breaks the app's only channel to Rust, which is too much to risk on
 * the instrument that is supposed to be measuring the fault.
 *
 * Probing happens only while the activity is in front of the user. Android freezes a
 * backgrounded renderer, so asking then would always time out and the log would fill
 * with the app simply not being on screen.
 */
object WebViewWatchdog {
  /** How long to wait for the reply to a single probe. */
  private const val REPLY_DEADLINE_MS = 3_000L
  /** How long to wait before asking again. */
  private const val PROBE_INTERVAL_MS = 4_000L
  /** Misses in a row before the renderer is called gone, not merely slow. */
  private const val MISSES_BEFORE_GONE = 3
  private const val LOG_NAME = "render-process-gone.log"
  private const val PROBE = "1"

  private val handler = Handler(Looper.getMainLooper())
  // Held weakly: the watchdog outlives any one activity, and a rotation must not be
  // the reason the activity cannot be collected.
  private var activity: WeakReference<Activity>? = null
  private var target: WebView? = null
  private var watching = false
  private var replied = false
  private var misses = 0

  // Functions rather than values, and typed explicitly, because this pair schedules
  // each other: a value cannot read itself while it is being initialised, and neither
  // can be inferred from the other. A function body is not part of the initialiser,
  // so both problems go away together.
  private fun ask(): Runnable = Runnable {
    if (!watching) {
      return@Runnable
    }
    val view = target ?: resolveTarget()?.also { target = it }
    if (view == null) {
      // Not created yet, or replaced. Nothing to ask this round.
      handler.postDelayed(ask(), PROBE_INTERVAL_MS)
      return@Runnable
    }

    replied = false
    try {
      view.evaluateJavascript(PROBE) { replied = true }
    } catch (_: Exception) {
      // A WebView that cannot even be asked has already told us what we wanted to
      // know; the miss is counted below like any other.
    }

    handler.postDelayed(judge(view), REPLY_DEADLINE_MS)
  }

  private fun judge(view: WebView): Runnable = Runnable {
    if (!watching) {
      return@Runnable
    }
    if (replied) {
      misses = 0
    } else {
      misses += 1
      if (misses >= MISSES_BEFORE_GONE) {
        misses = 0
        record()
        // A page that is not answering is already unusable, so there is no unsaved
        // work here to protect — and reloading is the one thing that may bring the
        // renderer back without destroying the activity around it.
        try {
          view.reload()
        } catch (_: Exception) {
          // Left blank; the record is what this class is for.
        }
      }
    }
    handler.postDelayed(ask(), PROBE_INTERVAL_MS)
  }

  /** Begins watching. Called when the activity comes to the front. */
  fun start(host: Activity) {
    activity = WeakReference(host)
    if (watching) {
      return
    }
    watching = true
    misses = 0
    handler.post(ask())
  }

  /** Stops watching. Called when the activity leaves the front. */
  fun stop() {
    watching = false
    target = null
    misses = 0
    handler.removeCallbacksAndMessages(null)
  }

  /**
   * Reads what has been recorded so far and clears it.
   *
   * Cleared on read because the caller reports it once: leaving it would have every
   * later launch re-report the same death as if it had just happened.
   */
  fun drain(context: Context): String {
    val file = File(context.filesDir, LOG_NAME)
    if (!file.exists()) {
      return ""
    }
    val contents = try {
      file.readText()
    } catch (_: Exception) {
      return ""
    }
    file.delete()
    return contents
  }

  private fun record() {
    val host = activity?.get() ?: return
    val stamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(Date())
    try {
      File(host.filesDir, LOG_NAME).appendText("$stamp\n")
    } catch (_: Exception) {
      // Losing the note is not worth a second failure on top of the first.
    }
  }

  private fun resolveTarget(): WebView? = findWebView(activity?.get()?.window?.decorView)

  /** `WebView` is itself a `ViewGroup`, so it has to be tested for first. */
  private fun findWebView(view: View?): WebView? {
    if (view == null) {
      return null
    }
    if (view is WebView) {
      return view
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(index))
        if (found != null) {
          return found
        }
      }
    }
    return null
  }
}
