# Design prompt — FLO Personal Onboarding (v2)

*Paste everything below the line into Claude design. It extends the existing
`claude-design/FLO Expense Tracker Design/FLO App.dc.html` — same app, same
design system, a new and much richer onboarding group replacing the old
5-screen one.*

---

You already designed FLO — a personal expense tracker (React Native / Expo,
₹/UPI market, India). This is a **new, expanded onboarding flow** that replaces
the old 5-screen version (Welcome → Name account → First transaction → Reminders
→ Done). Keep the **exact same design system** you already built for FLO. Design
**mobile screens** (portrait, iPhone/Android proportions), one artboard per
screen, in order, labelled by number and section.

## The design system — do not deviate

**Typeface:** Manrope throughout. Weights: 400 / 500 / 600 / 700 / 800. Big
moments use 800 (ExtraBold) at large sizes; body is 400–500.

**Color tokens (use these exact hexes):**

| Token | Hex | Role |
|---|---|---|
| `brand` (lime) | `#BBDC12` | The identity color. Loud. Great as a **full background** or as **text on dark**. **Never as text on white** — it fails contrast. |
| `income` (deep lime) | `#5f8a15` | The **on-white substitute** for lime. Use this to make key words green on light screens. |
| `incomeBg` | `#EEF4CE` | Pale lime wash for tiles/highlights on light screens. |
| `ink` | `#101010` | Near-black. Primary text on light; primary background on dark screens. |
| `inkCard` | `#1b1b1b` | Slightly lifted dark surface (cards on dark screens). |
| `bg` | `#F6F7F3` | The default off-white canvas. |
| `surface` | `#FFFFFF` | White cards on the canvas. |
| `border` / `borderSoft` | `#ECEDE7` / `#F1F2ED` | Hairline card borders. |
| `muted` | `#8a8e84` | Secondary/descriptive text. |
| `streak` / `streakDeep` / `streakBg` | `#FF6B2C` / `#D9480F` / `#FFE8DC` | **Streak only** — the orange fire system. Never lime for streak. |
| `danger` / `warn` | `#E5484D` / `#E8A317` | Over/near budget. Not for onboarding except budget preview. |

**Radii:** cards `22`, large cards `26`, pills `99`, buttons `16`, full-screen
hero container `46`. **Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24. Big number
type sizes exist up to 56 for amounts — use them for hero stats.

## The color strategy for THIS flow (the important part)

Treat the flow like an edited video — it should **breathe with cuts between
backgrounds**, never two identical backgrounds back to back. Three background
modes, used in a deliberate mix:

1. **Full-bleed LIME hero** (`#BBDC12` background, `#101010` ink text, Manrope
   800). Loud, brand-defining, emotional-peak screens. Used sparingly — the
   opener, the emotional turns, the final screen. This is the "Hey" screen
   energy.
2. **Dark / INK screens** (`#101010` or `#1b1b1b` background). Here — and ONLY
   here — the **most important words can be raw brand lime `#BBDC12`**, because
   lime pops on black. Use for drama: the stat reveal, the commitment moment.
