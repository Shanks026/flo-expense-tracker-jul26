import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import Button from './Button';
import CategoryIcon, { CATEGORY_ICON_KEYS } from './CategoryIcon';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

const AddCategorySheetContext = createContext(null);

export function AddCategorySheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddCategory = useCallback((defaultType) => sheetRef.current?.open(defaultType ?? 'expense'), []);

  return (
    <AddCategorySheetContext.Provider value={{ openAddCategory }}>
      {children}
      <AddCategorySheet ref={sheetRef} />
    </AddCategorySheetContext.Provider>
  );
}

export function useAddCategorySheet() {
  const ctx = useContext(AddCategorySheetContext);
  if (!ctx) throw new Error('useAddCategorySheet must be used within AddCategorySheetProvider');
  return ctx;
}

const AddCategorySheet = forwardRef(function AddCategorySheet(_props, ref) {
  const modalRef = useRef(null);
  const { notifyChanged } = useDataRefresh();

  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [icon, setIcon] = useState(CATEGORY_ICON_KEYS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    open(defaultType) {
      setError(null);
      setName('');
      setType(defaultType ?? 'expense');
      setIcon(CATEGORY_ICON_KEYS[0]);
      modalRef.current?.present();
    },
  }));

  async function handleSave() {
    if (!name.trim()) {
      setError('Enter a category name');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: saveError } = await supabase.from('categories').insert({
      name: name.trim(),
      type,
      icon,
      is_default: false,
    });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={useMemo(() => ['75%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>New Category</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Subscriptions"
          placeholderTextColor={colors.mutedDarker}
          style={styles.textInput}
        />

        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.segmentWrap}>
          <Pressable style={[styles.segment, type === 'expense' && styles.segmentActive]} onPress={() => setType('expense')}>
            <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextActive]}>Expense</Text>
          </Pressable>
          <Pressable style={[styles.segment, type === 'income' && styles.segmentActive]} onPress={() => setType('income')}>
            <Text style={[styles.segmentText, type === 'income' && styles.segmentTextActive]}>Income</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Icon</Text>
        <View style={styles.iconGrid}>
          {CATEGORY_ICON_KEYS.map((key) => {
            const selected = key === icon;
            return (
              <Pressable key={key} style={[styles.iconOption, selected && styles.iconOptionSelected]} onPress={() => setIcon(key)}>
                <CategoryIcon icon={key} size={20} color={selected ? colors.ink : colors.surface} strokeWidth={2} />
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Create Category" variant="primary" onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
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
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.inkCard,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.surface,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.inkCard,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: colors.brand,
  },
  segmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  segmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    backgroundColor: colors.brand,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.dangerStrong,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
