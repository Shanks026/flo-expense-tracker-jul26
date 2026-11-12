# 06: Accounts with last 4

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Accounts as flat rows with each account's colour, its last 4 when set and its in-hand balance, with Edit and Transfer in a ⋯ menu. The account sheet gains an optional "Last 4 digits" field, shown as "•••• 4821" on the Home card, the switcher and the list. This is spec 45 Phase 1, folded in. Spec 48 §Accounts and last 4, §Database (the last4 part).

- **Migration** (apply only with the person's yes; record it in `00-index.md`): `accounts.last4` with the 4-digit check and its comment.
- Pure rules in `lib/`: `cleanLast4`, `maskedLast4`, `accountSub` (description and masked last 4 joined with " · ").
- `OverflowMenu` joins the kit (and the gallery).
- List: `ScreenHeader` + large title; `ListRow` with the colour circle, name, `accountSub`, balance (skeleton, never ₹0), a check on the active one and the ⋯ menu (Edit; Transfer only with 2+ accounts); tap makes it active; `PinnedFooter` New account with the free gate unchanged.
- Account sheet on `Sheet` with the last-4 field (number pad, max 4, digits only, hint, inline error, pre-filled on edit); the account writes take `last4`.
- The switcher sheet and Activity's and Insights' account filter sheets use `accountSub`.
- Before starting: confirm the account context still selects every column. Never send `last4` to the model.

**Blocked by:** None (can start immediately; the migration needs the person's yes first)

**Status:** resolved

- [x] The check script covers blank, "4821", " 48 21 ", "482", "48211", letters, and maskedLast4/accountSub with and without a description
- [x] Migration applied with the person's yes; '12345' and '12a4' rejected, '4821' and null accepted (rolled back)
- [x] Add, edit and clear last 4 through the sheet; 1–3 digits show the error and don't save
- [x] "•••• 4821" shows on the Home card, switcher and Accounts list; accounts without it look as before
- [x] The ⋯ menu's Edit and Transfer work; tapping a row switches the active account
- [x] Emulator check in light and dark (put Personal back as active and clear any test last 4)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments
- 2026-11-12 (resolved): migration `quiet_ledger_money_account_last4` applied on the person's yes (recorded in 00-index.md; '12345'/'12a4' rejected, '4821'/null accepted, rolled back). Built `lib/accountLast4.js`, `OverflowMenu` (kit + gallery), `AccountRow` shared by the Accounts screen and the switcher, the account sheet on `Sheet` with the last-4 field, and `accountSub` in the Activity/Insights account filter. Checked on Pixel_API_36: 3 digits show the error and don't save; 4821 saves and shows on the list, switcher, Activity filter and Home card; clearing removes it (DB null); ⋯ Edit and Transfer work; a row tap switches; light and dark. Personal is active again, no last 4 left, Light. The switcher's ⋯ menu has Edit only (its provider sits outside the Add sheet's, so no Transfer there). The menu sheet uses `stackBehavior="push"`: without it, a menu opened inside the switcher closed both. Mid-ticket, at the person's ask: the Home card's name and last 4 are bigger, in a tint of the card's own colour (`cardTextColor`, 7:1 where it can, never less readable than before) with a soft same-hue shadow (`cardTextShadow`), both checked in the script. Not checked: a dark-text card theme on the device (the script covers its contrast).
