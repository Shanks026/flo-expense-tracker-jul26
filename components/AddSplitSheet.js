import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Trash2, Plus } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, startOfDay } from 'date-fns';
import Button from './Button';
import CategoryIcon from './CategoryIcon';
import SplitMemberChip from './SplitMemberChip';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useSplitPeople from '../hooks/useSplitPeople';
import usePlans from '../hooks/usePlans';
import { createSplit, updateSplit, deleteSplit } from '../lib/splits';
import { useAddSplitPersonSheet } from './AddSplitPersonSheet';

// A small curated set rather than the whole CATEGORY_ICON_KEYS bank — a split is
// an event ("the Mysore trip", "flat rent"), so the useful icons are the
// event-shaped ones. Reuses CategoryIcon's key map so nothing new is invented.
const SPLIT_ICONS = ['travel', 'food', 'home', 'car', 'gift', 'entertainment', 'shopping', 'other'];

const AddSplitSheetContext = createContext(null);

export function AddSplitSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddSplit = useCallback((split) => sheetRef.current?.open(split ?? null), []);

  return (
    <AddSplitSheetContext.Provider value={{ openAddSplit }}>
      {children}
      <AddSplitSheet ref={sheetRef} />
    </AddSplitSheetContext.Provider>
  );
}

export function useAddSplitSheet() {
  const ctx = useContext(AddSplitSheetContext);
  if (!ctx) throw new Error('useAddSplitSheet must be used within AddSplitSheetProvider');
  return ctx;
}

