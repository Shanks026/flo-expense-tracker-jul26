# Share-to-FLO import: the fast path from SMS and UPI

Status: ready-for-agent
Source: v1-reset map — [Share-to-FLO import v1 scope](../../.scratch/v1-reset/issues/09-share-import-v1-scope.md)

## Problem Statement

In India nearly every spend creates a bank SMS or a UPI receipt, so typing it again is wasted effort. FLO can already receive shared text, but its parser only pulls out the amount and debit/credit. Category and merchant stay manual, so a share is barely faster than typing. A failed parse dumps the whole SMS, bank details included, into the note. The flow has never been verified on a device. Auto-detect is personal-only and never ships, so share-import is the store-safe "faster than typing" path.

## Solution

**Share a bank SMS or a UPI app's "Paid to X" text into FLO, and the real Add sheet opens pre-filled:**
- amount, expense or income, merchant and date;
- a category FLO **remembers per merchant** from your own past saves.

You always confirm with Save; the second share from the same merchant is one tap. If FLO can't read the message, the sheet opens empty with a quiet note. The raw text is never stored. One coach mark teaches the feature after your first manual log.

## User Stories

1. As a user, I want to long-press a bank SMS and share it to FLO, so that I log it without retyping.
2. As a user, I want to share a GPay, PhonePe or Paytm "Paid to X" receipt to FLO, so that UPI payments log quickly.
3. As a user, I want the amount filled in from the message, so that I don't type it.
4. As a user, I want debit messages to become expenses and credit messages income, so that the type is right.
5. As a user, I want the merchant or payee filled into the note, so that I recognise the entry later.
6. As a user, I want the message's date used when present, so that backdated shares land on the right day.
7. As a user, I want the first share from a merchant to ask me for a category, so that FLO learns my choice.
8. As a user, I want later shares from the same merchant to pre-select that category, so that saving is one tap.
9. As a user, I want to change the pre-selected category and have FLO remember the change, so that its memory follows me.
10. As a user, I want FLO to never save a shared message automatically, so that I stay in control.
11. As a user, I want a small "From SMS" or "From UPI" tag on the sheet, so that I know where the values came from.
12. As a user sharing something FLO can't read, I want an empty Add sheet with "Couldn't read that message", so that I can still log by hand.
13. As a user, I want my message text never stored or sent anywhere, so that my bank details stay private.
14. As a user, I want only the fields I save to become a transaction, so that nothing extra is kept.
15. As a user, I want a warning when the same amount, merchant and date already exists, so that I don't log it twice by accident.
16. As a user, I want to save anyway after that warning, so that genuine repeat purchases still work.
17. As a new user, I want a one-time tip after my first manual log ("Long-press a bank SMS → Share → FLO"), so that I discover the fast path.
18. As a user, I want the tip shown only once, so that it never nags.
19. As a user of the store build, I want share-import with no special permissions, so that FLO never asks to read my SMS.
20. As the person running FLO, I want `share_import {parsed|failed}` and `expense_logged {source: share}` tracked, so that I know the parser's hit rate.

## Implementation Decisions

**Parser (pure, one module, extends the existing SMS parser).** Given shared text, it returns `{ amount, type, merchant?, date? }` or null:
- tuned against real SBI, HDFC, ICICI, Axis and Kotak debit/credit SMS and GPay/PhonePe/Paytm share text;
- **merchant** is extracted from "at X", "to <VPA>" (normalised to the VPA's name part) or "Paid to X";
- **date** comes from common Indian SMS date formats;
- bank account and last-4 digits are ignored;
- input is length-capped as today.

**Merchant memory (new table) `merchant_categories`:**
- columns: `user_id` (`DEFAULT auth.uid()`, cascade), `merchant_key` (normalised lowercase merchant), `category_id` (FK, `ON DELETE CASCADE`), `updated_at`;
- `UNIQUE (user_id, merchant_key)`, owner-only RLS;
- **upserted on Save** of any share-sourced transaction with a merchant.

The lookup is an exact `merchant_key` match. Deterministic, not AI.

**Flow:**
- The share handler (the root layout's share-intent sibling) parses the text, then opens the Add sheet (spec 36) with `{ amount, type, note: merchant, date, categoryId: memory hit, source: 'share' }` and a source tag.
- On a parse failure it opens an empty sheet with the "Couldn't read that message" line.
- **The raw shared text is cleared from memory after parsing and never persisted,** whether to a note, logs or analytics.

**Duplicate check:**
- before Save, query the user's transactions for the same amount, date and note/merchant;
- if found, show an inline "Looks like you already logged this", with Save still enabled.

**Coach mark:**
- after the first manual-source save, show a one-time coach mark (spec 35's overlay, Koban character moment) with the share tip;
- the seen-state is stored locally.

**Dependency:** `expo-share-intent` upgraded to 5.1.1 (spec 32). Registering a `text/plain` share target needs no restricted permission.

**Auto-detect is untouched:** personal-only, never hardened, nothing from it ships in the store build.

## Testing Decisions

- **A good test** shares real messages and checks the pre-filled sheet and the saved row.
- **Seam 1, the emulator** (or a real phone with real messages):
  - share 2–3 real messages from each listed bank and UPI app; check amount, type, merchant and date;
  - first Swiggy share asks for a category, the second pre-selects it;
  - change the category and the memory follows;
  - an unreadable text gives an empty sheet with the note and no raw text anywhere;
  - a duplicate shows the warning and can still be saved;
  - the coach mark shows once after the first manual log;
  - no SMS permission is requested.
- **Seam 2, Supabase via MCP:**
  - `merchant_categories` rows are written per user with RLS (another user can't read them);
  - no transaction note contains raw SMS text;
  - `share_import` events carry no content.
- **Prior art:** feature 03's on-device checklist (Phase 1 and 3 items to tick) and the existing parser's amount/direction rules.

## Out of Scope

- Screenshots and images (OCR).
- Bank-account mapping from last-4 digits.
- Background SMS reading of any kind.
- iOS Share Extension.
- Learning categories from anything other than the user's own saves.

## Further Notes

- Collect a small set of real anonymised sample messages for verification, but **keep real SMS text out of the repo**.
- Measure the parse success rate via `share_import` and extend the bank formats where failures cluster.
