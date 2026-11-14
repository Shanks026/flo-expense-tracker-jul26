import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Sheet from './ledger/Sheet';
import Button from './ledger/Button';
import { CATEGORY_COLORS } from './CategoryIcon';
import CurrencyPicker from './CurrencyPicker';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { supabase } from '../lib/supabase';
import { createAccount, updateAccount } from '../lib/accounts';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useProfile from '../hooks/useProfile';
import { DEFAULT_CURRENCY } from '../lib/currency';
import { destructiveHaptic } from '../lib/haptics';
import { FLAGS } from '../lib/flags';
import { cleanLast4 } from '../lib/accountLast4';

const AddAccountSheetContext = createContext(null);

export function AddAccountSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddAccount = useCallback((account) => sheetRef.current?.open(account ?? null), []);

  return (
    <AddAccountSheetContext.Provider value={{ openAddAccount }}>
      {children}
      <AddAccountSheet ref={sheetRef} />
    </AddAccountSheetContext.Provider>
  );
}

export function useAddAccountSheet() {
  const ctx = useContext(AddAccountSheetContext);
  if (!ctx) throw new Error('useAddAccountSheet must be used within AddAccountSheetProvider');
  return ctx;
}

const AddAccountSheet = forwardRef(function AddAccountSheet(_props, ref) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { accounts, activeAccountId, setActiveAccount } = useAccount();
  const { showToast } = useToast();
  const { profile } = useProfile();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Optional last 4 (spec 48 ticket 06): digits only, at most four.
  const [last4, setLast4] = useState('');
  const [last4Error, setLast4Error] = useState(null);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  // An account's currency is immutable once it has transactions (15-currency-
  // going-global.md §Product decisions) — relabeling would invent money,
  // converting would destroy history. Defaults locked=true while editing an
  // existing account (safe default until the count resolves), then flips to
  // the real answer — briefly disabling an actually-empty account's picker is
  // a harmless flicker; briefly allowing an in-use account's currency to be
  // edited is not.
  const [currencyLocked, setCurrencyLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    async open(account) {
      setError(null);
      setLast4Error(null);
      setLast4(account?.last4 ?? '');
      if (account) {
        setEditingId(account.id);
        setName(account.name);
        setDescription(account.description ?? '');
        setColor(account.color);
        setCurrency(account.currency ?? DEFAULT_CURRENCY);
        setCurrencyLocked(true);
        modalRef.current?.present();
        const { count } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', account.id);
        setCurrencyLocked((count ?? 0) > 0);
      } else {
        setEditingId(null);
        setName('');
        setDescription('');
        setColor(CATEGORY_COLORS[0]);
        // Currency picker flagged off (lib/flags.js): new accounts are INR.
        setCurrency(FLAGS.currencyPicker ? (profile?.currency ?? DEFAULT_CURRENCY) : DEFAULT_CURRENCY);
        setCurrencyLocked(false);
        modalRef.current?.present();
      }
    },
  }));

  async function handleSave() {
    if (!name.trim()) {
      setError('Enter an account name');
      return;
    }
    const cleaned = cleanLast4(last4);
    if (cleaned.error) {
      setLast4Error(cleaned.error);
      return;
    }
    setSaving(true);
    setError(null);
    setLast4Error(null);

    const payload = { name: name.trim(), description: description.trim() || null, last4: cleaned.value, color, currency };

    const { data, error: saveError } = editingId
      ? await updateAccount(editingId, payload)
      : await createAccount(payload);

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    if (!editingId && data) setActiveAccount(data.id);
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Account updated' : 'Account created', variant: 'success' });
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);

    // Bills are global (not account-scoped), so they're never part of this
    // guard — deleting an account can't orphan a bill.
    const [{ count: txCount }, { count: budgetCount }, { count: planCount }] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('account_id', editingId),
      supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('account_id', editingId),
      supabase.from('plans').select('id', { count: 'exact', head: true }).eq('account_id', editingId),
    ]);

    if ((txCount ?? 0) > 0 || (budgetCount ?? 0) > 0 || (planCount ?? 0) > 0) {
      setSaving(false);
      Alert.alert(
        'Account in use',
        `"${name}" has ${txCount ?? 0} transaction(s), ${budgetCount ?? 0} budget(s), and ${planCount ?? 0} plan(s). Remove those first.`
      );
      return;
    }

    if (accounts.length <= 1) {
      setSaving(false);
      Alert.alert('Cannot delete', 'You need at least one account.');
      return;
    }

    if (editingId === activeAccountId) {
      const fallback = accounts.find((a) => a.id !== editingId);
      if (fallback) setActiveAccount(fallback.id);
    }

    const { error: deleteError } = await supabase.from('accounts').delete().eq('id', editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Account deleted', variant: 'success' });
  }

  function confirmDelete() {
    Alert.alert('Delete account', `Delete "${name}"? This cannot be undone.`, [
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
      title={editingId ? 'Edit account' : 'New account'}
      onChange={handleSheetChange}
      footer={{ primary: { title: editingId ? 'Save' : 'Create account', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. HDFC savings"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Account name"
        style={styles.field}
      />

      <Text style={styles.label}>Last 4 digits (optional)</Text>
      <BottomSheetTextInput
        value={last4}
        onChangeText={(v) => {
          setLast4(v.replace(/\D/g, '').slice(0, 4));
          setLast4Error(null);
        }}
        placeholder="e.g. 4821"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        keyboardType="number-pad"
        maxLength={4}
        accessibilityLabel="Last 4 digits"
        style={[styles.field, styles.fieldTight, last4Error && { borderWidth: 1, borderColor: c.danger }]}
      />
      {last4Error && <Text style={[styles.hint, styles.hintError, { color: c.danger }]}>{last4Error}</Text>}
      <Text style={styles.hint}>Only the last 4, to tell your cards apart. FLO never asks for a full card number.</Text>

      <Text style={styles.label}>Description (optional)</Text>
      <BottomSheetTextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What's this account for?"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Description"
        style={styles.field}
      />

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

      {FLAGS.currencyPicker && (
        <CurrencyPicker
          value={currency}
          onChange={setCurrency}
          disabled={currencyLocked}
          disabledReason="Currency can't change once an account has transactions — create a new account instead"
          style={styles.block}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Delete account" variant="danger" onPress={confirmDelete} disabled={saving} style={styles.delete} />}
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
    fieldTight: {
      marginBottom: ledgerSpace.xs,
    },
    hintError: {
      marginBottom: ledgerSpace.xs,
    },
    hint: {
      ...ledgerType.caption,
      color: c.muted,
      marginBottom: ledgerSpace.lg,
      paddingHorizontal: ledgerSpace.lg,
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
    block: {
      marginBottom: ledgerSpace.lg,
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
