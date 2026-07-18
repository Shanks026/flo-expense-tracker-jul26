import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, ChevronRight } from 'lucide-react-native';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import ProBenefits from './ProBenefits';
import { PRO_MONTHLY_EQUIVALENT } from '../lib/pro';

const DEFAULT_REASON = 'A little more room to grow.';

const ProUpsellSheetContext = createContext(null);

export function ProUpsellSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openProUpsell = useCallback((reason) => sheetRef.current?.open(reason), []);

  return (
    <ProUpsellSheetContext.Provider value={{ openProUpsell }}>
      {children}
      <ProUpsellSheet ref={sheetRef} />
    </ProUpsellSheetContext.Provider>
  );
}

export function useProUpsellSheet() {
  const ctx = useContext(ProUpsellSheetContext);
  if (!ctx) throw new Error('useProUpsellSheet must be used within ProUpsellSheetProvider');
  return ctx;
}

const ProUpsellSheet = forwardRef(function ProUpsellSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const router = useRouter();
  const [reason, setReason] = useState(null);

  useImperativeHandle(ref, () => ({
    open(nextReason) {
      setReason(nextReason ?? null);
      modalRef.current?.present();
    },
  }));

  function handleLevelUp() {
    modalRef.current?.dismiss();
    router.push('/pro');
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['58%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: staticColors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={staticColors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.title}>Go further with FLO</Text>
        <Text style={styles.subtitle}>{reason ?? DEFAULT_REASON}</Text>

        <ProBenefits limit={4} style={styles.benefits} />

        <Pressable style={styles.cta} onPress={handleLevelUp}>
          <Text style={styles.ctaText}>Level up for {PRO_MONTHLY_EQUIVALENT}/mo</Text>
          <ChevronRight size={18} color={staticColors.ink} strokeWidth={2.6} />
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: staticColors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.3,
    color: staticColors.surface,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: staticColors.mutedMid,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 19,
  },
  benefits: {
    marginBottom: spacing.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 56,
    borderRadius: radii.button,
    backgroundColor: colors.brand,
  },
  ctaText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: staticColors.ink,
  },
  });
}
