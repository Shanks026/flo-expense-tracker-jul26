import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Plus, CalendarDays, ClipboardList } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, startOfDay } from 'date-fns';
import Sheet from './ledger/Sheet';
import Button from './ledger/Button';
import Chip from './ledger/Chip';
import ListRow from './ledger/ListRow';
import IconPicker from './ledger/IconPicker';
import SplitMemberChip from './SplitMemberChip';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useSplitPeople from '../hooks/useSplitPeople';
import usePlans from '../hooks/usePlans';
import { FLAGS } from '../lib/flags';
import { createSplit, updateSplit, deleteSplit } from '../lib/splits';
import { useAddSplitPersonSheet } from './AddSplitPersonSheet';
import { destructiveHaptic } from '../lib/haptics';

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
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
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
            destructiveHaptic();
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

  return (
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit split' : 'New split'}
      onChange={handleSheetChange}
      footer={{ primary: { title: editingId ? 'Save' : 'Create split', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="Mysore Trip"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Split name"
        style={styles.field}
        maxLength={60}
      />

      <Text style={styles.label}>Icon</Text>
      <View style={styles.block}>
        <IconPicker value={icon} onChange={setIcon} keys={SPLIT_ICONS} accessibilityLabel="Split icon" />
      </View>

      <ListRow icon={CalendarDays} title="Date" right={format(date, 'd MMM yyyy')} trailing="chevron" onPress={() => setShowPicker(true)} divider={FLAGS.plans} />

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

      {/* Optional link to a plan: a settlement this split produces lands in
          that plan. Hidden while Plans are flagged off; an existing split
          keeps its plan_id. */}
      {FLAGS.plans && (
        <ListRow
          icon={ClipboardList}
          title="Plan (optional)"
          right={selectedPlan?.name ?? 'None'}
          trailing="chevron"
          onPress={() => setPlanPickerOpen((v) => !v)}
          divider={false}
        />
      )}

      {FLAGS.plans && planPickerOpen && (
        <View style={styles.chipWrap}>
          <Chip
            label="None"
            selected={planId === null}
            onPress={() => {
              setPlanId(null);
              setPlanPickerOpen(false);
            }}
          />
          {activePlans.map((plan) => (
            <Chip
              key={plan.id}
              label={plan.name}
              selected={planId === plan.id}
              onPress={() => {
                setPlanId(plan.id);
                setPlanPickerOpen(false);
              }}
            />
          ))}
        </View>
      )}

      {!editingId && (
        <>
          <Text style={[styles.label, styles.spaced]}>Who's in it</Text>
          <Text style={styles.help}>
            You're always in. Add everyone else; they don't need the app. People you add are saved for future splits; long-press one
            to rename or remove it.
          </Text>
          <View style={styles.chipWrap}>
            {people.map((person) => (
              <SplitMemberChip
                key={person.id}
                member={{ id: person.id, name: person.name, color: person.color, isSelf: false }}
                selected={personIds.includes(person.id)}
                showCheck
                onPress={() => togglePerson(person.id)}
                // The only way to the person sheet's edit mode.
                onLongPress={() => openAddSplitPerson(person)}
              />
            ))}
            {/* Selects the new person the moment they're created. */}
            <Chip label="Add person" icon={Plus} onPress={() => openAddSplitPerson(null, (newId) => togglePerson(newId))} />
          </View>
        </>
      )}

      {editingId && <Text style={[styles.help, styles.spaced]}>Add or remove people on the split itself; it changes what everyone owes.</Text>}

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Delete split" variant="danger" onPress={handleDelete} disabled={saving} style={styles.delete} />}
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
    spaced: {
      marginTop: ledgerSpace.lg,
    },
    help: {
      ...ledgerType.caption,
      color: c.muted,
      marginBottom: ledgerSpace.md,
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
      marginBottom: ledgerSpace.md,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      marginBottom: ledgerSpace.md,
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
