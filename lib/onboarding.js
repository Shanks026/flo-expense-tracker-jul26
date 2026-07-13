import { useCallback, useState } from 'react';
import useProfile from '../hooks/useProfile';
import { useToast } from '../components/Toast';
import { isSupported as isDetectSupported } from './detect';

// The ordered first-run flow. This list is the single source of truth for
// both the progress dots and the "where does Continue go" routing, so a step
// that is added, removed, or filtered out renumbers everything automatically
// instead of leaving a dead dot or a button that routes into a screen that
// can't work.
//
// `supported` is an optional predicate. A step whose predicate returns false
// is dropped from the flow entirely (not stubbed, not disabled) — this exists
// for the auto-detect step, which is Android-and-dev-build only. Nothing uses
// it yet.
//
// Register a step here only once its screen actually exists. A step in this
// list with no route behind it renders a dot that leads to a 404.
const STEPS = [
  { key: 'welcome', route: '/onboarding/welcome' },
  { key: 'account', route: '/onboarding/account' },
  { key: 'expense', route: '/onboarding/expense' },
  { key: 'reminders', route: '/onboarding/reminders' },
  // Android + dev-build only. Filtered out entirely elsewhere — the flow goes
  // straight from reminders to done, and the dots renumber from 5 to 4.
  { key: 'detect', route: '/onboarding/detect', supported: isDetectSupported },
];

// Terminal screen — deliberately not a step. It's the celebration, not a
// stage of setup, so it carries no dot and nothing routes "past" it.
export const DONE_ROUTE = '/onboarding/done';

export function getSteps() {
  return STEPS.filter((step) => !step.supported || step.supported());
}

// 1-based, for display. Returns null for a key that isn't a dotted step
// (Welcome renders no dot row of its own, the done screen has none at all).
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
    }
    // On success: no setWorking(false), no navigation. The gate unmounts this
    // screen as soon as the refetched profile shows onboarded_at set; dropping
    // the spinner first would just flash an idle button on the way out.
  }, [updateProfile, showToast]);

  return { finish, working };
}
