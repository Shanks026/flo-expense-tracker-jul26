import { useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import ListRow from '../components/ledger/ListRow';
import HeaderIconButton from '../components/ledger/HeaderIconButton';
import CategoryIcon from '../components/CategoryIcon';
import { useLedger, ledgerSpace } from '../theme/ledger';
import useCategories from '../hooks/useCategories';
import { useAddCategorySheet } from '../components/AddCategorySheet';

// Categories on the ledger kit (spec 48, ticket 09): Expense and Income, each
// with a + in its header that opens the sheet for that type. Every category
// is a row with its tinted circle; a tap opens it for editing, where Delete
// now lives (no row bin, no swipe).
export default function ManageCategories() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const { expenseCategories, incomeCategories } = useCategories();
  const { openAddCategory } = useAddCategorySheet();

  function section(title, categories, type) {
    return (
      <View style={styles.section}>
        <SectionHeader
          title={title}
          right={<HeaderIconButton icon={Plus} onPress={() => openAddCategory(type)} accessibilityLabel={`New ${type} category`} />}
        />
        {categories.map((cat, i) => (
          <ListRow
            key={cat.id}
            tone={cat.color}
            renderIcon={(tint) => <CategoryIcon icon={cat.icon} size={18} color={tint} strokeWidth={1.75} />}
            title={cat.name}
            trailing="chevron"
            onPress={() => openAddCategory(cat)}
            divider={i < categories.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Categories" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Categories" scrollY={scrollY} />
        {section('Expense', expenseCategories, 'expense')}
        {section('Income', incomeCategories, 'income')}
      </Animated.ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.section * 2,
    },
    section: {
      marginTop: ledgerSpace.md,
    },
  });
}
