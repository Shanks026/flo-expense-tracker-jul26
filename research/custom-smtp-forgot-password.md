# Custom SMTP for "Forgot password?"

Research note for wayfinder ticket 12 (`v1-reset`). Researched 2026-10-18.
Context: `docs/flo-pre-launch-audit-2026-10.md` §2, "[P0] Forgot password? is a dead button", and `.claude/features/29-forgot-password.md` (planned, blocked on custom SMTP).

## Question

Which SMTP provider should send FLO's Supabase Auth emails (password reset, sign-up confirmation) so that "Forgot password?" works in production? How should the reset get back into the Expo app on Android: a deep link, PKCE `exchangeCodeForSession`, or a typed OTP code?

## Recommendation

Use **Resend** as Supabase's custom SMTP, sending from a subdomain of a cheap domain that FLO registers for this purpose (for example `auth.<flo-domain>`, about US$10/yr at cost through Cloudflare Registrar). Resend's free tier (3,000 emails/month, 100/day) covers early scale. It has a first-party Supabase integration that fills in the SMTP settings for you, and its DNS setup is the lightest of the five providers. Then **raise Supabase's email rate limit** from the 30/hour that applies once custom SMTP is on.

For the reset itself, keep doc 29's plan: a **6-digit OTP code typed in the app**. The flow is `resetPasswordForEmail(email)`, then the email shows `{{ .Token }}`, then `verifyOtp({ email, token, type: 'recovery' })`, then `updateUser({ password })`, then `signOut()`. No deep link and no PKCE. This is the most robust choice on Android for three reasons:

- FLO deliberately runs the implicit flow with `detectSessionInUrl: false`, because PKCE degrades to `plain` without WebCrypto (see `lib/supabase.js`).
- A code works even when the email is opened on another device.
- Link-scanning mail filters cannot consume a code.

**ZeptoMail** is the runner-up. It is Zoho's, it is pay-as-you-go at about US$2.50 per 10,000 emails, and its first 10,000 emails are free. Pick it if the 100/day free cap or Resend's US$20 jump becomes a problem.

## Existing code

- `app/sign-in.js:242`: `<Pressable style={styles.forgotRow}>` has no `onPress`. This is the dead button.
- There is no `resetPasswordForEmail`, `verifyOtp` or `updateUser({ password })` call anywhere in `app/`, `lib/`, `hooks/` or `components/`.
- `lib/supabase.js:69-83`: `detectSessionInUrl: false` and the implicit flow are on purpose. PKCE was reverted on 2026-07-22 because `crypto.subtle` is missing in React Native, so the challenge fell back to `plain`.
- `lib/AuthContext.js:131-155`: the Google OAuth return already handles both hash tokens (`setSession`) and `?code=` (`exchangeCodeForSession`). So deep-link parsing exists, but only for OAuth.
- `app.json` declares the `"scheme": "flo"`. `expo-linking` and `expo-auth-session` are installed.
- In the installed `@supabase/auth-js` 2.110.2, `EmailOtpType` includes `'recovery'` (`node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:693`). So `verifyOtp({ email, token, type: 'recovery' })` is a typed, supported call.
- `.claude/features/29-forgot-password.md` records (2026-07-26) that on the default email service the Reset Password template is read-only ("Set up custom SMTP to edit templates") and sends only a link. The `{{ .Token }}` code therefore depends on custom SMTP.

## Comparison

Prices are list prices in USD as of 2026-10.

| | **Resend** | **Amazon SES** | **Brevo** | **Postmark** | **ZeptoMail** |
|---|---|---|---|---|---|
| Named by Supabase as an SMTP option | Yes | Yes | Yes | Yes | Yes |
| Supabase setup | One-click integration, or SMTP `smtp.resend.com:465`, user `resend`, password = API key | Manual SMTP credentials (IAM-derived) | Manual SMTP | Manual SMTP | Manual SMTP |
| Free tier | 3,000/mo, 100/day, 3 domains, no expiry | No permanent free email quota. New accounts get up to US$200 in Free Tier credits (6-month plan) | 300/day (about 9,000/mo). "Sent with Brevo" branding | 100/mo, no expiry, no overage | First 10,000 emails free (one credit) |
| Cost at about 3,000–5,000/mo | Free while under 100/day. Otherwise Pro at US$20/mo (50k) | About US$0.30–0.50/mo (US$0.10 per 1,000) | Free under 300/day, but branded | Basic at US$15/mo (10k) | About US$2.50 per 10k credit; credits last 6 months |
| Domain required | Yes. `resend.dev` sends only to the account owner | Yes for production. Every From identity must be verified | Yes for good delivery | Yes (sender signature or domain) | Yes (DKIM plus a bounce CNAME) |
| Account gate | None beyond domain verification | Sandbox: verified recipients only, 200/day, 1/sec. Production review answered within 96 h | Account activation | Account review | Domain verification |
| Setup effort | Lowest | Highest (AWS account, IAM, region, sandbox exit) | Low–medium | Low | Low–medium |
| Deliverability (Gmail and India) | Good; DKIM, SPF and DMARC supported | Good, but you own reputation and bounce handling | Shared pool, mixed with marketing traffic | Transactional-only streams, strong reputation | Transactional-only; Zoho (India-headquartered) |

