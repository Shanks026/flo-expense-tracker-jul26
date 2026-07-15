import { useCallback, useState } from 'react';
import useProfile from '../hooks/useProfile';
import { useToast } from '../components/Toast';
import { clearDraft } from './onboardingDraft';

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
