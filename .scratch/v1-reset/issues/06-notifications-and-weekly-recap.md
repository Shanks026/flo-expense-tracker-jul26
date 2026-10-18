# Notification cadence and weekly recap

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 02

## Question

What notifications does v1 send, and what is the weekly recap?

The audit proposes two rule-based notifications (no AI):
- one adaptive evening nudge, replacing the twice-daily pushes;
- a Monday "where it went" recap.

Grill:
- How does "adaptive" work? Skip the nudge if the user has already logged today? Learn the time from behaviour?
- Local or server push? send-push has never been verified on a device.
- What's in the recap, and where does it appear? Push plus an in-app screen?
- Bill reminders?
- Quiet hours?
- What does the streak mean for the nudge copy?

Refs: audit §1 P1 notifications/recap, §2 P0 server push, §5 reminder cadence + weekly insight.

## Answer

Grilled with the user on 2026-10-18.

**1. Server push sends every reminder** (`send-push` on the cron). Locally scheduled notifications are retired. The 14 open on-device checks in feature 17 become a must-do in the spec.

**2. Daily nudge:** one evening push, by default at **21:00 local**, sent only if nothing was logged that day. The time can be changed. **The morning push is removed in v1,** not even kept as an opt-in.

**3. Backing off.** "Ignored" means nothing was logged by the next day.
- After **3** ignored nudges in a row, it drops to every other day.
- After **7**, daily nudges stop and only the weekly recap goes out.
- The next log resets it to daily.

**4. Weekly recap:**
- **When:** a push on **Monday 09:00 local**, plus a **Home card for that week**.
- **The screen** is a character moment, so it uses Koban's glasses-and-report pose.
- **Content:**
  - last week's total vs the week before;
  - the top 3 categories with their changes;
  - **one rule-based observation** (for example "Food up 32% vs your 4-week average");
  - the streak.
- **Monthly:** the same template, in-app only, with **no push**.
- It plugs into the moment queue from [02](02-gamification-scope.md).

**5. Reports (feature 11):** the "report ready" push stream and the report cadence settings are removed, replaced by the weekly recap. Where the remaining report screen lives is decided in [05](05-home-ia-and-tabs.md).

**6. Bill reminders stay,** only for bills that exist, 1 day before at 09:00 local by default (`bill_reminder_days_before`).

**7. Settings:** one **Notifications** section with three toggles:
- Daily nudge, with a time picker;
- Weekly recap;
- Bill reminders.

The duplicate "Push notifications" row is removed.

**8. Streak in pushes:**
- The nudge copy may name a streak of 2 days or more.
- Milestone days (7/30/100/365) get their special copy tier.
- **A spent freeze sends no push.** It's the in-app toast only.
- The existing `lib/reminderCopy.js` voice is kept.