3. **Light workhorse screens** (`#F6F7F3` canvas, `#FFFFFF` cards). Most
   question/input/reflection screens. Here the **key words are deep lime
   `#5f8a15`** or ink — **never raw `#BBDC12`** (it's illegible on white). Pale
   lime `#EEF4CE` can wash behind a highlighted word or tile.

**Rule for emphasis words everywhere:** the single most important phrase on each
screen gets color — lime on dark, deep-lime on light, ink-on-lime on hero
screens. Everything else stays ink/muted. One emphasis per screen, not five.

**Motion notes for each screen** (Claude design: annotate, we'll build in
Reanimated): favor soft spring entrances, staggered fade-up of stacked elements,
a satisfying tactile press on the primary button, and one "moment" animation per
emotional-peak screen (confetti, count-up number, flame ignite).

## Structure — three acts + a hinge

The flow has a **pre-auth introduction**, then **account creation as the
hinge**, then a **post-auth climax + conclusion**. Mark the account-creation
screen clearly as the turning point — everything before it is "convince me,"
everything after is "it's real now."

Progress indicator: a **thin lime progress bar** at the top of the workhorse
screens (not on the full-bleed hero moments — those are meant to feel like
full-stops). Every screen has a subtle **Skip** affordance except the account
creation and first-transaction steps.

---

## ACT 1 — INTRODUCTION (pre-auth)

### Screen 1 — "Hey." (FULL-BLEED LIME hero)
- Background: full `#BBDC12`. Huge Manrope-800 **"Hey."** in `#101010`, centered,
  dominating the screen. One quiet ink line below: *"Let's figure out where your
  money actually goes."*
- Bottom: a dark pill button *"Start"* (ink fill, lime text). Tiny text link
  under it: *"Already have an account? Sign in"* (this is important — it's the
  escape hatch for returning users).
- Motion: "Hey." springs in; a slow, barely-there lime gradient shimmer.

### Screen 2 — The problem (LIGHT)
- Canvas `#F6F7F3`. A warm, human sentence set large in ink, with the emotional
  words in deep lime `#5f8a15`: *"By the end of the month, it feels like your
  wallet has a **quiet hole** in it — and you're not sure where."*
- A single soft illustration or icon (a wallet, understated). No shame imagery.
- Primary button: *"Yeah, that's me."*

### Screen 3 — The solution (LIGHT)
- One-line promise: *"FLO gives you **2 minutes a day** to always know."* ("2
  minutes a day" in deep lime.)
- Three tiny feature ticks stacked (Track · See · Change) — minimal, not a
  feature dump.
- Button: *"Show me how."*

### Screen 4 — Name (LIGHT, input)
- *"First — what should we call you?"* Big single text input, lime caret.
- Warm subcopy: *"No pressure, you can change it later."*
- Button enables (fills lime→ink) once they type.

### Screen 5 — Age (LIGHT, choice)
- *"Which of these is you, [name]?"* — 4 big tappable cards in a 2×2 grid:
  **18–24 / 25–34 / 35–44 / 45+**. Selected card gets a lime `#EEF4CE` fill +
  deep-lime border + check.
- (Age drives the next screen's stat — design the cards to feel like a real
  choice, not a form field.)

### Screen 6 — Income, with a privacy promise (LIGHT, choice)
- *"Roughly how much comes in each month?"* — bands as tappable rows:
  **Under ₹30k / ₹30k–75k / ₹75k–1.5L / ₹1.5L+**.
- **Prominent trust badge** (pale lime `#EEF4CE` pill with a small lock icon):
  *"We never store this. It just helps us size your first budget."* Make this
  badge visually reassuring — it's doing real trust work.

### Screen 7 — The aha stat (DARK / INK hero)
- Background `#101010`. This is the emotional gut-punch. A **big number in brand
  lime `#BBDC12`** (count-up animation), age-tailored, framed around the
  *invisibility of spending*, never shame. Example for 25–34:
  *"The average UPI user makes **~N small payments a day."*  Below, in white:
  *"None of which you'll remember by tonight."*
- Tiny muted citation line at the bottom (we'll fill the real source; leave a
  placeholder like *"Source: NPCI, 2025"*).
- Design 4 variants of this screen (one per age band), same layout, different
  headline number + one line. (Copy will be finalized against a real source —
  design the container to hold a big number + one supporting line.)
- Button: *"Okay, that's a lot."*

### Screen 8 — The 2-minute ask (FULL-BLEED LIME hero)
- Full `#BBDC12`. Ink text: *"Got **2 minutes a day** to never wonder again?"*
- Two ink buttons: *"I'm in"* (primary) / *"Tell me more"* (ghost). Playful.

### Screen 9 — Selling Q1: the goal (LIGHT, choice)
- *"What do you actually want from this?"* — 4 cards:
  **Finally see where it goes / Stop overspending / Save for something / Just
  feel in control.** Selected = lime wash + check.

### Screen 10 — Selling Q2: the leak (LIGHT, choice)
- *"Where does your money quietly leak?"* — 4 cards with small category icons:
  **Food & eating out / Shopping / Subscriptions / I honestly don't know.**
- (This one pre-creates a real budget later — design it to feel consequential.)

### Screen 11 — Selling Q3: current habit (LIGHT, choice)
- *"How often do you check your spending today?"* — 4 rows:
  **Every day / Once a week-ish / Only when it feels off / Never, honestly.**

### Screen 12 — Reflection: "You're in the right place" (LIGHT, card stack)
- Header in ink with deep-lime emphasis: *"You're in the **right place**, [name]."*
- Below: their answers **played back as 3 small cards**, each with a title (their
  answer) and a one-line why-it-matters description in muted text. E.g.
  *"Stop overspending → A daily 2-min habit is exactly how that gets fixed."*
- This is a **receipt, not a compliment** — it should feel like being heard.
- Button: *"Let's set it up."*

---

## THE HINGE

### Screen 13 — Create account, framed as saving progress (LIGHT)
- Header: *"Save your progress, [name]."* NOT "Sign up" as a headline — the
  account is presented as *keeping what you've built*, not a gate.
- Email + password (or Google/Apple buttons if those exist in the app already).
- Small line: *"Everything you just told us gets set up on the other side."*
- Mark this screen visually as a turning point (a subtle divider in the flow,
  maybe a fuller-width lime accent).

---

## ACT 2 — CLIMAX (post-auth, real data)

### Screen 14 — Name your account (LIGHT)
- Reuse the existing "Name your account" pattern from the current design: a text
  field + a **color swatch picker** for the account. Keep it consistent with the
  already-designed account-naming screen.

### Screen 15 — Add your first transaction (LIGHT, the hook)
- The most important functional screen. An **inline composer** (not a bottom
  sheet — this is a full stepper screen): big amount entry with a lime-accented
  numeric feel, an income/expense toggle, and a horizontally scrolling row of
  **category chips** (selected chip = lime wash). A note field.
- Header: *"Log one thing you spent today. Any amount."*
- Primary button: *"Add it."* Make the amount typography large (up to 56).

### Screen 16 — Day-0 streak reveal (FULL-BLEED, STREAK ORANGE)
- The reward moment. Background can be a warm `#FFE8DC` wash or dark with the
  flame glowing. A **big animated flame igniting** (`#FF6B2C` / `#D9480F` core)
  with a **"Day 1"** count. NOT lime — this is the streak system's orange.
- Koban (the app's character/mascot, already designed) says something warm:
  *"Day one. You just started something."*
- Motion: flame ignites + a small confetti burst. This is a peak — make it feel
  earned.

### Screen 17 — Budget created from their answer (LIGHT, reveal)
- *"You said **[Food & eating out]** was the leak."* (their answer, deep lime).
  Below: a **live budget card** (reuse the existing budget card component look —
  progress bar, category icon, amount) with copy: *"So we've set one up. It's
  already on your Budgets tab."*
- The budget amount is sized from their income band. If they answered "I don't
  know" on screen 10, show a gentler variant: *"We'll help you find it —
  here's where we'll start looking."*
- Button: *"Nice."*

### Screen 18 — Reports cadence (LIGHT, choice) — NEW FEATURE
- FLO now generates **weekly/monthly reports** (a curated single-scroll recap of
  where your money went across all accounts — prior-period comparison, category
  donut, budgets, biggest transactions). This screen sets the cadence.
- *"How often do you want a report on where it went?"* — 3 cards:
  - **Every week** — subcopy *"A Monday recap of your week."*
  - **Once a month** — subcopy *"The big picture, first of each month."*
  - **I'll check it myself** — subcopy *"No schedule — open it anytime from the
    menu."*
- Optional: a small **preview thumbnail of the report screen** (a mini version
  of the report's donut + headline) beside or above the choices, so they see
  what they're signing up for. Selected card = lime wash + check.

### Screen 19 — Reminders + streak (LIGHT)
- Reuse/adapt the existing reminders screen, reframed around the streak: a
  nightly-nudge toggle (*"A gentle nudge each evening to keep your streak"*) and
  a bill-reminder toggle. Show the OS-permission ask context. Default the nudge
  ON, pre-set to a sensible evening time. Deep-lime emphasis on *"streak."*

---

## ACT 3 — CONCLUSION (post-auth)

### Screen 20 — Journey summary (DARK / INK)
- Background `#101010`. A three-beat vertical story with lime accents:
  **Where you are** (today) → **Where you want to go** (their goal from screen 9,
  in lime) → **How FLO gets you there** (the 2-min habit).
- Feels like the "recap montage" at the end of a good video. Elegant, minimal,
  a connecting vertical line between the three beats.

### Screen 21 — It's all free (LIGHT)
- *"And all of this? **Free.**"* ("Free" in deep lime, large.) Reassure — no
  paywall, no card, no trial. One clean line, generous whitespace. A small
  foreshadow is fine (*"We'll build a Pro tier one day — you'll never lose
  this."*) but absolutely no gate.
- Button: *"Good to know."*

### Screen 22 — Commitment (DARK / INK hero)
- Background `#101010`. *"How committed are you to the **future you** just
  described?"* ("future you" in brand lime `#BBDC12`.) Three choices as bold
  stacked pills:
  **All in / Pretty committed / I'll give it a shot.**
- (This sets the tone of the app's nudges; it's a real commitment device — make
  it feel weighty, like signing something.)

### Screen 23 — Final assurance (FULL-BLEED LIME hero)
- Full `#BBDC12`. Ink text, Manrope 800: *"You're set, [name]."* A warm final
  line: *"Two minutes a day. That's the whole trick."*
- Big ink button: *"Go to my money."* → drops into Home.
- Motion: a final confident spring + subtle confetti, then the button pulses
  once.

---

## Deliverable

- 23 screens (plus the 4 age-variants of screen 7 = 26 artboards), in order,
  each labelled `[Act] · [number] · [name]`.
- Each screen annotated with its **background mode** (Lime hero / Dark / Light),
  the **emphasis word + its color**, and a **one-line motion note**.
- Keep Koban's appearances consistent with the existing character design.
- Reuse existing components where noted (account name+color picker, category
  chips, budget card, report donut preview) so the flow feels native to the app,
  not bolted on.
