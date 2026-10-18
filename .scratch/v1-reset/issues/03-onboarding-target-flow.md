# Onboarding target flow: 4-screen Google-first, anonymous-first?

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 02, 11

## Question

What is v1 onboarding, screen by screen?

The audit proposes 4 screens: opener → Google → first expense in the real Add sheet → reminder opt-in. Balance, budget and currency are deferred.

Grill:
- Is Google the only sign-up in v1, or is email/password kept?
- Does v1 go anonymous-first, with Google linked later? This depends on research 11.
- What does the opener say and show?
- What happens to users who have already onboarded?
- Which of the ~32 current screens are deleted, and which are put behind a flag?

Refs: audit §5 Onboarding, §1 P0/P1 sign-up.

## Answer

Grilled with the user on 2026-10-18.

**1. Google-first for v1.** Anonymous-first goes to the post-launch backlog and is revisited only if analytics show the sign-up step is the drop-off. Research [11](11-anonymous-auth-google-linking.md) stays as the reference for when it comes back.

**2. Email/password stays,** behind "Other options". Play's reviewer demo account needs it, and the reset uses the OTP code from [12](12-custom-smtp-forgot-password.md).

**3. The target flow is 4 screens:**
1. **Opener:** one line of value, Continue with Google, and "Other options / I have an account".
2. **Google account picker.**
3. **First expense,** in the real Add sheet.
4. **Saved, then a reminder ask:** "Want a 9 pm nudge?" with Turn on / Not now. Turn on triggers the OS permission prompt.

Then Home.

Defaulted, never asked:
- account "Personal";
- preset categories, seeded silently;
- weekly report on.

Asked later, in context:
- budget suggested after 14 days of real data;
- bills, Plans and Splits on first visit.

The 10-card tour is replaced by 1–2 Home coach marks: the + button, then the streak after the first log. This ticket fixes structure only. The opener's look and Koban's role belong to [04](04-design-language-direction.md) and [16](16-mascot-vector-prototype.md). Currency follows [07](07-v1-scope-plans-splits-currency.md). Where analytics consent is asked follows [17](17-analytics-event-plan-and-consent.md). Reminder timing and copy follow [06](06-notifications-and-weekly-recap.md).

**4. The first expense is skippable.** A small "Not now" goes to Home, and the + coach mark picks the user up there. No fake expense is forced.

**5. Existing users:** anyone with `onboarded_at` set never sees the new flow, including the main personal account. Accounts stuck mid-onboarding restart in the new flow.

**6. Cut screens are deleted, not flagged.** Onboarding screens are flow, not features. The screens deleted are:
- the intro screens problem, solution, name, age, income, goal, leak, habit and reflection;
- the setup screens account, currency, categories, balance, budget, reports and journey;
- the tour, the welcome bundle and done;
- the forked `onboarding/expense.js`.

Profile columns such as `age_range` and income stay. Git history keeps the code. This supersedes the July deferral ("trim onboarding only after feature 28 ships").
