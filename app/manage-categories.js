import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import CategoryIcon from '../components/CategoryIcon';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import useCategories from '../hooks/useCategories';
import { useAddCategorySheet } from '../components/AddCategorySheet';

export default function ManageCategories() {
  const router = useRouter();
  const { expenseCategories, incomeCategories } = useCategories();
  const { openAddCategory } = useAddCategorySheet();
  const { notifyChanged } = useDataRefresh();
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(category) {
    setDeletingId(category.id);

    const [{ count: txCount }, { count: budgetCount }] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', category.id),
      supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('category_id', category.id),
    ]);

    if ((txCount ?? 0) > 0 || (budgetCount ?? 0) > 0) {
      setDeletingId(null);
      Alert.alert('Category in use', `"${category.name}" is used by ${txCount ?? 0} transaction(s) and ${budgetCount ?? 0} budget(s). Remove those first.`);
      return;
    }

    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    setDeletingId(null);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    notifyChanged();
  }

  function confirmDelete(category) {
    Alert.alert('Delete category', `Delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(category) },
    ]);
  }

  function renderSection(title, categories, defaultType) {
    return (
      <View>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Pressable style={styles.addButton} onPress={() => openAddCategory(defaultType)}>
            <Plus size={14} color={colors.surface} strokeWidth={3} />
          </Pressable>
        </View>
        <Card style={styles.listCard}>
          {categories.map((cat, idx) => (
            <View key={cat.id} style={[styles.row, idx < categories.length - 1 && styles.rowBorder]}>
              <IconTile>
                <CategoryIcon icon={cat.icon} size={19} color={colors.ink} />
              </IconTile>
              <Text style={styles.rowTitle}>{cat.name}</Text>
              <Pressable onPress={() => confirmDelete(cat)} disabled={deletingId === cat.id} style={styles.deleteButton}>
                <Trash2 size={17} color={colors.danger} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </Card>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Categories</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderSection('Expense', expenseCategories, 'expense')}
        {renderSection('Income', incomeCategories, 'income')}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  deleteButton: {
    padding: spacing.xs,
  },
});
