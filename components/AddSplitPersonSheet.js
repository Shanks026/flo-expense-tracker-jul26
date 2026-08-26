import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Trash2 } from 'lucide-react-native';
import Button from './Button';
import { CATEGORY_COLORS } from './CategoryIcon';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { addPerson, updatePerson, deletePerson } from '../lib/splits';

const AddSplitPersonSheetContext = createContext(null);

export function AddSplitPersonSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddSplitPerson = useCallback((person, onCreated) => sheetRef.current?.open(person ?? null, onCreated), []);

  return (
    <AddSplitPersonSheetContext.Provider value={{ openAddSplitPerson }}>
      {children}
      <AddSplitPersonSheet ref={sheetRef} />
    </AddSplitPersonSheetContext.Provider>
  );
}

export function useAddSplitPersonSheet() {
  const ctx = useContext(AddSplitPersonSheetContext);
  if (!ctx) throw new Error('useAddSplitPersonSheet must be used within AddSplitPersonSheetProvider');
  return ctx;
}

const AddSplitPersonSheet = forwardRef(function AddSplitPersonSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Lets the split sheet immediately select someone the user just created,
  // instead of making them add the person and then hunt for them in the list.
  const onCreatedRef = useRef(null);

  useImperativeHandle(ref, () => ({
    open(person, onCreated) {
      setError(null);
      onCreatedRef.current = onCreated ?? null;
      if (person) {
        setEditingId(person.id);
        setName(person.name ?? '');
        setPhone(person.phone ?? '');
        setColor(person.color ?? CATEGORY_COLORS[0]);
      } else {
        setEditingId(null);
        setName('');
        setPhone('');
        // Rotate the default swatch so a group added one after another doesn't
        // come out all the same colour.
        setColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
      }
      modalRef.current?.present();
    },
  }));

  async function handleSave() {
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    setSaving(true);
    setError(null);

    const { id, error: saveError } = editingId
      ? { id: editingId, ...(await updatePerson(editingId, { name, phone, color })) }
      : await addPerson({ name, phone, color });

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    if (!editingId && id) onCreatedRef.current?.(id);
    showToast({ message: editingId ? 'Person updated' : `${name.trim()} added`, variant: 'success' });
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const { error: deleteError } = await deletePerson(editingId);
    setSaving(false);
    if (deleteError) {
      // deletePerson turns the RESTRICT foreign-key violation into a sentence
      // naming the splits they're in — never the raw Postgres error.
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Person removed', variant: 'success' });
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['62%'], [])}
      // This is the one sheet in the app opened from ON TOP of another one
      // (AddSplitSheet's "Add person"), so it's the only one that needs a
      // stack behavior. gorhom's default is `switch`, which MINIMIZES the sheet
      // underneath and relies on restoring it afterwards — on device that
      // restore didn't happen, so adding a person silently threw away a
      // half-filled New Split form. `push` mounts this one on top and leaves
      // the split sheet presented underneath, state intact, so dismissing here
      // lands straight back on it with the new person already ticked.
      stackBehavior="push"
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.chevron, width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Person' : 'Add Person'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Abishek"
          placeholderTextColor={colors.mutedDarker}
          style={styles.input}
          autoFocus
          maxLength={60}
        />

        {/* Optional, and nothing reads it yet. It's captured now because it's
            the natural moment to have it, and it's what a WhatsApp nudge or a
            UPI deep link will need later (see the doc's Out of Scope). This is
            also why FLO does not ask for a phone number at signup — the number
            that matters for a split is your friend's, not your own. */}
        <Text style={styles.fieldLabel}>Phone (optional)</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="For a reminder later"
          placeholderTextColor={colors.mutedDarker}
          style={styles.input}
          keyboardType="phone-pad"
          maxLength={20}
        />

        <Text style={styles.fieldLabel}>Colour</Text>
        <View style={styles.swatchGrid}>
          {CATEGORY_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
            />
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title={editingId ? 'Save Person' : 'Add Person'}
          variant="primary"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
            <Text style={styles.deleteText}>Remove Person</Text>
          </Pressable>
        )}
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
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    headerTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.chipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xl,
      color: colors.ink,
      marginBottom: spacing.lg,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: spacing.sm,
    },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: radii.pill,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    swatchSelected: {
      borderColor: colors.ink,
    },
    errorText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.base,
      color: colors.dangerStrong,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    deleteText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.dangerStrong,
    },
  });
}
