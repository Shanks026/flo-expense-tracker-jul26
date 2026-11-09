import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Sparkles } from 'lucide-react-native';
import { spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

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
const MESSAGES = {
  unread: "Couldn't read that",
  transfer: 'Use Transfer for two accounts',
  cap: 'Daily AI limit reached',
};

const QuickAddField = forwardRef(function QuickAddField({ parse, ask, onParsed, resetKey, hidden }, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState('');
  // null, or the key of MESSAGES to show at the end of the line.
  const [message, setMessage] = useState(null);
  const [thinking, setThinking] = useState(false);
  // Bumped by every submit, edit and reopen; an answer only lands if it
  // still matches.
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    setText('');
    setMessage(null);
    setThinking(false);
  }, [resetKey]);

  async function handleSubmit() {
    // One model call at a time: a second ✓ while it thinks would be billed
    // and counted against the daily cap for nothing.
    if (!text.trim() || thinking) return;
    const request = ++requestRef.current;
    const local = parse(text);
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
    const { prefill, reason } = await ask(text);
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
          placeholder="Type it: 40 lunch today"
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
    message: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
    },
  });
}
