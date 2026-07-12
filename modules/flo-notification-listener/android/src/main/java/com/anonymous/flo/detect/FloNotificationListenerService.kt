package com.anonymous.flo.detect

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest

/**
 * Bound directly by the Android OS via BIND_NOTIFICATION_LISTENER_SERVICE
 * (declared in this module's AndroidManifest.xml) — independent of FLO's
 * Activity or JS runtime. This is deliberate: see
 * 06-transaction-auto-detect.md's "Hard Constraint 1" for why detection
 * cannot live behind a JS event listener (expo-android-notification-listener-
 * service's approach) and must run natively instead. Swiping FLO away from
 * Recents does NOT stop this service — the OS keeps it (re)bound as part of
 * the notification pipeline. Force-stopping via system Settings does revoke
 * it; that is an intentional Android user control this app cannot and should
 * not work around.
 *
 * A notification is queued and prompted only if [TransactionParser] can
 * confidently extract an amount and direction — never on a guess — and is
 * deduped via [NotificationPrefs.isDuplicateAndRecord], since banks commonly
 * post the same alert twice (an app notification and a mirrored update to it).
 */
class FloNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val prefs = NotificationPrefs.with(applicationContext)
    if (!prefs.isEnabled()) return
    if (sbn.packageName !in prefs.getAllowedPackages()) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)
      )?.toString().orEmpty()

    if (title.isBlank() && text.isBlank()) return

    // Some banks put the amount in the title, others in the body — parse
    // both combined rather than guessing which field has it.
    val combined = "$title. $text"
    val parsed = TransactionParser.parse(combined) ?: return

    val dedupeKey = dedupeKeyFor(sbn.packageName, combined)
    if (prefs.isDuplicateAndRecord(dedupeKey, sbn.postTime)) return

    val id = prefs.enqueueDetection(
      packageName = sbn.packageName,
      amount = parsed.amount,
      type = parsed.type,
      title = title,
      text = text,
      postedAt = sbn.postTime
    )

    PromptNotifier.notify(
      applicationContext,
      Detection(id = id, packageName = sbn.packageName, amount = parsed.amount, type = parsed.type)
    )
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    // Nothing to do — a bank notification being dismissed from the shade
    // doesn't change whether we captured/prompted it.
  }

  private fun dedupeKeyFor(packageName: String, text: String): String {
    val normalized = text.trim().lowercase().replace(Regex("\\s+"), " ")
    val digest = MessageDigest.getInstance("SHA-256").digest("$packageName|$normalized".toByteArray())
    return digest.joinToString("") { "%02x".format(it) }
  }
}
