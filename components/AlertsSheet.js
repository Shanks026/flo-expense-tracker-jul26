import { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Receipt, Wallet, Flag, FileText, ChevronRight, CircleCheck } from 'lucide-react-native';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useAlerts from '../hooks/useAlerts';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

const AlertsSheetContext = createContext(null);

export function AlertsSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAlerts = useCallback(() => sheetRef.current?.open(), []);

  return (
    <AlertsSheetContext.Provider value={{ openAlerts }}>
      {children}
      <AlertsSheet ref={sheetRef} />
    </AlertsSheetContext.Provider>
  );
}

export function useAlertsSheet() {
  const ctx = useContext(AlertsSheetContext);
  if (!ctx) throw new Error('useAlertsSheet must be used within AlertsSheetProvider');
  return ctx;
}

const KIND_ICON = { bill: Receipt, budget: Wallet, plan: Flag, report: FileText };

const AlertsSheet = forwardRef(function AlertsSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // `info`'s icon color follows the active theme's accent, so this can't
  // live at module scope anymore — it needs the active theme's colors.
  const SEVERITY_TONE = {
    danger: { icon: staticColors.dangerStrong, bg: staticColors.dangerBg },
    warn: { icon: staticColors.warnStrong, bg: staticColors.warnBg },
    info: { icon: colors.brand, bg: staticColors.inkCard },
  };
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const router = useRouter();
  const { alerts } = useAlerts();

  useImperativeHandle(ref, () => ({
    open() {
      modalRef.current?.present();
    },
  }));

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  function handlePress(route) {
    modalRef.current?.dismiss();
    router.push(route);
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['55%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: staticColors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={staticColors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <CircleCheck size={26} color={colors.brand} strokeWidth={2} />
            </View>
            <Text style={styles.emptyText}>You're all caught up.</Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const Icon = KIND_ICON[alert.kind] ?? Receipt;
            // 'info' (a report being ready — good news, not a problem) reuses
            // this same file's own "you're all caught up" empty-state combo:
            // brand lime on an inkCard tile, the established neutral-positive
            // tone on this dark sheet.
            const tone = SEVERITY_TONE[alert.severity];
            return (
              <Pressable key={alert.id} style={styles.row} onPress={() => handlePress(alert.route)}>
                <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                  <Icon size={19} color={tone.icon} strokeWidth={2} />
                </View>
                <View style={styles.rowMid}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {alert.title}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {alert.subtitle}
                  </Text>
                </View>
                <ChevronRight size={16} color={staticColors.mutedMid} strokeWidth={2.4} />
              </Pressable>
            );
          })
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: staticColors.surface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: staticColors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: staticColors.surface,
  },
  rowSubtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: staticColors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: staticColors.mutedMid,
  },
  });
}
