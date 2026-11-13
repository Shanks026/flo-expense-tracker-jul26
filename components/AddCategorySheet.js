import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Sheet from './ledger/Sheet';
import Segmented from './ledger/Segmented';
import Button from './ledger/Button';
import IconPicker from './ledger/IconPicker';
import { CATEGORY_ICON_KEYS, CATEGORY_COLORS } from './CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { createCategory, updateCategory, categoryUsage, deleteCategory } from '../lib/categories';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { destructiveHaptic } from '../lib/haptics';

const AddCategorySheetContext = createContext(null);

// openAddCategory('expense' | 'income') opens a new category of that type;
// openAddCategory(categoryRow) opens that category for editing (spec 48,
// ticket 09), where Delete lives.
export function AddCategorySheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddCategory = useCallback((arg) => sheetRef.current?.open(arg ?? 'expense'), []);

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

const TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

const AddCategorySheet = forwardRef(function AddCategorySheet(_props, ref) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [icon, setIcon] = useState(CATEGORY_ICON_KEYS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    open(arg) {
      setError(null);
      if (arg && typeof arg === 'object') {
        setEditingId(arg.id);
        setName(arg.name ?? '');
        setType(arg.type ?? 'expense');
        setIcon(arg.icon ?? CATEGORY_ICON_KEYS[0]);
        setColor(arg.color ?? CATEGORY_COLORS[0]);
      } else {
        setEditingId(null);
        setName('');
        setType(arg === 'income' ? 'income' : 'expense');
        setIcon(CATEGORY_ICON_KEYS[0]);
        setColor(CATEGORY_COLORS[0]);
      }
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
    const fields = { name: name.trim(), type, icon, color };
    const { error: saveError } = editingId ? await updateCategory(editingId, fields) : await createCategory(fields);
    setSaving(false);
    if (saveError) {
      // 23505 = unique_violation — categories_user_id_name_type_key
      // (categories_unique_and_stop_auto_seed migration, 00-index.md). A
      // friendly message instead of the raw Postgres text.
      const message =
        saveError.code === '23505' ? `You already have a ${type} category named "${fields.name}"` : saveError.message;
      showToast({ message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Category updated' : 'Category created', variant: 'success' });
  }

  // The in-use guard and its message are unchanged from the old row bin.
  async function handleDelete() {
    setSaving(true);
    const usage = await categoryUsage(editingId);
    if (usage.transactions > 0 || usage.budgets > 0) {
      setSaving(false);
      Alert.alert(
        'Category in use',
        `"${name}" is used by ${usage.transactions} transaction(s) and ${usage.budgets} budget(s). Remove those first.`
      );
      return;
    }
    const { error: deleteError } = await deleteCategory(editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Category deleted', variant: 'success' });
  }

  function confirmDelete() {
    Alert.alert('Delete category', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          destructiveHaptic();
          handleDelete();
        },
      },
    ]);
  }

  return (
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit category' : 'New category'}
      onChange={handleSheetChange}
      footer={{ primary: { title: editingId ? 'Save' : 'Create category', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Subscriptions"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Category name"
        style={styles.field}
      />

      {/* Type only for a new category: switching one in use would leave its
          transactions and budgets under the wrong type. */}
      {!editingId && (
        <>
          <Text style={styles.label}>Type</Text>
          <View style={styles.block}>
            <Segmented accessibilityLabel="Type" options={TYPES} value={type} onChange={setType} />
          </View>
        </>
      )}

      <Text style={styles.label}>Icon</Text>
      <View style={styles.block}>
        <IconPicker value={icon} onChange={setIcon} keys={CATEGORY_ICON_KEYS} accessibilityLabel="Category icon" />
      </View>

      <Text style={styles.label}>Colour</Text>
      <View style={styles.colorGrid} accessibilityRole="radiogroup" accessibilityLabel="Colour">
        {CATEGORY_COLORS.map((swatch, i) => {
          const selected = swatch === color;
          return (
            <Pressable
              key={swatch}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${i + 1} of ${CATEGORY_COLORS.length}`}
              accessibilityState={{ selected }}
              style={[styles.colorOption, { backgroundColor: swatch }, selected && { borderWidth: 3, borderColor: c.ink }]}
              onPress={() => setColor(swatch)}
            />
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Delete category" variant="danger" onPress={confirmDelete} disabled={saving} style={styles.delete} />}
    </Sheet>
  );
});

function makeStyles(c) {
  return StyleSheet.create({
    label: {
      ...ledgerType.group,
      color: c.muted,
      marginBottom: ledgerSpace.sm,
    },
    // A single-line input: a full capsule (ledgerRadius.field).
    field: {
      height: 48,
      paddingHorizontal: ledgerSpace.lg,
      paddingVertical: 0,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
      ...ledgerType.body,
      color: c.ink,
      marginBottom: ledgerSpace.lg,
    },
    block: {
      marginBottom: ledgerSpace.lg,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.md,
      marginBottom: ledgerSpace.lg,
    },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: ledgerRadius.full,
    },
    error: {
      ...ledgerType.body,
      color: c.danger,
      marginTop: ledgerSpace.md,
    },
    delete: {
      marginTop: ledgerSpace.lg,
    },
  });
}
