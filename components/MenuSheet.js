import { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { ChartColumn, Settings, LogOut, X } from 'lucide-react-native';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';

const MenuSheetContext = createContext(null);

export function MenuSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openMenu = useCallback(() => sheetRef.current?.open(), []);

  return (
    <MenuSheetContext.Provider value={{ openMenu }}>
      {children}
      <MenuSheet ref={sheetRef} />
    </MenuSheetContext.Provider>
  );
}

export function useMenuSheet() {
  const ctx = useContext(MenuSheetContext);
  if (!ctx) throw new Error('useMenuSheet must be used within MenuSheetProvider');
  return ctx;
}

const ITEMS = [
  { key: 'analytics', label: 'Analytics', route: '/analytics', icon: ChartColumn },
  { key: 'settings', label: 'Settings', route: '/settings', icon: Settings },
];

const MenuSheet = forwardRef(function MenuSheet(_props, ref) {
  const modalRef = useRef(null);
  const router = useRouter();
  const { signOut } = useAuth();

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

  function handleLogout() {
    modalRef.current?.dismiss();
    signOut();
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={useMemo(() => ['44%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Menu</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable key={item.key} style={styles.row} onPress={() => handlePress(item.route)}>
              <View style={styles.rowIcon}>
                <Icon size={19} color={colors.surface} strokeWidth={2} />
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
            </Pressable>
          );
        })}

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={handleLogout}>
          <View style={styles.rowIcon}>
            <LogOut size={19} color={colors.dangerStrong} strokeWidth={2} />
          </View>
          <Text style={[styles.rowLabel, styles.logoutLabel]}>Log Out</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: spacing.xl,
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
    color: colors.surface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.surface,
  },
  logoutLabel: {
    color: colors.dangerStrong,
  },
  divider: {
    height: 1,
    backgroundColor: colors.inkCard,
    marginVertical: spacing.sm,
  },
});
