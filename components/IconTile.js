import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';

const TONES = {
  neutral: colors.iconTileBg,
  brand: 'rgba(187,220,18,0.16)',
  income: colors.incomeBg,
  danger: colors.dangerBg,
  warn: colors.warnBg,
  dark: colors.inkCard,
  completed: colors.completedTrack,
};

export default function IconTile({ children, tone = 'neutral', size = 42, radius = radii.iconTile }) {
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: TONES[tone] ?? TONES.neutral,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
