package com.anonymous.flo.detect

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS-facing surface for FLO's transaction auto-detect feature
 * (.claude/features/06-transaction-auto-detect.md). Deliberately thin: the
 * actual capture happens in [FloNotificationListenerService], which the OS
 * runs independently of this module and of the JS runtime. This module only
 * reads/writes the [NotificationPrefs] state the service also reads/writes,
 * and exposes the one-off deep link to Android's notification-access screen
 * — ACTION_NOTIFICATION_LISTENER_SETTINGS cannot be requested like a normal
 * runtime permission; the user must grant it manually in system settings.
 */
class FloNotificationListenerModule : Module() {
  private val context
    get() = appContext.reactContext
      ?: throw IllegalStateException("FloNotificationListener: no context available")

  override fun definition() = ModuleDefinition {
    Name("FloNotificationListener")

    Function("hasNotificationAccess") {
      val flatComponentName = "${context.packageName}/${FloNotificationListenerService::class.java.name}"
      val enabledListeners = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      ) ?: ""
      enabledListeners.split(":").any { it == flatComponentName }
    }

    Function("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    Function("isEnabled") {
      NotificationPrefs.with(context).isEnabled()
    }

    Function("setEnabled") { enabled: Boolean ->
      NotificationPrefs.with(context).setEnabled(enabled)
    }

    Function("getAllowedPackages") {
      NotificationPrefs.with(context).getAllowedPackages().toList()
    }

    Function("setAllowedPackages") { packages: List<String> ->
      NotificationPrefs.with(context).setAllowedPackages(packages)
    }

    // Atomic read-then-clear (see NotificationPrefs.drainQueue) — every
    // detection returned here is removed from native storage in the same
    // call, so a dropped/ignored JS response can never replay it. amount/type
    // are TransactionParser's parsed result (Phase 2); title/text are the
    // raw notification fields, kept alongside for on-device debugging so a
    // parse can be sanity-checked against what the notification actually said.
    Function("drainDetections") {
      val queue = NotificationPrefs.with(context).drainQueue()
      (0 until queue.length()).map { i ->
        val entry = queue.getJSONObject(i)
        mapOf(
          "id" to entry.optString("id"),
          "packageName" to entry.optString("packageName"),
          "amount" to entry.optDouble("amount"),
          "type" to entry.optString("type"),
          "title" to entry.optString("title"),
          "text" to entry.optString("text"),
          "postedAt" to entry.optLong("postedAt")
        )
      }
    }

    // ⚠️ DEBUG ONLY — see NotificationPrefs.recordDebug. Returns every
    // allowlisted notification seen recently AND what the parser made of it,
    // including failures ("no-parse") and dedupe drops ("duplicate") that the
    // normal queue discards silently. Remove before any store build.
    Function("getDebugLog") {
      val log = NotificationPrefs.with(context).getDebugLog()
      (0 until log.length()).map { i ->
        val entry = log.getJSONObject(i)
        mapOf(
          "packageName" to entry.optString("packageName"),
          "title" to entry.optString("title"),
          "text" to entry.optString("text"),
          // optDouble returns NaN when the value is JSONObject.NULL (an
          // unparsed notification) — send null to JS instead, since NaN would
          // silently coerce to a falsy 0-ish value in the UI.
          "amount" to entry.optDouble("amount").takeIf { !it.isNaN() },
          "type" to entry.optString("type").takeIf { it.isNotEmpty() && it != "null" },
          "outcome" to entry.optString("outcome"),
          "at" to entry.optLong("at")
        )
      }
    }

    Function("clearDebugLog") {
      NotificationPrefs.with(context).clearDebugLog()
    }
  }
}
