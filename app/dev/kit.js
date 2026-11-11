import { useMemo, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBasket, Bell, Moon, Sun, Smartphone, Trash2, Wallet } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../../components/ledger/ScreenHeader';
import SectionHeader from '../../components/ledger/SectionHeader';
import ListRow from '../../components/ledger/ListRow';
import Button from '../../components/ledger/Button';
import AmountText from '../../components/ledger/AmountText';
import Segmented from '../../components/ledger/Segmented';
import Callout from '../../components/ledger/Callout';
import ProgressBar from '../../components/ledger/ProgressBar';
import Illustration, { ILLUSTRATION_NAMES } from '../../components/ledger/Illustration';
import EmptyState from '../../components/ledger/EmptyState';
import Chip from '../../components/ledger/Chip';
import TransactionRow from '../../components/ledger/TransactionRow';
import Timeline from '../../components/ledger/Timeline';
import DayOfMonthPicker from '../../components/ledger/DayOfMonthPicker';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';

// Developer → Kit (spec 46, ticket 06): every ledger component in its states,
// on one scrolling screen, so a kit change can be checked in light and dark
// without hunting for the screen that uses it. Switch Settings → Appearance
// to see the other mode. Later tickets add their components here.
//
// Development builds only: release builds have __DEV__ false and the route
// sends them Home. Nothing here reads or writes data; buttons do nothing.
export default function KitGalleryScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <KitGallery />;
}

const noop = () => {};

// Rows for TransactionRow (no account list, so amounts read as INR).
const SAMPLE_TX = {
  expense: { id: 'e', type: 'expense', amount: 420, note: 'Weekly vegetables', category: { name: 'Groceries', icon: 'groceries', color: '#2F9E44' } },
  income: { id: 'i', type: 'income', amount: 50000, note: null, category: { name: 'Salary', icon: 'salary', color: '#4C7031' } },
  transfer: { id: 't', type: 'transfer_out', amount: 2000 },
  settlement: { id: 's', type: 'settle_in', amount: 300 },
};
// A category colour is data, not a theme token: this stands in for one.
const GROCERIES = '#2F9E44';

