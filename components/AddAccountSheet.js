import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Trash2 } from 'lucide-react-native';
import Button from './Button';
import { CATEGORY_COLORS } from './CategoryIcon';
import CurrencyPicker from './CurrencyPicker';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useProfile from '../hooks/useProfile';
import { DEFAULT_CURRENCY } from '../lib/currency';

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
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { accounts, activeAccountId, setActiveAccount } = useAccount();
  const { showToast } = useToast();
  const { profile } = useProfile();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
        setCurrency(profile?.currency ?? DEFAULT_CURRENCY);
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
    setSaving(true);
    setError(null);

    const payload = { name: name.trim(), description: description.trim() || null, color, currency };

    const { data, error: saveError } = editingId
      ? await supabase.from('accounts').update(payload).eq('id', editingId).select().single()
      : await supabase.from('accounts').insert(payload).select().single();

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
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
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
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Account' : 'New Account'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Business"
          placeholderTextColor={colors.mutedDarker}
          style={styles.textInput}
        />

        <Text style={styles.fieldLabel}>Description (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What's this account for?"
          placeholderTextColor={colors.mutedDarker}
          style={styles.textInput}
        />

        <Text style={styles.fieldLabel}>Color</Text>
        <View style={styles.colorGrid}>
          {CATEGORY_COLORS.map((swatch) => {
            const selected = swatch === color;
            return (
              <Pressable
                key={swatch}
                style={[styles.colorOption, { backgroundColor: swatch }, selected && styles.colorOptionSelected]}
                onPress={() => setColor(swatch)}
              />
            );
          })}
        </View>

        <CurrencyPicker
          value={currency}
          onChange={setCurrency}
          dark
          disabled={currencyLocked}
          disabledReason="Currency can't change once an account has transactions — create a new account instead"
          style={{ marginTop: spacing.md }}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title={editingId ? 'Save Account' : 'Create Account'}
          variant="primary"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={confirmDelete} disabled={saving}>
            <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </Pressable>
        )}
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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.surface,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.dangerStrong,
    textAlign: 'center',
    marginTop: spacing.md,
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
