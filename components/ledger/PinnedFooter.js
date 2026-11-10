import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';
import { useLedger, ledgerSpace, ledgerSize } from '../../theme/ledger';

// A screen's or sheet's bottom action bar (redesign §2.5): a full-width
// primary, plus an optional secondary side by side. It carries the nav-bar
// inset while the keyboard is down; with it up, the bar sits on the
// keyboard. Inside a bottom sheet, wrap it in the sheet library's footer
// (`Sheet` does) so it rises with the keyboard.
//
// `primary` and `secondary` are { title, onPress, loading?, disabled?,
// variant? } (secondary defaults to the outlined style). A parent that may
// remount this bar (a sheet's footer render function) passes `keyboardUp`
// so a remount doesn't reset it to "down" while the keyboard is showing.
export const PINNED_FOOTER_HEIGHT = ledgerSize.button + ledgerSpace.sm + ledgerSpace.lg;

export default function PinnedFooter({ primary, secondary, keyboardUp: keyboardUpProp, style }) {
  const { c } = useLedger();
  const insets = useSafeAreaInsets();
  const ownKeyboardUp = useKeyboardVisible();
  const keyboardUp = keyboardUpProp ?? ownKeyboardUp;
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.canvas, paddingBottom: ledgerSpace.lg + (keyboardUp ? 0 : insets.bottom) },
        style,
      ]}
    >
      {secondary && (
        <Button
          title={secondary.title}
          onPress={secondary.onPress}
          loading={secondary.loading}
          disabled={secondary.disabled}
          variant={secondary.variant ?? 'secondary'}
          style={styles.flex}
        />
      )}
      <Button
        title={primary.title}
        onPress={primary.onPress}
        loading={primary.loading}
        disabled={primary.disabled}
        variant={primary.variant ?? 'primary'}
        style={styles.flex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: ledgerSpace.sm,
    paddingHorizontal: ledgerSpace.gutter,
    paddingTop: ledgerSpace.sm,
  },
  flex: {
    flex: 1,
  },
});
