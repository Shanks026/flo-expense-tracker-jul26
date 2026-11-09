import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Keyboard } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Sparkles, Mic } from 'lucide-react-native';
import { spacing, fontFamily, fontSize, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { voiceSupported, micPermission, startListening } from '../lib/voice';
import useVoiceLanguage from '../hooks/useVoiceLanguage';

// The Add sheet's quick-add line (44-ai-assistant.md, Phase 1 §1.3). The
// person types "120 lunch nethu" and taps the keyboard's done key; `parse`
// turns the line into the sheet's prefill (lib/quickParse.js, on the phone),
// and `onParsed` fills the sheet. A line `parse` isn't sure about leaves the
// sheet as it is, with a quiet "Couldn't read that" at the end of the line.
//
// When `parse` isn't sure, `ask` (the ai-assistant function, ticket 02) gets
// the line and a small spinner shows until it answers. Its prefill goes to
// `onParsed` with the source 'quick_ai'; a refusal, an error or a timeout
// leaves the sheet as it was. An answer that arrives after the line changed
// or the sheet reopened is dropped.
//
// A plain component the sheet renders above the amount. It keeps its own
// text, cleared whenever `resetKey` changes (once per open). The sheet keeps
// it mounted rather than remounting it per open: Android won't raise the
// keyboard for a focus() on an input that was only just mounted.
//
// Voice (Phase 2, ticket 04): hold the mic at the end of the line and speak.
// The words appear in the line as they're heard; letting go submits them
// exactly as if typed, and the text stays editable for a fix and a re-run.
// The mic permission is asked on the first press, never earlier; once it's
// denied for good the mic hides and typing works as before.
const MESSAGES = {
  unread: "Couldn't read that",
  transfer: 'Use Transfer for two accounts',
  cap: 'Daily AI limit reached',
  unheard: "Couldn't hear that",
};

const QuickAddField = forwardRef(function QuickAddField({ parse, ask, onParsed, resetKey, listenKey, onCantListen, hidden }, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState('');
  // null, or the key of MESSAGES to show at the end of the line.
  const [message, setMessage] = useState(null);
  const [thinking, setThinking] = useState(false);
  // Bumped by every submit, edit and reopen; an answer only lands if it
  // still matches.
  const requestRef = useRef(0);

  // Voice: shown only where the build and the phone support it, and hidden
  // for good once the permission is denied without a way to ask again.
  const { language } = useVoiceLanguage();
  const [micAllowed, setMicAllowed] = useState(() => voiceSupported());
  const [listening, setListening] = useState(false);
  const sessionRef = useRef(null);
  const heldRef = useRef(false);

  useEffect(() => {
    if (!micAllowed) return;
    micPermission().then(({ granted, canAskAgain }) => {
      if (!granted && !canAskAgain) setMicAllowed(false);
    });
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    setText('');
    setMessage(null);
    setThinking(false);
    sessionRef.current?.stop();
  }, [resetKey]);

  // Long-press ⊕ (ticket 05): the sheet opens already listening, and the
  // session ends by itself when the person stops speaking. If voice can't run
  // here, the sheet falls back to typing.
  useEffect(() => {
    if (!listenKey) return;
    (async () => {
      if (!micAllowed) {
        onCantListen?.();
        return;
      }
      let { granted } = await micPermission();
      if (!granted) {
        const asked = await micPermission({ ask: true });
        granted = asked.granted;
        if (!granted && !asked.canAskAgain) setMicAllowed(false);
      }
      if (!granted) {
        onCantListen?.();
        return;
      }
      listen({ continuous: false });
    })();
  }, [listenKey]);

  async function handleMicIn() {
    // During a long-press session, a press only ends it (on release).
    if (listening) return;
    heldRef.current = true;
    const { granted } = await micPermission();
    if (!granted) {
      // The first press only asks; the next hold talks.
      const asked = await micPermission({ ask: true });
      if (!asked.granted && !asked.canAskAgain) setMicAllowed(false);
      return;
    }
    if (!heldRef.current) return;
    const session = await listen({ continuous: true });
    // Let go before the recognizer was ready.
    if (!heldRef.current) session.stop();
  }

  async function listen({ continuous }) {
    requestRef.current += 1;
    Keyboard.dismiss();
    setMessage(null);
    setThinking(false);
    setListening(true);
    setText('');
    const session = await startListening({
      lang: language,
      continuous,
      onText: setText,
      onEnd: ({ text: heard, error }) => {
        sessionRef.current = null;
        setListening(false);
        if (error === 'not-allowed') {
          setMicAllowed(false);
          return;
        }
        if (!heard) {
          setMessage('unheard');
          return;
        }
        setText(heard);
        submit(heard);
      },
    });
    sessionRef.current = session;
    return session;
  }

  function handleMicOut() {
    heldRef.current = false;
    sessionRef.current?.stop();
  }

  function handleSubmit() {
    submit(text);
  }

  async function submit(line) {
    // One model call at a time: a second ✓ while it thinks would be billed
    // and counted against the daily cap for nothing.
    if (!line.trim() || thinking || listening) return;
    const request = ++requestRef.current;
    const local = parse(line);
    if (local) {
      setMessage(null);
      setThinking(false);
      onParsed(local, 'quick_local');
      return;
    }
    if (!ask) {
      setMessage('unread');
      return;
    }
    setMessage(null);
    setThinking(true);
    const { prefill, reason } = await ask(line);
    if (request !== requestRef.current) return;
    setThinking(false);
    if (prefill) {
      onParsed(prefill, 'quick_ai');
      return;
    }
    // 'stale': the person edited the sheet by hand meanwhile; say nothing.
    if (reason === 'stale') return;
    setMessage(MESSAGES[reason] ? reason : 'unread');
  }

  return (
    <View style={[styles.wrap, hidden && styles.hidden]}>
      <View style={styles.row}>
        <Sparkles size={16} color={colors.muted} strokeWidth={2.2} />
        <BottomSheetTextInput
          ref={ref}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (message) setMessage(null);
            if (thinking) {
              requestRef.current += 1;
              setThinking(false);
            }
          }}
          onSubmitEditing={handleSubmit}
          placeholder={listening ? 'Listening…' : micAllowed ? 'Type or hold the mic' : 'Type it: 40 lunch today'}
          placeholderTextColor={colors.mutedLight}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={200}
          style={styles.input}
        />
        {/* Inside the row, not under it: the line stays one row tall, so the
            sheet never changes height, and it leaves room for Save above a
            text keyboard on a phone-height screen. */}
        {thinking && <ActivityIndicator size="small" color={colors.muted} accessibilityLabel="Reading" />}
        {message && (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {MESSAGES[message]}
          </Text>
        )}
        {micAllowed && !thinking && (
          <Pressable
            onPressIn={handleMicIn}
            onPressOut={handleMicOut}
            hitSlop={8}
            style={[styles.mic, listening && styles.micListening]}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Listening. Let go to finish' : 'Hold to speak'}
          >
            <Mic size={18} color={listening ? colors.brandText : colors.ink} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export default QuickAddField;

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: spacing.sm,
    },
    hidden: {
      display: 'none',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    input: {
      flex: 1,
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.ink,
      paddingVertical: 8,
    },
    mic: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      backgroundColor: colors.chipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micListening: {
      backgroundColor: colors.brand,
    },
    message: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
    },
  });
}
