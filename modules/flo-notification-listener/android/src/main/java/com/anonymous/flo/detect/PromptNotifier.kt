package com.anonymous.flo.detect

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

private const val CHANNEL_ID = "flo.txn.detected"
private const val CHANNEL_NAME = "Detected transactions"

/**
 * Posts FLO's own heads-up "log it?" prompt directly via NotificationManager
 * — deliberately NOT via expo-notifications, which needs a live JS runtime
 * to schedule through. This whole module exists specifically because the JS
 * runtime may not be alive when a bank notification arrives (see
 * 06-transaction-auto-detect.md's Hard Constraint 1) — the same reasoning
 * extends to the prompt itself.
 *
 * Known cosmetic limitation: uses the app's launcher icon
 * (`applicationInfo.icon`) as the status-bar icon rather than a dedicated
 * monochrome notification icon, since none exists in this repo yet. Android
 * commonly renders a full-colour launcher icon as a flat silhouette in the
 * status bar — the same "white blob" problem 05-koban-engagement.md Phase 3
 * already documents for expo-notifications, and the eventual fix (a proper
 * white-on-transparent icon asset) would apply equally here.
 */
object PromptNotifier {
  fun notify(context: Context, detection: Detection) {
    ensureChannel(context)

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val notificationId = detection.id.hashCode()

    val title = if (detection.type == "income") {
      "₹${formatAmount(detection.amount)} credited — log it?"
    } else {
      "₹${formatAmount(detection.amount)} debited — log it?"
    }

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentPendingIntent = PendingIntent.getActivity(
      context,
      notificationId,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val dismissIntent = Intent(context, DismissDetectionReceiver::class.java).apply {
      putExtra(DismissDetectionReceiver.EXTRA_DETECTION_ID, detection.id)
      putExtra(DismissDetectionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
    }
    val dismissPendingIntent = PendingIntent.getBroadcast(
      context,
      notificationId,
      dismissIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    val notification = builder
      .setContentTitle(title)
      .setContentText("${sourceLabel(context, detection.packageName)} · tap to review")
      .setSmallIcon(context.applicationInfo.icon)
      .setAutoCancel(true)
      .setPriority(Notification.PRIORITY_HIGH)
      .setContentIntent(contentPendingIntent)
      .addAction(0, "Log it", contentPendingIntent)
      .addAction(0, "Not mine", dismissPendingIntent)
      .build()

    manager.notify(notificationId, notification)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH)
    )
  }

  private fun sourceLabel(context: Context, packageName: String): String {
    return try {
      val pm = context.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
    } catch (e: Exception) {
      packageName
    }
  }

  // Matches FLO's app-wide money formatting convention exactly
  // (₹${Math.round(n).toLocaleString('en-IN')} on the JS side): whole
  // rupees, Indian lakh/crore digit grouping (12,34,567), not the
  // thousands-grouping "%,d" would produce (1,234,567). Locale("en", "IN")
  // is ICU-backed on Android and groups correctly.
  private fun formatAmount(amount: Double): String {
    val rounded = Math.round(amount)
    val formatter = java.text.NumberFormat.getIntegerInstance(java.util.Locale("en", "IN"))
    return formatter.format(rounded)
  }
}
