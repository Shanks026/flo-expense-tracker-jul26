# Share-to-FLO import v1 scope (SMS/UPI fast path)

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

What does share-to-FLO import do in v1?

The audit names it the "faster than typing" path on Android: share a bank SMS or UPI receipt into FLO and land in a pre-filled Add sheet.

Grill:
- Which sources are supported at launch?
- What gets parsed: amount, merchant, date, type?
- What happens when parsing fails?
- Does import appear in onboarding?
- How does it stay clear of auto-detect, which is personal-only and never shipped?

Known constraint: the expo-share-intent 5.1.1 upgrade.

Refs: audit §1 P1 share-to-FLO, §5 P1 share import, §6 dependency hygiene.

## Answer

Grilled with the user on 2026-10-18.

**1. Sources: text only.**
- **Bank SMS:** one generic parser, tuned on real SBI, HDFC, ICICI, Axis and Kotak messages.
- **UPI receipts:** GPay, PhonePe and Paytm "Paid to X" text shares.

No screenshots or images; that would need OCR, too close to the AI line.

**2. Parsed fields:**
- amount;
- direction: debit becomes an expense, credit becomes income;
- **merchant or payee:** "at X", a VPA, or "Paid to X". It goes into the note and drives the category;
- **date:** from the message, otherwise today.

The bank account or last 4 digits are ignored in v1; the entry goes to the active account.

**3. Merchant → category memory:** a new per-user table, protected by row-level security, learned only from the user's own saves. It's an exact merchant match, deterministic, not AI. From the second share of the same merchant on, saving is one tap.

**4. Flow:** a share opens the **real Add sheet, pre-filled** ([18](18-add-sheet-speed-design.md)), with a "From SMS" or "From UPI" tag. **It never auto-saves.**

**5. Parse failure:** the Add sheet opens empty with the amount focused and a quiet "Couldn't read that message" line. **The raw SMS is no longer dumped into the note.**

**6. Discovery:**
- not in onboarding;
- **one coach mark after the first manual log**: "Tip: long-press a bank SMS → Share → FLO";
- it's a Koban character moment and shows once.

**7. Privacy:**
- **the shared text is never stored or sent anywhere;**
- only the fields the user saves become a transaction;
- analytics never see message content.

**8. Duplicates:** the same amount, merchant and date as an existing entry shows "Looks like you already logged this". The user can still save.

**Constraints carried into the spec:**
- the `expo-share-intent` 5.1.1 upgrade;
- finishing feature 03's on-device checks;
- auto-detect stays personal-only; nothing from it ships in the lite build.
