import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { getSteps, getStepPosition } from '../lib/onboarding';

// The step dots. Completed and current steps are wide lime pills; upcoming
// ones are short grey stubs — straight from the design. Both the count and
// the fill come from lib/onboarding.js's step list, so a step dropped for an
// unsupported platform never leaves an orphan dot behind.
export default function OnboardingProgress({ stepKey }) {
  const position = getStepPosition(stepKey);
  if (!position) return null;

  return (
    <View style={styles.row}>
      {getSteps().map((step, i) => {
        const filled = i < position.index;
        return <View key={step.key} style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: radii.pill,
  },
  dotFilled: {
    width: 26,
    backgroundColor: colors.brand,
  },
  dotEmpty: {
    width: 8,
    backgroundColor: colors.completedTrack,
  },
});
