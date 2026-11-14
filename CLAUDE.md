@AGENTS.md

<!-- claude-reflect: learned rules (saved from the band; edit freely) -->
## Learned rules
- Use the Pixel_API_36 emulator (Android 16, Google APIs, x86_64; AVD on D:\Android\avd) when testing this FLO project. It replaced Medium Phone API 29 on 2026-11-08 to match the person's Android 16 phone: edge-to-edge and the runtime notification permission.
- For FLO app testing, create a test account with a random email, skip the email link check, and reuse that account for future tests.
- Do not recommend or add external third-party services like Sentry; prefer built-in or self-contained options. One exception, approved 2026-11-08: OpenRouter for AI (spec 44), called over HTTP from an Edge Function, with no SDK.
- Do not add third-party SDKs such as PostHog or Sentry; use a first-party Supabase events table for analytics.
- For FLO, use a Personal Google Play Console developer account, not an Organisation account, and run the 12-tester closed test.
<!-- end claude-reflect -->
