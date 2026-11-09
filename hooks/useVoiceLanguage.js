import { useEffect, useState } from 'react';
import { getVoiceLanguage, setVoiceLanguage, subscribeVoiceLanguage } from '../lib/voice';

// The voice quick-add language, a device setting (44-ai-assistant.md,
// Phase 2): { language: 'en-IN' | 'ta-IN', setLanguage }.
export default function useVoiceLanguage() {
  const [language, setLanguageState] = useState('en-IN');

  useEffect(() => {
    let alive = true;
    getVoiceLanguage().then((value) => {
      if (alive) setLanguageState(value);
    });
    const unsubscribe = subscribeVoiceLanguage(setLanguageState);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { language, setLanguage: setVoiceLanguage };
}
