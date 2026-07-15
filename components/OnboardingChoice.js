import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';

// The shared MCQ card list used by the age / income / goal / leak / habit intro
// screens. One selected state, one place, so the five question screens can never
// drift on how a choice looks. Light-background screens only (all the question
// screens are light); selected = pale-lime fill + deep-lime border + filled check.
export default function ChoiceList({ options, value, onChange }) {
  return (
    <View style={styles.list}>
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.card, selected && styles.cardSelected]}
          >
            {o.emoji ? <Text style={styles.emoji}>{o.emoji}</Text> : null}
            <View style={styles.copy}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
              {o.hint ? <Text style={styles.hint}>{o.hint}</Text> : null}
            </View>
            <View style={[styles.check, selected && styles.checkOn]}>
              {selected ? <Check size={13} color={colors.surface} strokeWidth={3.5} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  cardSelected: {
    backgroundColor: colors.incomeBg,
    borderColor: colors.income,
  },
  emoji: {
    fontSize: 22,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  labelSelected: {
    color: colors.ink,
  },
  hint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.chevron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.income,
    borderColor: colors.income,
  },
});
