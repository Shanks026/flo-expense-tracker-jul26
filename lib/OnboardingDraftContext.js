import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The onboarding draft (spec 47): the set-up answers, held for the session
// across the question routes so Back shows what was chosen. Each question
// seeds its own answer from what's saved the first time it opens, then keeps
// the draft's copy. Nothing here is persisted: a relaunch reseeds from the
// database, which Next has already written.
//
// draft.accounts: the picked names, first pick first (undefined = not seeded).
const OnboardingDraftContext = createContext(null);

export function OnboardingDraftProvider({ children }) {
  const [draft, setDraft] = useState({});
  const setAnswer = useCallback((key, value) => setDraft((d) => ({ ...d, [key]: value })), []);
  const value = useMemo(() => ({ draft, setAnswer }), [draft, setAnswer]);
  return <OnboardingDraftContext.Provider value={value}>{children}</OnboardingDraftContext.Provider>;
}

export function useOnboardingDraft() {
  const ctx = useContext(OnboardingDraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used inside OnboardingDraftProvider');
  return ctx;
}
