// Voice quick add (44-ai-assistant.md, Phase 2). Speech-to-text runs on the
// phone through Android's SpeechRecognizer (expo-speech-recognition): the
// on-device model when the language pack is installed, otherwise Google's
// recognizer, which is the OS's and not ours. The text it hears goes through
// the same pipeline as typing; nothing here writes.
//
// Personal build only for now: the lite build blocks RECORD_AUDIO and has no
// speech plugin (app.config.js), so voiceEnabled is false there and the mic
// never shows.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { FLAGS } from './flags';

export const VOICE_LANGUAGES = [
  { value: 'en-IN', label: 'English' },
  { value: 'ta-IN', label: 'Tamil' },
];
const DEFAULT_LANGUAGE = 'en-IN';
const LANGUAGE_KEY = 'flo.voiceLanguage';

// Words people say that a general recognizer tends to miss.
const CONTEXT_WORDS = ['nethu', 'inniki', 'munnaal', 'swiggy', 'zomato', 'rapido', 'dmart', 'blinkit', 'zepto', 'chai'];

export function voiceSupported() {
  if (!FLAGS.ai || Constants.expoConfig?.extra?.voiceEnabled !== true) return false;
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

// The voice language is a device setting, not an account one.
let language = null;
const languageListeners = new Set();

export async function getVoiceLanguage() {
  if (language) return language;
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    language = VOICE_LANGUAGES.some((l) => l.value === stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    language = DEFAULT_LANGUAGE;
  }
  return language;
}

export async function setVoiceLanguage(next) {
  if (!VOICE_LANGUAGES.some((l) => l.value === next)) return;
  language = next;
  languageListeners.forEach((fn) => fn(next));
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    // Kept for this session even if the disk write fails.
  }
}

export function subscribeVoiceLanguage(fn) {
  languageListeners.add(fn);
  return () => languageListeners.delete(fn);
}

// → { granted, canAskAgain }. Never throws.
export async function micPermission({ ask = false } = {}) {
  try {
    const result = ask
      ? await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      : await ExpoSpeechRecognitionModule.getPermissionsAsync();
    return { granted: !!result.granted, canAskAgain: result.canAskAgain !== false };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

// On-device recognition only when this language's pack is installed;
// otherwise the recognizer would fail instead of falling back.
const onDeviceCache = new Map();
async function canRecognizeOnDevice(lang) {
  if (onDeviceCache.has(lang)) return onDeviceCache.get(lang);
  let ok = false;
  try {
    if (ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      const { installedLocales = [] } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      ok = installedLocales.some((l) => l.toLowerCase() === lang.toLowerCase());
    }
  } catch {
    ok = false;
  }
  onDeviceCache.set(lang, ok);
  return ok;
}

// Starts a hold-to-talk session. The caller calls stop() on release.
//   onText(text)  — the transcript so far, partial words included
//   onEnd({ text, error }) — once, after release or a failure; text is the
//                  final transcript ('' if nothing was heard)
// → { stop() }
export async function startListening({ lang, onText, onEnd }) {
  let finals = '';
  let partial = '';
  let ended = false;
  let releasedAt = null;
  const current = () => `${finals} ${partial}`.replace(/\s+/g, ' ').trim();

  const subs = [];
  const finish = (error) => {
    if (ended) return;
    ended = true;
    subs.forEach((s) => s.remove());
    if (__DEV__ && releasedAt) console.log(`voice: release to text ${Date.now() - releasedAt} ms`);
    onEnd({ text: current(), error: error ?? null });
  };
  subs.push(
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript ?? '';
      // Android's continuous mode reports in segments: each final one is
      // kept, and the next partial starts a new segment.
      if (event.isFinal) {
        finals = `${finals} ${transcript}`;
        partial = '';
      } else {
        partial = transcript;
      }
      onText(current());
    }),
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      // No speech isn't a failure the person needs to hear about.
      finish(event.error === 'no-speech' || event.error === 'speech-timeout' ? null : event.error);
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => finish(null))
  );

  try {
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      maxAlternatives: 1,
      // Keeps listening through pauses while the button is held (Android 13+).
      continuous: true,
      requiresOnDeviceRecognition: await canRecognizeOnDevice(lang),
      addsPunctuation: false,
      contextualStrings: lang === 'en-IN' ? CONTEXT_WORDS : undefined,
    });
  } catch (e) {
    finish(e?.message ?? 'start-failed');
  }

  return {
    stop() {
      if (ended) return;
      releasedAt = Date.now();
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        finish(null);
      }
    },
  };
}
