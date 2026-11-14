# Forgot password: email code via custom SMTP

Status: ready-for-agent
Source: v1-reset map — [Custom SMTP options for forgot-password](../../.scratch/v1-reset/issues/12-custom-smtp-forgot-password.md) (findings on branch `research/custom-smtp-forgot-password`); supersedes the plan in feature 29

## Problem Statement

A user who signed up with email and forgot their password is stuck. The "Forgot password?" link does nothing, and spec 32 hides it in the safe build. Supabase's built-in email can't be used in production: it sends about 2 emails an hour, only to team addresses. Every real email provider needs a verified sending domain, and FLO has no domain yet. Play's reviewers use an email/password demo account, so email sign-in has to be dependable.

## Solution

**A 6-digit code reset that stays inside the app:**
1. "Forgot password?" → enter email;
2. receive a code by email, sent through **Resend as Supabase's custom SMTP** from a domain FLO registers;
3. type the code and set a new password;
4. sign in.

No deep links. It works even if the email is read on another device, and link-scanning mail filters can't consume a code.

## User Stories

1. As an email user who forgot my password, I want a "Forgot password?" link on sign-in, so that I can recover my account.
2. As that user, I want to enter my email and get a 6-digit code, so that I can prove it's me.
3. As that user, I want the code to arrive quickly in my inbox, not spam, so that recovery is fast.
4. As that user, I want to type the code in FLO rather than tap an email link, so that it works even when I read email on another device.
5. As that user, I want to set a new password right after entering the code, so that recovery is one flow.
6. As that user, I want to be signed out of the temporary recovery session and asked to sign in with my new password, so that the flow is secure and clear.
7. As a user who mistypes the code, I want a clear error and a way to retry, so that I'm not locked out.
8. As a user whose code expired, I want to request a new one, so that I can finish later.
9. As a user, I want the same message whether or not my email has an account, so that FLO doesn't reveal who's registered.
10. As a user, I want resend limited sensibly, so that I can't spam myself or others.
11. As a Google-only user, I want to be told to use Continue with Google if I try a reset, or at least have nothing break, so that I'm not confused.
12. As the person running FLO, I want auth emails (reset and confirmation) sent from FLO's own domain through Resend, so that they deliver reliably in India.
13. As the person running FLO, I want Supabase's auth email rate limit raised above the 30/hour default, so that launch spikes don't block resets.
14. As the person running FLO, I want the reset email to use FLO's voice and show the code clearly, so that it looks trustworthy.

## Implementation Decisions

**Provider setup** (a console task, HITL):
- register a domain (no domain yet; the package id doesn't depend on it);
- add a sending subdomain in Resend with its DNS records (SPF, DKIM, DMARC);
- connect Resend to Supabase as custom SMTP (the first-party integration);
- raise the auth email rate limit;
- edit the **Reset password** template to show `{{ .Token }}` (the 6-digit code) and no link. Supabase only allows template edits after custom SMTP is saved.

**Client flow** (new screens in the auth stack, reached from the sign-in link):
1. **Email entry:** `resetPasswordForEmail(email)`, showing the same neutral confirmation whatever the result.
2. **Code entry:** `verifyOtp({ email, token, type: 'recovery' })`, with clear errors for wrong or expired codes and a resend with a cooldown.
3. **New password:** `updateUser({ password })` with the app's password rules, then `signOut()`, back to sign-in with a "Password updated" note.

**Auth config:**
- implicit flow and `detectSessionInUrl: false` stay as they are; no PKCE or deep-link change is needed for this path;
- the reset link reappears on sign-in (spec 32 hid it) once this ships.

**Copy and voice:** the reset email and screens follow FLO's calm tone.

## Testing Decisions

- **A good test** runs a full reset with a real inbox and checks you can sign in with the new password and not the old one.
- **Seam 1, the emulator:**
  - request a code for the test email account;
  - receive it (inbox, not spam: check Gmail and one Indian provider);
  - enter a wrong code, then an expired code, then the right one;
  - set a new password: sign-in with the old one fails and the new one works;
  - an unknown email gets the same confirmation;
  - resend respects the cooldown.
  - **Confirm `type: 'recovery'` works on the installed auth library version.**
- **Seam 2, Supabase via MCP / dashboard:**
  - the auth logs show sends through custom SMTP;
  - the rate limit is raised;
  - the template contains the token and no link.
- **Prior art:** feature 29's planned flow (this spec replaces it) and the existing sign-in screen.

## Out of Scope

- Magic-link sign-in.
- Phone or SMS OTP.
- Changing Google OAuth or moving to PKCE (that comes with the post-launch anonymous-first work).
- Email-change flows.

## Further Notes

- **Blocked on a domain.** Until one is registered and verified, keep the link hidden (spec 32).
- Resend's free tier caps at 100 emails/day. Watch it around launch; ZeptoMail was the runner-up if that becomes a problem.
- Update feature 29's doc to point here once this spec is built.
