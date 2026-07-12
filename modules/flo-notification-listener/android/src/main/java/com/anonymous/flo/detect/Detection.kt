package com.anonymous.flo.detect

/**
 * In-memory shape passed from [FloNotificationListenerService] to
 * [PromptNotifier] when posting a prompt. Not the same as the queue's JSON
 * persistence format (see [NotificationPrefs.enqueueDetection]) — this is
 * just what a single notify() call needs.
 */
data class Detection(
  val id: String,
  val packageName: String,
  val amount: Double,
  val type: String, // "income" | "expense"
)
