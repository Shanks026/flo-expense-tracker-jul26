# Custom SMTP options for forgot-password

Map: [../map.md](../map.md)
Type: research
Labels: wayfinder:research
Status: resolved
Blocked by: 

## Question

Which SMTP provider should send FLO's auth emails (password reset, confirmation), so "Forgot password?" works in production?

Compare Resend, Amazon SES, Brevo, Postmark and ZeptoMail (India) on:
- Supabase custom SMTP support;
- free tier and price at early scale;
- deliverability to Gmail and Indian inboxes;
- domain and DNS needs (FLO may not own a domain yet);
- setup effort.

Also find out how the reset deep link returns into the Expo app.

Refs: audit §2 P0 Forgot password.

## Answer

**Provider: Resend as Supabase custom SMTP.** It sends from a subdomain of a cheap domain FLO registers (about $10 a year). Every provider needs a verified sending domain, so registering one is a HITL step.
- **Runner-up:** ZeptoMail, if Resend's 100-a-day free cap bites.
- **Before launch:** raise Supabase's auth email rate limit from the 30-an-hour default that applies once custom SMTP is on.

**Reset flow: a 6-digit OTP code typed in the app.** This is doc 29's plan:
1. `resetPasswordForEmail`
2. The email shows `{{ .Token }}`.
3. `verifyOtp({ type: 'recovery' })`
4. `updateUser`
5. `signOut`

There is no deep link and no PKCE. FLO runs the implicit flow with `detectSessionInUrl: false` because there's no WebCrypto, and a code survives cross-device reading and link scanners. No reset code exists today: `app/sign-in.js:242` is a dead `Pressable`.

**Open risks:**
- the 100-a-day cap during a spike;
- India inbox placement is unmeasured;
- `type: 'recovery'` still needs an emulator check.

Findings: branch `research/custom-smtp-forgot-password`, `research/custom-smtp-forgot-password.md` (commit 8c55b83).
