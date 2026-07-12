package com.anonymous.flo.detect

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles the "Not mine" action on a detected-transaction prompt. Removes
 * the entry from the pending queue and cancels the system notification —
 * and, deliberately, does NOT open the app. A dismissal that forces the app
 * open is not a dismissal (see 06-transaction-auto-detect.md Phase 2).
 */
class DismissDetectionReceiver : BroadcastReceiver() {
  companion object {
    const val EXTRA_DETECTION_ID = "detectionId"
    const val EXTRA_NOTIFICATION_ID = "notificationId"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val detectionId = intent.getStringExtra(EXTRA_DETECTION_ID) ?: return
    NotificationPrefs.with(context).removeDetection(detectionId)

    val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(notificationId)
  }
}
