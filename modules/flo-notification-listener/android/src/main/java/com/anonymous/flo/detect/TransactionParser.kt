package com.anonymous.flo.detect

/**
 * Direct Kotlin port of lib/smsParser.js's heuristics — see that file for
 * the canonical JS version (used by the share-intent SMS-import feature) and
 * 06-transaction-auto-detect.md's "known duplication, accepted deliberately"
 * note: these regexes cannot be shared across the JS/Kotlin boundary, since
 * detection must run natively even when the JS runtime doesn't exist (see
 * that doc's Hard Constraint 1). If you tune one, tune the other.
 *
 * Always returns null rather than a wrong guess — a missed parse just costs
 * the user a manual entry; a wrong parse would be an actual mistake in their
 * ledger. Written against constructed sample text, not real captured
 * bank/UPI notifications — expect a tuning pass once real device data comes
 * in, exactly as lib/smsParser.js itself needed after its own on-device pass
 * (see 03-sms-share-import.md's Phase 2 Implementation Notes).
 */
object TransactionParser {
  data class Parsed(val amount: Double, val type: String) // type: "income" | "expense"

  private const val MAX_INPUT_LENGTH = 2000
  private const val MAX_SANE_AMOUNT = 10_000_000.0 // ₹1 crore — rules out garbage/overflow input

  private val CURRENCY_PATTERN =
    Regex("""(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
  private val BALANCE_CONTEXT_PATTERN =
    Regex("""\b(?:avl\s*bal|available\s*bal(?:ance)?|bal(?:ance)?)\s*:?\s*$""", RegexOption.IGNORE_CASE)
  private val EXPENSE_PATTERN =
    Regex("""\b(?:debited|spent|withdrawn|paid|debit)\b""", RegexOption.IGNORE_CASE)
  private val INCOME_PATTERN =
    Regex("""\b(?:credited|received|deposited|refund(?:ed)?|credit)\b""", RegexOption.IGNORE_CASE)

  fun parse(rawText: String): Parsed? {
    val text = rawText.take(MAX_INPUT_LENGTH)
    val amount = findAmount(text) ?: return null
    val type = findDirection(text) ?: return null
    return Parsed(amount, type)
  }

  private fun findAmount(text: String): Double? {
    for (match in CURRENCY_PATTERN.findAll(text)) {
      // Bank notifications almost always state the transaction amount before
      // any "Avl Bal: Rs.X" mention — skip amounts that look like a balance
      // rather than the transaction itself.
      val start = match.range.first
      val before = text.substring(maxOf(0, start - 25), start)
      if (BALANCE_CONTEXT_PATTERN.containsMatchIn(before)) continue

      val numeric = match.groupValues[1].replace(",", "").toDoubleOrNull() ?: continue
      if (numeric > 0 && numeric <= MAX_SANE_AMOUNT) return numeric
    }
    return null
  }

  private fun findDirection(text: String): String? {
    val expenseIndex = EXPENSE_PATTERN.find(text)?.range?.first ?: -1
    val incomeIndex = INCOME_PATTERN.find(text)?.range?.first ?: -1
    val hasExpense = expenseIndex != -1
    val hasIncome = incomeIndex != -1

    if (!hasExpense && !hasIncome) return null
    if (hasExpense && !hasIncome) return "expense"
    if (hasIncome && !hasExpense) return "income"
    // Both appear (e.g. "...debited... XYZ MERCHANT credited...") — the
    // user's own account action is conventionally stated first.
    return if (expenseIndex <= incomeIndex) "expense" else "income"
  }
}
