# Implementing the pre-launch audit with Matt Pocock's skills

**Purpose:** a run-book for a fresh Claude Code session. It turns `docs/flo-pre-launch-audit-2026-10.md` into shipped changes using the `mattpocock-skills` plugin (v1.3.1, installed at project scope in this repo), in the order the plugin's own `ask-matt` router prescribes.

**For the agent reading this:** confirm the plan with the user first (see "Start of session"). Then drive the flow yourself, step by step. Stop only at the confirmation points marked ⛔.

---

## Start of session (agent)

1. Read this file, `AGENTS.md`, `.claude/features/00-index.md` (its standing rules) and §0 + §8 of the audit doc. Read nothing else up front.
2. Check `git status`. If the tree isn't clean, show the user what's dirty and ask whether to commit or discard it before starting ⛔.
   - At the time of writing, two files were dirty:
     - `.claude/features/17-server-push-notifications.md`: two Phase 4 boxes ticked after the emulator test;
     - `CLAUDE.md`: an edit by the user.
3. Show the user the step list below and the current step. Ask: **"Start at step N?"** ⛔ Continue only on a yes.

## Who presses what

Most flow skills in this plugin are **user-invoked only** (`disable-model-invocation: true`). The agent cannot start them with the Skill tool:

| User types it | Agent can invoke it itself |
|---|---|
| `/setup-matt-pocock-skills`, `/wayfinder`, `/to-spec`, `/to-tickets`, `/implement`, `/implement-spec`, `/retro`, `/grill-with-docs`, `/ask-matt` | `grilling`, `domain-modeling`, `research`, `prototype`, `tdd`, `code-review`, `codebase-design`, `diagnosing-bugs`, `pr`, `wizard` |

So "the agent carries out the flow" means:
- at each step, the agent tells the user the **exact command to type**, as one line in a code block;
- once the user types it, the agent drives everything inside that step, including every model-invocable skill it calls;
- the agent never asks the user to remember what comes next.

**Fallback:** if the user explicitly says "follow it yourself", the agent may read the skill's `SKILL.md` from `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/<area>/<name>/SKILL.md` and follow it exactly as written.

---

## The order

### Parallel track: P0 safety fixes (outside the map)

These are already decided and well-scoped. Run them **alongside** step 2, in their own session. Don't put them on the wayfinder map.

- Lock the `split_members` UPDATE policy: a member can make themselves organizer or move into another split.
- Add ownership checks to the INSERT/UPDATE policies on transactions, plans, budgets, bills and splits. Restrict `split_entry_shares` writes.
- Make auto-detect opt-in in `app.config.js` (`FLO_VARIANT === 'personal'`), make `production` the lite build, and remove `submit.full`.

Done when the migrations are applied (SQL shown to the user first ⛔), verified as two different users, advisors are clean, and the docs are updated. A session card titled "Fix split RLS holes and store-build default" was proposed for this. The SQL is in audit §3.

### Step 1: Setup (once)
`/setup-matt-pocock-skills`
- **Issue tracker:** recommend **GitHub Issues** (remote `Shanks026/flo-expense-tracker-jul26`). Wayfinder renders its frontier through native blocking links. Check that `gh auth status` works first; fall back to local markdown (`.scratch/`) if it doesn't.
- **Triage labels:** keep the defaults.
- **Domain docs:** single-context. `GLOSSARY.md` + `docs/adr/` at the repo root.
- **Reconcile with flo-feature:** when the skill writes its `## Agent skills` section into `AGENTS.md`, add one line: *"Specs produced by `/to-spec` are written as `.claude/features/NN-<slug>.md` in the flo-feature template; the flo-feature rule (planning doc before feature code) is satisfied by that file."* Show the edit before writing it ⛔.

Commit the setup output.

### Step 2: Chart the map (one session; resolves nothing)
`/wayfinder`, with the loose idea: *"Implement docs/flo-pre-launch-audit-2026-10.md: reset FLO to a lean, retention-first v1 and get it through Play's closed test into production."*

- **Destination (proposed; confirm in grilling):** "Every v1 scope, UX and design decision in the audit is settled. Each area has a buildable spec ready for `/to-spec`, and the launch-plumbing tasks are done or assigned."
- **Map Notes:**
  - Consult the `domain-modeling` and `grilling` skills, plus the Expo skills (expo-design-system, expo-animation, eas-app-stores).
  - Standing rules: **no AI features**; auto-detect is personal-use only and is never hardened.
  - The audit's "decisions" table is a *proposal*, not a decision: every row gets grilled.
