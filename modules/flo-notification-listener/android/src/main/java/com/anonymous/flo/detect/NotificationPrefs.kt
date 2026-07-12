package com.anonymous.flo.detect

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

private const val PREFS_NAME = "flo_detect_prefs"
private const val KEY_ENABLED = "enabled"
private const val KEY_ALLOWED_PACKAGES = "allowed_packages"
private const val KEY_QUEUE = "queue"
private const val KEY_DEDUPE = "dedupe_keys"
private const val MAX_QUEUE_SIZE = 20
private const val DEDUPE_WINDOW_MS = 5 * 60 * 1000L

/**
 * Shared between [FloNotificationListenerModule] (the JS bridge, alive only
 * while the app process/JS runtime is) and [FloNotificationListenerService]
 * (rebound by the OS independent of the app's Activity or JS runtime — see
 * 06-transaction-auto-detect.md's "Hard Constraint 1"). SharedPreferences is
 * the simplest storage both can read/write without a live JS bridge, and it
 * survives the app process being killed and restarted, which is the entire
 * reason this module exists as native code rather than a JS event listener.
 */
class NotificationPrefs private constructor(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  companion object {
    @Volatile private var instance: NotificationPrefs? = null

    fun with(context: Context): NotificationPrefs =
      instance ?: synchronized(this) {
        instance ?: NotificationPrefs(context).also { instance = it }
      }
  }

  @Synchronized
  fun isEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

  @Synchronized
  fun setEnabled(enabled: Boolean) {
    prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  @Synchronized
  fun getAllowedPackages(): Set<String> {
    val raw = prefs.getString(KEY_ALLOWED_PACKAGES, null) ?: return emptySet()
    val array = JSONArray(raw)
    return (0 until array.length()).map { array.getString(it) }.toSet()
  }

  @Synchronized
  fun setAllowedPackages(packages: List<String>) {
    val array = JSONArray()
    packages.forEach { array.put(it) }
    prefs.edit().putString(KEY_ALLOWED_PACKAGES, array.toString()).apply()
  }

  /**
   * Enqueues a parsed detection and returns its generated [id] — needed by
   * the caller (the Service) to also tag the prompt notification and its
   * "Not mine" dismiss action, so dismissing the notification can remove
   * this exact entry via [removeDetection].
   */
  @Synchronized
  fun enqueueDetection(
    packageName: String,
    amount: Double,
    type: String,
    title: String,
    text: String,
    postedAt: Long,
  ): String {
    val id = UUID.randomUUID().toString()
    val queue = readQueue()
    val entry = JSONObject().apply {
      put("id", id)
      put("packageName", packageName)
      put("amount", amount)
      put("type", type)
      put("title", title)
      put("text", text)
      put("postedAt", postedAt)
    }
    queue.put(entry)

    // This is a live pending-review queue, not a log: cap at MAX_QUEUE_SIZE,
    // dropping the OLDEST entries. If it ever fills up, the oldest unreviewed
    // detections are the least useful ones to keep around.
    val trimmed = JSONArray()
    val start = maxOf(0, queue.length() - MAX_QUEUE_SIZE)
    for (i in start until queue.length()) trimmed.put(queue.get(i))
    prefs.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
    return id
  }

  /** Atomic read-then-clear so JS never drains the same detection twice. */
  @Synchronized
  fun drainQueue(): JSONArray {
    val queue = readQueue()
    prefs.edit().remove(KEY_QUEUE).apply()
    return queue
  }

  /** Used by the "Not mine" dismiss action — removes one entry without touching the rest. */
  @Synchronized
  fun removeDetection(id: String) {
    val queue = readQueue()
    val kept = JSONArray()
    for (i in 0 until queue.length()) {
      val entry = queue.getJSONObject(i)
      if (entry.optString("id") != id) kept.put(entry)
    }
    prefs.edit().putString(KEY_QUEUE, kept.toString()).apply()
  }

  private fun readQueue(): JSONArray {
    val raw = prefs.getString(KEY_QUEUE, null) ?: return JSONArray()
    return JSONArray(raw)
  }

  /**
   * Banks often post the same alert twice (app + a mirrored update to the
   * same notification) — checks whether [key] was recorded within the last
   * [DEDUPE_WINDOW_MS], and if not, records it now. Expired keys are pruned
   * on every call rather than on a timer, since this only ever runs from
   * [FloNotificationListenerService.onNotificationPosted], which is already
   * the only place that needs pruning to happen.
   */
  @Synchronized
  fun isDuplicateAndRecord(key: String, now: Long): Boolean {
    val raw = prefs.getString(KEY_DEDUPE, null)
    val existing = if (raw != null) JSONArray(raw) else JSONArray()
    val kept = JSONArray()
    var isDuplicate = false
    for (i in 0 until existing.length()) {
      val entry = existing.getJSONObject(i)
      if (now - entry.optLong("ts") > DEDUPE_WINDOW_MS) continue // expired, drop
      kept.put(entry)
      if (entry.optString("key") == key) isDuplicate = true
    }
    if (!isDuplicate) {
      kept.put(JSONObject().apply {
        put("key", key)
        put("ts", now)
      })
    }
    prefs.edit().putString(KEY_DEDUPE, kept.toString()).apply()
    return isDuplicate
  }
}
