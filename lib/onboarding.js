import { useCallback, useState } from 'react';
import useProfile from '../hooks/useProfile';
import { useToast } from '../components/Toast';
import { clearDraft } from './onboardingDraft';
import { claimWelcomeBundle } from './rewardsMutations';

// ── Post-auth steps (Act 2 + Act 3) ─────────────────────────────────────────
// The ordered post-sign-up flow. Single source of truth for both the progress
// bar (OnboardingScreen's `progress` prop, via getStepPosition) and the
// "where does Continue go" routing, so a step added/removed renumbers
// everything automatically.
//
// 12-personal-onboarding.md: `welcome` was removed (the pre-auth intro below
// replaces it — a signed-in user is already past it) and `detect` was removed
// (auto-detect is cut from onboarding entirely — personal-use-only, can't ship
// to the stores; see 06-...md / IDEAS-subscription-and-store.md). The detect
// screen file is left orphaned for now; retired in Phase 3 cleanup.
//
// Register a step here only once its screen actually exists — a route with no
// screen renders a dot that leads to a 404.
const STEPS = [
  { key: 'account', route: '/onboarding/account' },
  { key: 'currency', route: '/onboarding/currency' },
  { key: 'categories', route: '/onboarding/categories' },
  { key: 'balance', route: '/onboarding/balance' },
  { key: 'expense', route: '/onboarding/expense' },
  { key: 'budget', route: '/onboarding/budget' },
  { key: 'reports', route: '/onboarding/reports' },
  { key: 'reminders', route: '/onboarding/reminders' },
  { key: 'journey', route: '/onboarding/journey' },
  { key: 'commitment', route: '/onboarding/commitment' },
];

// ── Pre-auth Introduction (Act 1) ───────────────────────────────────────────
// The conversational intro that runs BEFORE sign-up (answers held in the
// AsyncStorage draft, lib/onboardingDraft.js). Kept as its own list, separate
// from STEPS, deliberately: the progress bar for the intro spans the intro only
// — completing it and then signing up is the Duolingo "save your progress"
// moment, and an intro-only bar is stable as later phases grow Act 2/3. Heroes
// (opener/stat/ready/reflection) carry `progress: false` and render no bar.
export const INTRO_STEPS = [
  { key: 'opener', route: '/onboarding/intro/opener', bg: 'brand', progress: false },
  { key: 'problem', route: '/onboarding/intro/problem', bg: 'light', progress: true },
  { key: 'solution', route: '/onboarding/intro/solution', bg: 'light', progress: true },
  { key: 'name', route: '/onboarding/intro/name', bg: 'light', progress: true },
  { key: 'age', route: '/onboarding/intro/age', bg: 'light', progress: true },
  { key: 'gender', route: '/onboarding/intro/gender', bg: 'light', progress: true },
  { key: 'income', route: '/onboarding/intro/income', bg: 'light', progress: true },
  { key: 'stat', route: '/onboarding/intro/stat', bg: 'light', progress: false },
  { key: 'goal', route: '/onboarding/intro/goal', bg: 'light', progress: true },
  { key: 'leak', route: '/onboarding/intro/leak', bg: 'light', progress: true },
  { key: 'habit', route: '/onboarding/intro/habit', bg: 'light', progress: true },
  { key: 'reflection', route: '/onboarding/intro/reflection', bg: 'brand', progress: false },
];

// Where the intro hands off — the account-creation hinge. reflection routes
// here explicitly (getIntroNext returns null past the last step).
export const SIGN_UP_ROUTE = '/sign-in';

// ── "Know your space" tour (28-onboarding-welcome-bundle.md) ─────────────────
// The final leg of onboarding: after `commitment`, before `done`. A short
// image-per-screen walkthrough of the app's actual navigation so a new user
// knows where things are BEFORE the done screen's reward. Kept as its OWN list
// (like INTRO_STEPS), separate from STEPS, so it carries its own "N of 6"
// progress and doesn't dilute the main setup bar (10 steps) into 16.
//
// `icon` is a lucide component NAME (mapped in the tour screen, same
// string-keyed pattern app/trophies.js uses), matching the real TabBar.js
// glyphs so a card's icon is the same shape the user will see in the tab bar:
// tab bar is [Home] [Transactions] [⊕ Add] [Analytics] [Menu]; Budgets/Bills/
// Plans/Reports/Shop/Settings all live inside the Menu sheet. The final `hub`
// card ('personalize') is special — it offers optional deep-links to the real
// Personalize and Manage-Categories screens (see app/onboarding/tour/[step].js).
export const TOUR_STEPS = [
  { key: 'home', route: '/onboarding/tour/home', icon: 'Home', title: 'Home', body: 'Your money at a glance — balance, streak, and rewards all live here.' },
  { key: 'transactions', route: '/onboarding/tour/transactions', icon: 'List', title: 'Transactions', body: 'Every expense and income you log, in one searchable list.' },
  { key: 'add', route: '/onboarding/tour/add', icon: 'Plus', title: 'Add anything', body: 'Tap the ⊕ in the tab bar, from any screen, to log in seconds.' },
  { key: 'analytics', route: '/onboarding/tour/analytics', icon: 'ChartColumn', title: 'Analytics', body: 'See where your money actually goes — by category and over time.' },
  { key: 'menu', route: '/onboarding/tour/menu', icon: 'Menu', title: 'The Menu', body: 'Tap ☰ for everything else: Budgets, Plans, Bills, Reports, the Shop and Settings.' },
  { key: 'budgets', route: '/onboarding/tour/budgets', icon: 'Wallet', title: 'Budgets', body: 'Set a limit for a category or the whole month, and watch what’s left.' },
  { key: 'plans', route: '/onboarding/tour/plans', icon: 'Flag', title: 'Plans', body: 'Save toward something — a trip, a gadget — and track your progress.' },
  { key: 'bills', route: '/onboarding/tour/bills', icon: 'Receipt', title: 'Bills', body: 'Track recurring payments and subscriptions so nothing catches you off guard.' },
  { key: 'currency', route: '/onboarding/tour/currency', icon: 'Sparkles', title: 'Coins, freezes & XP', body: 'Logging your money earns you three things:', currency: true },
  { key: 'personalize', route: '/onboarding/tour/personalize', icon: 'Palette', title: 'Make it yours', body: 'Set your colours and card design, and shape your own categories. Or skip — you can always do this later.', hub: true },
];

