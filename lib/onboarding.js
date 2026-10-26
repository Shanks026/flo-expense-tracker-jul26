import { useCallback, useState } from 'react';
import useProfile from '../hooks/useProfile';
import { useToast } from '../components/Toast';

// ── Post-auth steps (35-onboarding-v3.md) ───────────────────────────────────
// Onboarding is the opener (pre-auth, app/onboarding/intro/opener.js), then
// sign-in, then these steps. Sign-up seeds the account, INR, categories and
// weekly report server-side (handle_new_user), so no step sets anything up.
// The last step calls finish().
//
// Register a step here only once its screen actually exists.
const STEPS = [
  { key: 'reminders', route: '/onboarding/reminders' },
];

// Where OnboardingGate sends a signed-in user without onboarded_at — new, or
// stuck partway through any older version of the flow.
export const FIRST_STEP_ROUTE = STEPS[0].route;

export function isStepRoute(pathname) {
  return STEPS.some((step) => step.route === pathname);
}

// Finishing and skipping are the same operation: a skip is a completion, not
// a deferral. Both write onboarded_at, which is what stops OnboardingGate
// redirecting back into the flow.
//
// This deliberately does NOT navigate. That looks like an omission and isn't:
// navigating to '/' here caused a visible flicker on the way out.
// updateProfile() writes the column and calls notifyChanged(), but the gate's
// useProfile refetch is asynchronous — so for one tick the gate would see us
// on a non-step route with onboarded_at still reading null, and dutifully
// redirect us back into the flow. A moment later the refetch landed, and it
// bounced us to Home: exactly the reported flash.
//
// Letting the gate own the exit removes the window entirely — we stay put until
// the profile genuinely says onboarded, and then the gate moves us once. The
// caller gets `working` so the button can show a spinner across the round trip
// instead of looking dead.
//
// No welcome bundle (no rewards or celebrations during onboarding);
// claimWelcomeBundle stays in lib/rewardsMutations.js with the rest of the
// economy.
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
