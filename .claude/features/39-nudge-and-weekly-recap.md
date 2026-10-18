# Notifications: one evening nudge and the weekly recap

Status: ready-for-agent
Source: v1-reset map — [Notification cadence and weekly recap](../../.scratch/v1-reset/issues/06-notifications-and-weekly-recap.md)

## Problem Statement

`send-push` runs every 15 minutes and sends **four streams**:
- an **unconditional morning push** every day;
- an evening push if nothing is logged;
- bill pushes;
- report-ready pushes.

Two pushes a day to a disengaged user gets notifications switched off or the app uninstalled, and push is the channel D7 and D30 depend on. 14 on-device checks of the push pipeline are still open. Settings shows both "Notifications" and "Push notifications". Reports are a chore nobody opens, rather than a reason to come back.

## Solution

**One daily nudge:**
- 21:00 local by default, user-adjustable;
- sent **only on days with nothing logged and no no-spend mark**;
- backs off when ignored: every other day after 3 ignored nudges, weekly recap only after 7, back to daily on the next log.
- **No morning push.**

**The weekly recap:** a rule-based summary of last week, delivered as a **Monday 09:00 push** plus a **Home card** for that week. A monthly version is in-app only.

**Bill reminders stay,** only for bills that exist. The report-ready stream is removed.

**Settings:** one Notifications section with three toggles.

**Delivery:** server push only, with the pipeline's on-device checks finished.

## User Stories

1. As a user, I want at most one reminder a day, so that FLO never nags.
2. As a user, I want the reminder only on days I haven't logged, so that it's never pointless.
3. As a user who marked "No spend today", I want no reminder that evening, so that FLO trusts me.
4. As a user, I want the reminder at 9 pm by default and the time adjustable, so that it fits my day.
5. As a user who ignores reminders, I want them to back off to every other day, then stop except for the weekly recap, so that I'm not pushed away.
6. As a user coming back after a break, I want daily reminders to resume when I log again, so that the habit restarts naturally.
7. As a user with a streak, I want the reminder to mention it ("Keep your 6-day streak going"), so that I have a reason to log.
8. As a user on a milestone day, I want special reminder copy, so that the moment feels earned.
9. As a user whose streak was saved by a freeze, I want no push about it, only the in-app toast, so that I'm not notified about nothing.
10. As a user, I want no morning push, so that FLO isn't the first thing nagging me each day.
11. As a user, I want a Monday-morning recap: last week's total vs the week before, top 3 categories with changes, one plain observation, and my streak, so that I learn where my money went.
12. As a user, I want the recap observation to be rule-based and factual (e.g. "Food up 32% vs your 4-week average"), so that it's trustworthy.
13. As a user, I want the recap as a Home card all week, so that I can come back to it.
14. As a user, I want the recap screen to feature Koban with his glasses and report, so that it feels like a little moment, not a chore.
15. As a user, I want a monthly recap in-app with no push, so that I can review the month without extra notifications.
16. As a user with bills, I want a reminder 1 day before each is due, at 9 am, so that I don't miss payments.
17. As a user without bills, I want no bill reminders, so that I'm never notified about nothing.
18. As a user, I want one Notifications section in Settings with Daily nudge (with a time), Weekly recap and Bill reminders toggles, so that controls are clear.
19. As a user, I want tapping the nudge to open the Add sheet, so that logging is one tap from the notification.
20. As a user, I want reminders at my local time even if I travel, so that 9 pm means my 9 pm.
21. As the person running FLO, I want no leftover locally scheduled notifications, so that users never get stale duplicates.
22. As the person running FLO, I want `nudge_opened` and `recap_viewed` tracked, so that I can measure nudge → log conversion and recap engagement.

## Implementation Decisions

**Server (the `send-push` Edge Function on its existing pg_cron schedule):**
- **Remove** the `morning` trigger and the `report_ready` trigger.
- **Evening nudge:**
  - sent at the profile's reminder time, local via `profiles.timezone`;
  - skipped if a transaction was created today, **or a `no_spend` mark exists** for today (spec 34's `streak_marks`);
  - claimed in `reminder_sends` as today.
- **Back-off,** computed from `reminder_sends` and logging history:
  - count consecutive sent nudges each followed by a day with no log or no-spend mark (an "ignored" nudge);
  - with 3–6 ignored, send only on alternate days;
  - with ≥7 ignored, send no nudge;
  - any log or no-spend mark resets the count.
- **Weekly recap:**
  - trigger `weekly_recap`, Monday 09:00 local;
  - sent to users with the recap enabled who logged at least once in the previous week;
  - claimed per ISO week.
- **Bill due:** unchanged mechanics, defaulting to 1 day before at 09:00 local, active bills only.
- **Copy:** the existing reminder-copy voice. The streak count is named at ≥2, with a milestone tier at 7/30/100/365.

**Profile settings:**
- `reminders_enabled` and `evening_reminder_time` stay (the daily nudge);
- **new** `weekly_recap_enabled` (default true);
- the bill toggle and days-before stay;
- `morning_reminder_time` and the report cadence columns are ignored, not dropped.

**Recap content (pure, one module, shared by the Home card, recap screen and push copy):** for a closed week (Mon–Sun, local):
- total spent vs the previous week;
- the top 3 categories with deltas;
- **one observation** chosen by fixed rules in priority order:
  1. the largest category increase vs its 4-week average above a threshold;
  2. otherwise the biggest decrease;
  3. otherwise "steady week";
- the streak at week end.

Monthly uses the same module for a calendar month.

**Recap screen:**
- a route with Koban in the glasses-and-report prop pose (spec 37);
- opened from the push, the Home card (spec 38) or Insights;
- it's a character moment and plugs into the moment queue only via the Home card, not as a takeover.

**Client:**
- remove all locally scheduled nudge, report and bill notifications on upgrade;
- tapping a nudge opens the Add sheet;
- a recap push opens the recap screen;
- the Settings Notifications section (three toggles plus a time picker) replaces both old rows.

**Analytics:** `nudge_opened {type}` and `recap_viewed` (spec 33).

## Testing Decisions

- **A good test** checks which notifications a real user receives, when, and what tapping them does.
- **Seam 1, the emulator** (release build, push token registered):
  - nothing logged by the nudge time: the push arrives at the local time, and tapping it opens the Add sheet;
  - log before then, or mark no-spend: no push;
  - change the device timezone: it follows local time;
  - weekly recap push on Monday 09:00 opens the recap screen;
  - the Home card shows all week;
  - a bill due tomorrow gets a 09:00 push, and no bills means no pushes;
  - Settings shows exactly the 3 toggles;
  - no leftover local notifications after upgrade;
  - complete feature 17's 14 open on-device checks.
- **Seam 2, Supabase via MCP:**
  - seed `reminder_sends` and history to simulate 3 and 7 ignored nudges, then invoke `send-push` and confirm alternate-day sending and silence;
  - log, invoke again, and confirm daily sending resumes;
  - confirm no `morning_nudge` or `report_ready` claims are written;
  - check the recap module's numbers against seeded transactions.
- **Prior art:** feature 17's phases and checklist; the `send-push` claim pattern (`reminder_sends` unique per user, trigger and ref).

## Out of Scope

- A morning push in any form.
- Push for spent freezes.
- Quiet hours (unnecessary at this cadence).
- Smart send-time learning.
- Report PDF.
- iOS.

## Further Notes

- Local notifications are best-effort on OEM skins (standing rule). Server push avoids most of that. The battery-optimisation hint in Settings stays useful.
- **Keep `send-push` the only cron-driven push function.** The recap is a new trigger inside it, not a new function.