export const TOUR_START_ROUTE = TOUR_STEPS[0].route;

// The reward reveal that follows the tour (28-onboarding-welcome-bundle.md) —
// its own screen ("Here's your welcome bundle"), reached from the last tour
// card AND from "Skip tour" (so a skipping user still sees their reward), then
// hands to the done screen. Not a TOUR_STEPS card (no "N of N" progress, no
// "Quick Tour" eyebrow — it's the payoff, not a tour stop).
export const BUNDLE_ROUTE = '/onboarding/welcome-bundle';

export function getTourStep(key) {
  return TOUR_STEPS.find((s) => s.key === key) ?? null;
}

// 1-based position for the tour's own progress bar / "N of total" label.
export function getTourPosition(key) {
  const index = TOUR_STEPS.findIndex((s) => s.key === key);
  if (index === -1) return null;
  return { index: index + 1, total: TOUR_STEPS.length };
}

// Next tour card, or the welcome-bundle reveal after the last one.
export function getTourNext(key) {
  const index = TOUR_STEPS.findIndex((s) => s.key === key);
  if (index === -1) return BUNDLE_ROUTE;
  return TOUR_STEPS[index + 1]?.route ?? BUNDLE_ROUTE;
}

// 1-based position within the whole intro, for the progress bar ratio.
export function getIntroPosition(key) {
  const index = INTRO_STEPS.findIndex((s) => s.key === key);
  if (index === -1) return null;
  return { index: index + 1, total: INTRO_STEPS.length };
}

export function getIntroNext(key) {
  const index = INTRO_STEPS.findIndex((s) => s.key === key);
  if (index === -1) return null;
  return INTRO_STEPS[index + 1]?.route ?? null; // null after reflection → caller routes to sign-up
}

// Terminal screen — deliberately not a step. It's the celebration, not a
// stage of setup, so it carries no dot and nothing routes "past" it.
export const DONE_ROUTE = '/onboarding/done';

export function getSteps() {
  return STEPS.filter((step) => !step.supported || step.supported());
}

// 1-based, for display. Returns null for a key that isn't in STEPS (the done
// screen has no bar of its own — it's the celebration, not a stage of setup).
export function getStepPosition(key) {
  const steps = getSteps();
  const index = steps.findIndex((step) => step.key === key);
  if (index === -1) return null;
  return { index: index + 1, total: steps.length };
}

export function getNextRoute(key) {
  const steps = getSteps();
  const index = steps.findIndex((step) => step.key === key);
  if (index === -1) return DONE_ROUTE;
  return steps[index + 1]?.route ?? DONE_ROUTE;
}

// Finishing and skipping are the same operation: a skip is a completion, not
// a deferral. Both write onboarded_at, which is what stops OnboardingGate
// redirecting back into the flow.
//
// This deliberately does NOT navigate. That looks like an omission and isn't:
// navigating to '/' here caused a visible flicker back through Welcome on the
// way out. updateProfile() writes the column and calls notifyChanged(), but the
// gate's useProfile refetch is asynchronous — so for one tick the gate would
// see us on a non-onboarding route with onboarded_at still reading null, and
// dutifully redirect us back to /onboarding/welcome. A moment later the refetch
// landed, and it bounced us to Home. Welcome, then Home: exactly the reported
// flash.
//
// Letting the gate own the exit removes the window entirely — we stay put until
// the profile genuinely says onboarded, and then the gate moves us once. The
// caller gets `working` so the button can show a spinner across the round trip
// instead of looking dead.
export function useOnboarding() {
  const { updateProfile } = useProfile();
  const { showToast } = useToast();
  const [working, setWorking] = useState(false);

  const finish = useCallback(async () => {
    setWorking(true);
    // Grant the one-time welcome bundle BEFORE flipping onboarded_at
    // (28-onboarding-welcome-bundle.md). Order matters: updateProfile below is
    // non-silent, so it bumps useDataRefresh's version and every balance/hook
    // refetches — granting first means that refetch already sees the bundle's
    // coins/freezes/theme rows, instead of showing a stale (pre-bundle)
    // balance until the next refresh. Best-effort and swallowed: a failed
    // grant must never block a user from finishing onboarding (they just don't
    // get the bundle; it's idempotent so no partial-double-grant risk). Also
    // runs on SKIP, since skipping IS completing (this same finish() is the
    // skip path) — the product decision is that a skipping user still gets it.
    try {
      await claimWelcomeBundle();
    } catch {
      // ignore — see above
    }
    const { error } = await updateProfile({ onboarded_at: new Date().toISOString() });
    if (error) {
      setWorking(false);
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    // The draft (income included) has served its whole purpose by now — the
    // budget step already consumed income_band, and every durable answer was
    // flushed to onboarding_answers back in account.js. Nothing left to keep.
    await clearDraft();
    // On success: no setWorking(false), no navigation. The gate unmounts this
    // screen as soon as the refetched profile shows onboarded_at set; dropping
    // the spinner first would just flash an idle button on the way out.
  }, [updateProfile, showToast]);

  return { finish, working };
}