- **Likely first tickets** (the agent proposes them; the user confirms):

  | Type | Ticket |
  |---|---|
  | grilling | Gamification scope (streak-only vs keep some economy) |
  | grilling | Onboarding target flow (4-screen Google-first; anonymous-first?) |
  | grilling | Design language direction ("Ledger, not game"; accents; System/Light/Dark) |
  | grilling | Home information architecture + tab structure (Insights, More) |
  | grilling | Notification cadence + weekly recap |
  | grilling | v1 scope for Plans and split sharing |
  | grilling | Monetisation timing (hide Pro in v1; RevenueCat later) |
  | research | PostHog vs a Supabase `events` table for analytics under DPDP |
  | research | Supabase anonymous auth + Google identity linking |
  | research | Custom SMTP options for forgot-password |
  | task | Permanent package id + Firebase re-registration |
  | task | Privacy policy + account-deletion pages |
  | task | Mascot vector model sheet (who draws it) |

- Fire the research tickets as subagents, as the skill says.
- ⛔ Stop at the end of charting and show the map.

### Step 3: Work the map (repeat; one ticket per session, research excepted)
`/wayfinder <map URL>`
- The agent takes the first frontier ticket, claims it, resolves it, records the resolution comment, and updates Decisions-so-far.
- Grilling tickets are **HITL**. The agent asks; the user decides. The agent never answers its own questions.
- Between tickets: `/clear` (or a new session). Repeat until the frontier is empty and Not-yet-specified is cleared.
- ⛔ Confirm with the user that the map is clear before step 4.

### Step 4: Spec (one unbroken session with step 5)
`/to-spec`. Point it at the closed map.
- Expect several specs, one per area: onboarding, Add sheet + Home, gamification removal, theming/design tokens, notifications/recap, analytics, share-import, mascot.
- Each spec is written as `.claude/features/NN-<slug>.md` (next free numbers after 31) and indexed in `00-index.md`.
- ⛔ The user approves each spec.

### Step 5: Tickets (same session as step 4)
`/to-tickets`. Run it per spec.
- Tracer-bullet tickets with blocking edges on the tracker.
- Order across specs:
  1. analytics (so the reset is measurable);
  2. onboarding + Add sheet;
  3. gamification flags off;
  4. theming/Home;
  5. notifications/recap;
  6. share-import;
  7. mascot.

### Step 6: Build
- Pick `/implement <ticket>` per ticket (with `/clear` between tickets) **or** `/implement-spec` per spec (parallel implementers on one integration branch). Recommend `/implement` for UI-heavy specs and `/implement-spec` for mechanical ones (gamification flags, tokens).
- Each ticket: `tdd` where logic is testable (FLO has no test runner, so the tracer-bullet check is running the app; see Verification), then `code-review`.
- ⛔ Ask the user before every commit and push, and before any Supabase migration or Edge Function deploy.

### Step 7: Close the loop
`/retro` at the end of each spec's build, in that session.

### Launch plumbing (alongside steps 3–6, from the audit's §6 launch sequence)
- The package id, EAS env vars, privacy and deletion pages, Sentry/expo-observe and the root error boundary.
- **Start the 12-tester × 14-day closed test as soon as a lite AAB exists.** It is the longest lead time.
- Use `wizard` for human-only console steps (Play Console, Firebase, EAS secrets).

---

## FLO-specific rules for every step

- **Verification:** there is no test or lint runner. Verify on the **Medium_Phone_API_29** emulator with the test account `flotest@gmail.com`; the user signs in, and the agent never handles passwords. Drive the emulator with `adb` from PowerShell. The installed APK predates these changes, so rebuild (`npx expo run:android`, or a `lite-preview` build) before verifying client changes.
- **Schema truth** is the live Supabase project `uergtlcfpwajztqgncim` via the Supabase MCP. Follow the 00-index standing rules: `user_id DEFAULT auth.uid()`, cascade FKs, `security_invoker` on views.
- **Cut ≠ delete.** For v1, feature-flag gamification, Plans and split invites off and keep the code and data. Delete only after analytics confirm.
- **Docs:** each finished spec updates its `.claude/features` doc and the `00-index.md` row.

## Kickoff prompt for the new session

> Read `docs/matt-implement-flo.md` and follow it. Confirm with me before starting, then drive the flow yourself.