"Deliverability" is not something any provider publishes per region. The row above is a qualitative judgement. It does not come from primary data. See Open risks.

## Key facts with sources

**Supabase default email (no custom SMTP)**

- The default service sends only to pre-authorised addresses (project team members). Others fail with "Email address not authorized".
- It is limited to **2 messages per hour**, with no SLA, and is meant for testing only.
- Custom SMTP is required for email and password accounts, OTP and magic links, and invites.

  Source: https://supabase.com/docs/guides/auth/auth-smtp

**Supabase with custom SMTP**

- Once custom SMTP is on, a low limit of **30 messages per hour** applies. You can change it on the Rate Limits page. ([auth-smtp](https://supabase.com/docs/guides/auth/auth-smtp))
- There is a **60-second minimum** between OTP, magic-link, sign-up and password-reset emails to the same user.
- `/auth/v1/verify` allows 30 requests per 5 minutes per IP.

  Source: https://supabase.com/docs/guides/auth/rate-limits

**Supabase deliverability advice**

- Configure SPF, DKIM and DMARC.
- Use a separate sending domain and From address for auth emails.
- Consider a custom Auth domain, because auth emails contain links to it.

  Source: https://supabase.com/docs/guides/auth/auth-smtp

**Supabase email templates and OTP**

- Template variables include `{{ .Token }}` (6-digit OTP), `{{ .TokenHash }}`, `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` and `{{ .RedirectTo }}`.
- Mail scanners such as Microsoft Defender Safe Links can prefetch and consume `{{ .ConfirmationURL }}`, which gives "Token has expired or is invalid". Supabase's first suggested workaround is to send `{{ .Token }}` and verify it in the app.
- Email tracking rewrites links, so turn it off.

  Source: https://supabase.com/docs/guides/auth/auth-email-templates

- An email OTP expires after 1 hour by default. Values above 86,400 s are discouraged. A user can request one every 60 s.

  Source: https://supabase.com/docs/guides/auth/auth-email-passwordless

**Supabase password reset flows**

- **Implicit flow:** `resetPasswordForEmail(email, { redirectTo })`, then a session, then `updateUser({ password })`. The `redirectTo` must be in the allow-list.
- **PKCE flow:** a template link carrying `token_hash={{ .TokenHash }}&type=recovery`, then `verifyOtp({ type, token_hash })`.

  Source: https://supabase.com/docs/guides/auth/passwords

**Supabase in Expo**

- The Expo deep-link guide uses a custom scheme plus a redirect allow-list (`scheme://**`).
- It parses `access_token`/`refresh_token` with `QueryParams.getQueryParams` and calls `setSession`.
- It recommends universal links (App Links on Android) for the best experience, but notes they need more setup.
- It has no password-reset example.

  Source: https://supabase.com/docs/guides/auth/native-mobile-deep-linking

**Resend**

- Free tier: 3,000/month, 100/day, 3 domains. Pro: US$20/month for 50,000. ([pricing](https://resend.com/pricing))
- Supabase SMTP settings: host `smtp.resend.com`, port 465, user `resend`, password = API key. A verified domain is a prerequisite. ([send-with-supabase-smtp](https://resend.com/docs/send-with-supabase-smtp))
- The `resend.dev` test domain can only send to the Resend account's own address; anyone else gets a 403. ([403-error-resend-dev-domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain))
- The Supabase integration creates the API key and fills in SMTP settings. ([supabase.com/partners/integrations/resend](https://supabase.com/partners/integrations/resend))

**Amazon SES**

- Price: US$0.10 per 1,000 emails. New customers get up to US$200 in Free Tier credits; the plan lasts 6 months. ([pricing](https://aws.amazon.com/ses/pricing/))
- Sandbox: sends only to verified recipients, at most 200 per 24 h and 1 per second.
- The production-access review gets a first response within 96 h.
- From and Return-Path identities must always be verified.

  Source: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html

**Brevo**

- The free plan allows 300 sends/day, including SMTP. Unused sends do not roll over.
- Free-plan emails carry "Sent with Brevo".
- The pricing page could not be read; the 300/day figure is from Brevo's help centre and free-SMTP page, reached via search.

  Sources: https://help.brevo.com/hc/en-us/articles/208580669 and https://www.brevo.com/free-smtp-server

**Postmark**

- Free: 100 emails/month, no expiry, no overage.
- Basic: US$15/month for 10,000, then US$1.80 per extra 1,000.

  Source: https://postmarkapp.com/pricing

**ZeptoMail**

- Pay-as-you-go: 1 credit = 10,000 emails, valid for 6 months. The first credit is free. ([pricing](https://www.zoho.com/zeptomail/pricing.html))
- The US$2.50/credit figure comes from third-party listings, because the official page showed no amount in fetched text. Confirm it on the live page.
- Transactional only.

**Gmail sender rules**

- All senders need SPF or DKIM, valid forward and reverse DNS, and TLS, and must keep the spam rate below 0.3%.
- Senders of 5,000+ per day additionally need SPF, DKIM and DMARC with From alignment.
- Senders must not impersonate Gmail From headers. A `@gmail.com` From address is therefore not workable.

  Source: https://support.google.com/a/answer/81126

**Domain cost**

- Cloudflare Registrar charges registry cost with no markup.

  Source: https://www.cloudflare.com/products/registrar/

### Is a domain required?

Yes, in practice:

- Every provider requires a verified sending domain before it will deliver to arbitrary users. Resend's `resend.dev` and the SES sandbox are both locked to your own addresses.
- Gmail's rules need SPF or DKIM on a domain you control, so FLO cannot send as `@gmail.com`.

The cheapest path is to register a `.com` or `.in` at cost, for example through Cloudflare Registrar (about US$10/yr for `.com`). Verify a subdomain such as `auth.` or `mail.` in Resend, and add the SPF/DKIM records it shows plus a `p=none` DMARC TXT record. The same domain will likely be needed anyway for the Play listing's privacy-policy URL and support email.

### Reset-link approaches compared on Android

| Approach | Works with FLO's current client config? | Failure modes |
|---|---|---|
| **OTP code (`{{ .Token }}` + `verifyOtp type:'recovery'`)** | Yes. No URL handling at all | User must type 6 digits. The code expires (1 h by default). Resends are limited to 1 per 60 s |
| Deep link carrying implicit-flow tokens (`flo://reset#access_token=…`) | Partly. Parsing exists for OAuth, but `detectSessionInUrl:false` means a new handler and route are needed | Custom schemes are not clickable in some mail clients. Scanners can consume the link. Fails if the email is opened on a different device or a desktop. Needs `flo://**` in the redirect allow-list |
| PKCE `exchangeCodeForSession` | No. PKCE was reverted (no `crypto.subtle`, so `plain`) | The code verifier must be in the same app storage that started the flow, so it breaks across devices or after a reinstall. Same scanner and link issues |
| `token_hash` link plus `verifyOtp({ token_hash, type:'recovery' })` | Possible. Needs an App Link or web bounce page | Needs `assetlinks.json` hosting or a web page. Still a link |

The OTP code is the only option with no dependency on how Android routes links, so it is the most robust. That matches doc 29's approved decision.

## Open risks

- **Resend's 100/day cap.** A launch-day spike in sign-up confirmations plus resets could pass 100/day even while staying under 3,000/month. Emails over the cap fail. Watch Resend's usage page; if it gets close, either pay US$20/month or switch to ZeptoMail.
- **Supabase's 30/hour limit after enabling SMTP.** It must be raised by hand, or sign-ups will throttle at launch.
- **Deliverability to Indian inboxes is unmeasured.** No provider publishes per-country inbox placement. Once the domain is live, test with seed accounts on Gmail, Outlook, Yahoo and Rediffmail, check Gmail Postmaster Tools, and check that the emails do not land in Promotions or Spam.
- **The OTP path needs the Reset Password template edited to show `{{ .Token }}`.** The Confirm sign-up template should be checked too. This only becomes possible after custom SMTP is saved (per doc 29).
- **`verifyOtp` type naming.** `'recovery'` is typed in auth-js 2.110.2, but Supabase's JS reference only shows `type: 'email'`. Check on the emulator that the `recovery` code verifies. If it fails, try `type: 'email'`.
- **Domain ownership and DNS changes are a manual step** for the user (registrar account, DNS records). The agent cannot do them.
- **Email enumeration.** `resetPasswordForEmail` does not reveal whether an account exists. The UI must keep that property ("If an account exists, we sent a code").
- **ZeptoMail's price is not confirmed from the primary page** (the amount did not render). Check it before choosing ZeptoMail.