function KitGallery() {
  const { c } = useLedger();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const [segment, setSegment] = useState('expense');
  const [segment3, setSegment3] = useState('system');
  const [switchOn, setSwitchOn] = useState(true);
  const [monthDay, setMonthDay] = useState(25);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Kit" scrollY={scrollY} />
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Kit" scrollY={scrollY} />

        <Section title="Button">
          <View style={styles.stack}>
            <Button title="Primary" onPress={noop} />
            <Button title="Secondary" variant="secondary" onPress={noop} />
            <Button title="Quiet" variant="quiet" onPress={noop} />
            <Button title="Danger" variant="danger" onPress={noop} />
            <Button title="Disabled" disabled onPress={noop} />
            <Button title="Loading" loading onPress={noop} />
          </View>
          <View style={styles.inline}>
            <Button title="Compact" compact onPress={noop} />
            <Button title="Compact" variant="secondary" compact onPress={noop} />
            <Button title="Compact" variant="danger" compact onPress={noop} />
          </View>
        </Section>

        <Section title="ListRow">
          <ListRow icon={Bell} title="Title only" />
          <ListRow icon={Wallet} title="With a sub" sub="A muted second line" trailing="chevron" onPress={noop} />
          <ListRow
            icon={ShoppingBasket}
            tone={GROCERIES}
            title="Toned icon, money right"
            sub="Groceries · Today"
            right={<AmountText value={420} type="expense" signed />}
            rightSub="HDFC"
          />
          <ListRow icon={Moon} title="Check" trailing="check" onPress={noop} />
          <ListRow icon={Bell} title="Switch" sub={switchOn ? 'On' : 'Off'} switchValue={switchOn} onSwitchChange={setSwitchOn} />
          <ListRow icon={Smartphone} title="Compact button" trailing={<Button title="Send" variant="secondary" compact onPress={noop} />} />
          <ListRow icon={Wallet} title="Disabled" sub="Dimmed, ignores taps" disabled onPress={noop} />
          <ListRow icon={Trash2} title="Danger" danger onPress={noop} divider={false} />
        </Section>

        <Section title="Chip">
          <View style={styles.inline}>
            <Chip label="Plain" onPress={noop} />
            <Chip label="Selected" selected onPress={noop} />
            <Chip label="Filter" icon={Wallet} caret onPress={noop} />
            <Chip label="Filter, set" icon={Wallet} caret selected onPress={noop} />
          </View>
        </Section>

        <Section title="TransactionRow">
          <TransactionRow tx={SAMPLE_TX.expense} onPress={noop} />
          <TransactionRow tx={SAMPLE_TX.income} onPress={noop} accountName="Savings" />
          <TransactionRow tx={SAMPLE_TX.transfer} title="Personal → Savings" onPress={noop} />
          <TransactionRow tx={SAMPLE_TX.settlement} onPress={noop} divider={false} />
        </Section>

        <Section title="Timeline">
          <Timeline
            steps={[
              { key: 'a', title: 'Created', sub: 'Voice · 1 Nov 2026, 10:00 AM' },
              { key: 'b', title: 'Added to Goa trip', sub: '2 Nov 2026, 12:00 PM' },
              { key: 'c', title: 'Edited', sub: '3 Nov 2026, 9:00 AM' },
            ]}
          />
        </Section>

        <Section title="SectionHeader">
          <SectionHeader title="Plain title" />
          <SectionHeader title="With an action" actionLabel="See all" onAction={noop} />
          <SectionHeader title="With a right node" right={<AmountText value={12840} />} />
        </Section>

        <Section title="AmountText">
          <AmountText value={50100} size="display" />
          <AmountText value={2104.5} size="title" />
          <AmountText value={1367.6} />
          <View style={styles.signs}>
            <Labeled label="Income, signed">
              <AmountText value={25000} type="income" signed size="title" />
            </Labeled>
            <Labeled label="Expense, signed">
              <AmountText value={120} type="expense" signed size="title" />
            </Labeled>
            <Labeled label="Negative balance">
              <AmountText value={-2500.5} size="title" />
            </Labeled>
          </View>
        </Section>

        <Section title="DayOfMonthPicker">
          <DayOfMonthPicker value={monthDay} onChange={setMonthDay} />
        </Section>

        <Section title="Segmented">
          <View style={styles.stack}>
            <Segmented
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
              value={segment}
              onChange={setSegment}
              accessibilityLabel="Two options"
            />
            <Segmented
              options={[
                { value: 'system', label: 'System', icon: Smartphone },
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ]}
              value={segment3}
              onChange={setSegment3}
              accessibilityLabel="Three options with icons"
            />
          </View>
        </Section>

        <Section title="Callout">
          <View style={styles.stack}>
            <Callout tone="info" text="Info: a note that isn't data." />
            <Callout tone="warn" text="Warn: spending too fast to last the period." />
            <Callout tone="danger" text="Danger: notifications are off." actionLabel="Open settings" onAction={noop} />
          </View>
        </Section>

        <Section title="ProgressBar">
          <View style={styles.stack}>
            {[40, 85, 100, 120].map((pct) => (
              <View key={pct}>
                <Text style={styles.label}>{`${pct} %`}</Text>
                <ProgressBar value={pct / 100} accessibilityLabel={`Sample at ${pct} percent`} />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Illustration">
          <View style={styles.grid}>
            {ILLUSTRATION_NAMES.map((name) => (
              <View key={name} style={styles.gridItem}>
                <Illustration name={name} />
                <Text style={styles.label}>{name}</Text>
              </View>
            ))}
          </View>
          <View style={styles.inline}>
            <Labeled label="large">
              <Illustration name="trophy" size="large" />
            </Labeled>
            <Labeled label="surface=dark">
              <Illustration name="token" size="large" surface="dark" />
            </Labeled>
          </View>
        </Section>

        <Section title="EmptyState">
          <EmptyState title="Nothing here yet" body="Entries you add show up here." actionTitle="Add one" onAction={noop} />
          <EmptyState illustration="calendar" title="Title and body only" body="No button." />
        </Section>
      </Animated.ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginTop: ledgerSpace.section }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function Labeled({ label, children }) {
  const { c } = useLedger();
  return (
    <View style={{ gap: ledgerSpace.xs }}>
      {children}
      <Text style={[ledgerType.caption, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
    },
    stack: {
      gap: ledgerSpace.md,
    },
    inline: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: ledgerSpace.md,
      marginTop: ledgerSpace.md,
    },
    signs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.lg,
      marginTop: ledgerSpace.md,
    },
    label: {
      ...ledgerType.caption,
      color: c.muted,
      marginBottom: ledgerSpace.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.lg,
    },
    gridItem: {
      alignItems: 'center',
      gap: ledgerSpace.xs,
    },
  });
}
