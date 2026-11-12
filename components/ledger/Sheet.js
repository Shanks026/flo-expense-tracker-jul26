import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop, BottomSheetFooter } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import HeaderIconButton from './HeaderIconButton';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from './PinnedFooter';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../theme/ledger';

// The visual shell of a bottom sheet (redesign §2.5), used inside the usual
// `<XSheetProvider>` + `useXSheet()` pattern: one handle, a title row with a
// circle X, a scrollable body sized to its content (capped at 92 % of the
// screen), and an optional PinnedFooter that rides on the keyboard. A soft
// shadow in light mode, a hairline top edge in dark.
//
// The ref exposes `present()` and `dismiss()` (the modal's own; nothing else).
// `footer` is PinnedFooter's { primary, secondary? }, or nothing.
// `stackBehavior` 'push' keeps the sheet underneath open (OverflowMenu's
// menu inside the account switcher); the library default replaces it.
const Sheet = forwardRef(function Sheet({ title, footer, onChange, onDismiss, stackBehavior, children }, ref) {
  const { c, modeId } = useLedger();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboardUp = useKeyboardVisible();
  const modalRef = useRef(null);
  useImperativeHandle(ref, () => ({
    present: (...args) => modalRef.current?.present(...args),
    dismiss: (...args) => modalRef.current?.dismiss(...args),
  }));

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );
  // A new function each render, so the library remounts the footer as the
  // form changes. The keyboard state therefore lives here and goes down as a
  // prop; a remounted footer reading its own would start at "down" and lift
  // Save off the keyboard on every keystroke.
  const renderFooter = footer
    ? (props) => (
        <BottomSheetFooter {...props}>
          <PinnedFooter primary={footer.primary} secondary={footer.secondary} keyboardUp={keyboardUp} />
        </BottomSheetFooter>
      )
    : undefined;

  const dark = modeId === 'dark';
  // Clears the pinned footer (and the nav bar while the keyboard is down).
  const bodyBottom = (footer ? PINNED_FOOTER_HEIGHT + ledgerSpace.md : ledgerSpace.gutter) + (keyboardUp ? 0 : insets.bottom);

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={onChange}
      onDismiss={onDismiss}
      stackBehavior={stackBehavior}
      topInset={insets.top}
      enableDynamicSizing
      maxDynamicContentSize={Math.round(height * 0.92)}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // adjustPan: the sheet tracks the keyboard itself. Under Android's
      // edge-to-edge drawing the window no longer resizes for the keyboard.
      android_keyboardInputMode="adjustPan"
      footerComponent={renderFooter}
      backdropComponent={renderBackdrop}
      style={!dark && [styles.shadow, { shadowColor: c.shadow }]}
      backgroundStyle={[
        styles.background,
        { backgroundColor: c.canvas },
        dark && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
      ]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: c.inkFaint }]}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bodyBottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[ledgerType.title, styles.title, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <HeaderIconButton icon={X} onPress={() => modalRef.current?.dismiss()} accessibilityLabel="Close" />
        </View>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

export default Sheet;

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: ledgerRadius.sheet,
    borderTopRightRadius: ledgerRadius.sheet,
  },
  shadow: {
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: 36,
  },
  body: {
    paddingHorizontal: ledgerSpace.gutter,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ledgerSpace.md,
    marginBottom: ledgerSpace.lg,
  },
  title: {
    flex: 1,
  },
});
