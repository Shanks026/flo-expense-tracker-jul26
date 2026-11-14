import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Sheet from './ledger/Sheet';
import Button from './ledger/Button';
import { CATEGORY_COLORS } from './CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { addPerson, updatePerson, deletePerson } from '../lib/splits';
import { destructiveHaptic } from '../lib/haptics';

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
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
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
    destructiveHaptic();
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

  return (
    // The one sheet opened on top of another (New split's "Add person"):
    // `push` keeps the split sheet presented underneath with its half-filled
    // form intact; the default `switch` minimised it and on device it never
    // came back.
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit person' : 'Add person'}
      onChange={handleSheetChange}
      stackBehavior="push"
      footer={{ primary: { title: editingId ? 'Save' : 'Add person', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="Abishek"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Name"
        style={styles.field}
        autoFocus
        maxLength={60}
      />

      {/* Optional, and nothing reads it yet: it's what a reminder or a UPI
          link will need later, and why FLO never asks for your own number. */}
      <Text style={styles.label}>Phone (optional)</Text>
      <BottomSheetTextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="For a reminder later"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Phone"
        style={styles.field}
        keyboardType="phone-pad"
        maxLength={20}
      />

      <Text style={styles.label}>Colour</Text>
      <View style={styles.colorGrid} accessibilityRole="radiogroup" accessibilityLabel="Colour">
        {CATEGORY_COLORS.map((swatch, i) => {
          const selected = color === swatch;
          return (
            <Pressable
              key={swatch}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${i + 1} of ${CATEGORY_COLORS.length}`}
              accessibilityState={{ selected }}
              onPress={() => setColor(swatch)}
              style={[styles.colorOption, { backgroundColor: swatch }, selected && { borderWidth: 3, borderColor: c.ink }]}
            />
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Remove person" variant="danger" onPress={handleDelete} disabled={saving} style={styles.delete} />}
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
