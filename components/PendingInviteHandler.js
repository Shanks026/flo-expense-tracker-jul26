import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import { getPendingInvite } from '../lib/pendingInvite';

// Sibling of <Stack>, same placement and reasoning as OnboardingGate and
// ShareIntentHandler: it needs useProfile() (→ useDataRefresh()), which
// RootNavigator defines but cannot itself consume.
//
// Resumes a split invite that survived a sign-in or a whole first-run
// onboarding — the normal path for a shared split, where the friend who taps
// the WhatsApp link doesn't have FLO yet and the deep link is long gone by the
// time they have a session.
//
// CAREFUL ABOUT REDIRECT OWNERSHIP. 07-onboarding.md documents at length why
// routing is split strictly by session — RootNavigator owns all of `!session`,
// OnboardingGate owns all of `session` — and why adding a third opinion causes
// route-flash bugs. This deliberately adds no new opinion: it waits until the
// gate has already settled the user somewhere legitimate (signed in, onboarded,
// not mid-onboarding, not on sign-in) and only then pushes. It also fires at
// most once per app run, so it can never fight a redirect in a loop.
export default function PendingInviteHandler() {
  const { session } = useAuth();
  const { profile, loading } = useProfile();
  const segments = useSegments();
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    if (!session || loading || !profile) return;
    // Not until onboarding is genuinely finished — dropping a new signup into a
    // join screen mid-flow would strand them outside the gate's own routing.
    if (!profile.onboarded_at) return;

    const first = segments[0];
    if (first === 'onboarding' || first === 'sign-in' || first === 'join') return;

    getPendingInvite().then((code) => {
      if (!code || handledRef.current) return;
      handledRef.current = true;
      // The join screen owns clearing the code — including the invalid and
      // already-a-member cases, so a dead link can't strand the user here on
      // every launch.
      router.push(`/join/${code}`);
    });
  }, [session, loading, profile, segments]);

  return null;
}