const AddSplitSheet = forwardRef(function AddSplitSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const { showToast } = useToast();
  const { people } = useSplitPeople();
  const { activePlans } = usePlans();
  const { openAddSplitPerson } = useAddSplitPersonSheet();
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(SPLIT_ICONS[0]);
  const [date, setDate] = useState(startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [planId, setPlanId] = useState(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [personIds, setPersonIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedPlan = activePlans.find((p) => p.id === planId);

  useImperativeHandle(ref, () => ({
    open(split) {
      setError(null);
      setShowPicker(false);
      setPlanPickerOpen(false);
      if (split) {
        setEditingId(split.id);
        setName(split.name ?? '');
        setIcon(split.icon ?? SPLIT_ICONS[0]);
        setDate(split.occurredOn ? parseISO(split.occurredOn) : startOfDay(new Date()));
        setPlanId(split.planId ?? null);
        // Members are NOT edited here. Adding or removing someone changes what
        // everyone else owes, so it belongs on the split's own screen next to
        // the balances it affects — where a blocked removal ("they already paid
        // for something") can be explained in context.
        setPersonIds([]);
      } else {
        setEditingId(null);
        setName('');
        setIcon(SPLIT_ICONS[0]);
        setDate(startOfDay(new Date()));
        setPlanId(null);
        setPersonIds([]);
      }
      modalRef.current?.present();
    },
  }));

  function togglePerson(personId) {
    setPersonIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Give the split a name');
      return;
    }
    if (!editingId && personIds.length === 0) {
      setError('Add at least one other person');
      return;
    }
    if (!editingId && !activeAccountId) {
      setError('Still loading your account — try again in a moment');
      return;
    }
    setSaving(true);
    setError(null);

    const occurredOn = format(date, 'yyyy-MM-dd');
    const { error: saveError } = editingId
      ? await updateSplit(editingId, { name, icon, occurredOn, planId })
      : await createSplit({ accountId: activeAccountId, name, icon, occurredOn, planId, personIds });

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Split updated' : 'Split created', variant: 'success' });
  }

  function handleDelete() {
    if (!editingId) return;
    Alert.alert(
      'Delete this split?',
      'Every entry and settlement in it goes too. Transactions already in your ledger are left alone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            const { error: deleteError } = await deleteSplit(editingId);
            setSaving(false);
            if (deleteError) {
              showToast({ message: deleteError.message, variant: 'error' });
              return;
            }
            notifyChanged();
            modalRef.current?.dismiss();
            showToast({ message: 'Split deleted', variant: 'success' });
          },
        },
      ]
    );
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.chevron, width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Split' : 'New Split'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
        </View>

        {/* gorhom's own scroll view, not React Native's — a plain ScrollView
            inside a bottom sheet fights the sheet's pan gesture. */}
        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Mysore Trip"
            placeholderTextColor={colors.mutedDarker}
            style={styles.input}
            maxLength={60}
          />

          <Text style={styles.fieldLabel}>Icon</Text>
          <View style={styles.iconRow}>
            {SPLIT_ICONS.map((key) => (
              <Pressable
                key={key}
                onPress={() => setIcon(key)}
                style={[styles.iconTile, icon === key && styles.iconTileSelected]}
              >
                <CategoryIcon
                  icon={key}
                  size={20}
                  color={icon === key ? colors.brandText : colors.ink}
                  strokeWidth={2}
                />
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.row} onPress={() => setShowPicker(true)}>
            <Text style={styles.fieldLabelInline}>Date</Text>
            <Text style={styles.rowValue}>{format(date, 'd MMM yyyy')}</Text>
          </Pressable>

          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(_event, selected) => {
                setShowPicker(false);
                if (selected) setDate(startOfDay(selected));
              }}
            />
          )}

          {/* Optional link to a plan. The Mysore plan and the Mysore split are
              the same real event, so a settlement transaction produced by this
              split lands in that plan automatically. */}
          <Pressable style={styles.row} onPress={() => setPlanPickerOpen((v) => !v)}>
            <Text style={styles.fieldLabelInline}>Plan (optional)</Text>
            <Text style={styles.rowValue}>{selectedPlan?.name ?? 'None'}</Text>
          </Pressable>

          {planPickerOpen && (
            <View style={styles.planList}>
              <Pressable
                style={styles.planOption}
                onPress={() => {
                  setPlanId(null);
                  setPlanPickerOpen(false);
                }}
              >
                <Text style={[styles.planOptionText, planId === null && styles.planOptionTextActive]}>None</Text>
              </Pressable>
              {activePlans.map((plan) => (
                <Pressable
                  key={plan.id}
                  style={styles.planOption}
                  onPress={() => {
                    setPlanId(plan.id);
                    setPlanPickerOpen(false);
                  }}
                >
                  <Text style={[styles.planOptionText, planId === plan.id && styles.planOptionTextActive]}>
                    {plan.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {!editingId && (
            <>
              <Text style={styles.fieldLabel}>Who's in it</Text>
              <Text style={styles.helpText}>
                You're always in. Add everyone else — they don't need the app. People you add are
                saved for future splits; long-press one to rename or remove it.
              </Text>
              <View style={styles.chipWrap}>
                {people.map((person) => (
                  <SplitMemberChip
                    key={person.id}
                    member={{ id: person.id, name: person.name, color: person.color, isSelf: false }}
                    selected={personIds.includes(person.id)}
                    showCheck
                    onPress={() => togglePerson(person.id)}
                    // The only way to reach the person sheet's EDIT mode. Without
                    // this, a typo'd name was permanent and `updatePerson` /
                    // `deletePerson` were unreachable dead code.
                    onLongPress={() => openAddSplitPerson(person)}
                  />
                ))}
                <Pressable
                  style={styles.addPersonChip}
                  // Selects the new person the moment they're created, so adding
                  // four people in a row is four taps, not eight.
                  onPress={() => openAddSplitPerson(null, (newId) => togglePerson(newId))}
                >
                  <Plus size={15} color={colors.ink} strokeWidth={2.6} />
                  <Text style={styles.addPersonText}>Add person</Text>
                </Pressable>
              </View>
            </>
          )}

          {editingId && (
            <Text style={styles.helpText}>
              Add or remove people on the split itself — it changes what everyone owes.
            </Text>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={editingId ? 'Save Split' : 'Create Split'}
            variant="primary"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: spacing.lg }}
          />
          {editingId && (
            <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
              <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
              <Text style={styles.deleteText}>Delete Split</Text>
            </Pressable>
          )}
        </BottomSheetScrollView>
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
    scroll: {
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
    fieldLabelInline: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.mutedMid,
    },
    helpText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.md,
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
    iconRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: spacing.lg,
    },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: radii.iconTile,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconTileSelected: {
      backgroundColor: colors.brand,
      borderWidth: 0,
    },
    row: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    rowValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.base,
      color: colors.ink,
    },
    planList: {
      marginBottom: spacing.md,
      gap: 2,
    },
    planOption: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    planOptionText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.mutedDarker,
    },
    planOptionTextActive: {
      fontFamily: fontFamily.extrabold,
      color: colors.ink,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    addPersonChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.chevron,
    },
    addPersonText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.ink,
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
