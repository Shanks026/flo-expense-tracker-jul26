import { forwardRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Sparkles } from 'lucide-react-native';
import { spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// The Add sheet's quick-add line (44-ai-assistant.md, Phase 1 §1.3). The
// person types "120 lunch nethu" and taps the keyboard's done key; `parse`
// turns the line into the sheet's prefill (lib/quickParse.js, on the phone),
// and `onParsed` fills the sheet. A line `parse` isn't sure about leaves the
// sheet as it is, with a quiet "Couldn't read that" under the line.
//
// A plain component the sheet renders above the amount. It keeps its own
// text, so the sheet remounts it (a `key` per open) to start each open blank.
const QuickAddField = forwardRef(function QuickAddField({ parse, onParsed }, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState('');
  const [parseFailed, setParseFailed] = useState(false);

  function handleSubmit() {
    if (!text.trim()) return;
    const prefill = parse(text);
    if (!prefill) {
      setParseFailed(true);
      return;
    }
    setParseFailed(false);
    onParsed(prefill);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Sparkles size={16} color={colors.muted} strokeWidth={2.2} />
        <BottomSheetTextInput
          ref={ref}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (parseFailed) setParseFailed(false);
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
      </View>
      {/* Always laid out, so showing it never moves the sheet's height. */}
      <Text style={[styles.parseFailed, !parseFailed && styles.parseFailedHidden]} accessibilityLiveRegion="polite">
        Couldn't read that
      </Text>
    </View>
  );
});

export default QuickAddField;

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: spacing.sm,
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
    parseFailed: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: spacing.xs,
      marginLeft: spacing.md,
    },
    parseFailedHidden: {
      opacity: 0,
    },
  });
}
